import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const SIX_WEEKS_AGO = new Date();
  SIX_WEEKS_AGO.setDate(SIX_WEEKS_AGO.getDate() - 42);
  const cutoffDate = SIX_WEEKS_AGO.toISOString().split('T')[0];
  const today = new Date().toISOString().split('T')[0];

  // Get all active churches
  const churches = await base44.asServiceRole.entities.Church.filter({ status: 'active' });

  let totalFlagged = 0;
  const results = [];

  for (const church of churches) {
    const churchId = church.id;

    // Get all active members
    const members = await base44.asServiceRole.entities.ChurchMember.filter({ church_id: churchId, status: 'active' });
    if (members.length === 0) continue;

    // Get all attendance records for this church in the last 28 days
    const recentAttendance = await base44.asServiceRole.entities.AttendanceRecord.filter(
      { church_id: churchId },
      '-date',
      2000
    );

    // Build map of memberId -> most recent attendance date
    const lastAttendedMap = {};
    for (const record of recentAttendance) {
      if (record.present === false) continue;
      const existing = lastAttendedMap[record.member_id];
      if (!existing || record.date > existing) {
        lastAttendedMap[record.member_id] = record.date;
      }
    }

    // Get existing open inactive_member tasks to avoid duplicates
    const existingTasks = await base44.asServiceRole.entities.FollowUpTask.filter({
      church_id: churchId,
      type: 'inactive_member',
      status: 'pending'
    });
    const existingMemberIds = new Set(existingTasks.map(t => t.member_id).filter(Boolean));

    // Also check in_progress
    const inProgressTasks = await base44.asServiceRole.entities.FollowUpTask.filter({
      church_id: churchId,
      type: 'inactive_member',
      status: 'in_progress'
    });
    inProgressTasks.forEach(t => { if (t.member_id) existingMemberIds.add(t.member_id); });

    const tasksToCreate = [];

    for (const member of members) {
      // Skip if already has an open task
      if (existingMemberIds.has(member.id)) continue;

      const lastDate = lastAttendedMap[member.id];

      // Flag if: never attended OR last attendance was before cutoff
      if (!lastDate || lastDate < cutoffDate) {
        const weeksAbsent = lastDate
          ? Math.floor((new Date(today) - new Date(lastDate)) / (7 * 24 * 60 * 60 * 1000))
          : null;

        tasksToCreate.push({
          church_id: churchId,
          member_id: member.id,
          visitor_name: `${member.first_name} ${member.last_name}`,
          visitor_email: member.email || '',
          visitor_phone: member.phone || '',
          type: 'inactive_member',
          last_attended: lastDate || null,
          weeks_absent: weeksAbsent,
          status: 'pending',
          date_added: today,
          notes: lastDate
            ? `Last attended on ${lastDate} (${weeksAbsent} week${weeksAbsent !== 1 ? 's' : ''} ago)`
            : 'No attendance records found',
        });
      }
    }

    if (tasksToCreate.length > 0) {
      await base44.asServiceRole.entities.FollowUpTask.bulkCreate(tasksToCreate);
      totalFlagged += tasksToCreate.length;
    }

    results.push({ church: church.name, flagged: tasksToCreate.length });
  }

  return Response.json({ success: true, total_flagged: totalFlagged, results });
});