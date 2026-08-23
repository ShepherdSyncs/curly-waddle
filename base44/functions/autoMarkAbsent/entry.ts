import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Runs via scheduled automation:
// - Sundays at 5:00 PM EST (22:00 UTC)
// - Wednesdays at 9:00 PM EST (02:00 UTC next day)
//
// For any active member who has NO attendance record for today's date + the
// relevant service type, we auto-create an "absent" record.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Determine today's date in EST
    const nowUTC = new Date();
    // EST = UTC-5 (standard) / UTC-4 (daylight). Use a simple offset approach.
    const estOffset = -5 * 60; // minutes, conservative (standard time)
    const estNow = new Date(nowUTC.getTime() + estOffset * 60 * 1000);
    const todayStr = estNow.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayOfWeek = estNow.getUTCDay(); // 0=Sun, 3=Wed

    // Determine which service type to use
    let serviceType;
    if (dayOfWeek === 0) {
      serviceType = 'sunday_morning';
    } else if (dayOfWeek === 3) {
      serviceType = 'wednesday';
    } else {
      return Response.json({ message: 'Not a Sunday or Wednesday, nothing to do.' });
    }

    // Fetch all churches
    const churches = await base44.asServiceRole.entities.Church.list();
    let totalCreated = 0;

    for (const church of churches) {
      if (!church.id) continue;

      // Get all active members for this church
      const members = await base44.asServiceRole.entities.ChurchMember.filter({
        church_id: church.id,
        status: 'active',
      });
      if (members.length === 0) continue;

      // Get existing attendance records for today + this service type
      const existing = await base44.asServiceRole.entities.AttendanceRecord.filter({
        church_id: church.id,
        date: todayStr,
        service_type: serviceType,
      });

      const recordedMemberIds = new Set(existing.map(r => r.member_id));

      // Build absent records for members with no record yet
      const absentRecords = members
        .filter(m => !recordedMemberIds.has(m.id))
        .map(m => ({
          church_id: church.id,
          member_id: m.id,
          member_name: `${m.first_name} ${m.last_name}`,
          date: todayStr,
          service_type: serviceType,
          present: false,
          notes: 'Auto-marked absent',
        }));

      if (absentRecords.length > 0) {
        await base44.asServiceRole.entities.AttendanceRecord.bulkCreate(absentRecords);
        totalCreated += absentRecords.length;
      }
    }

    return Response.json({
      success: true,
      date: todayStr,
      service_type: serviceType,
      total_absent_records_created: totalCreated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});