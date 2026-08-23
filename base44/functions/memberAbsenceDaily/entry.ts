import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Combined: flagInactiveMembers (6+ weeks -> create follow-up tasks)
//         + fourWeekAbsenceAlert (4-6 weeks -> email admins)
// Runs once per day. Shares a single attendance data fetch per church.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const cutoff4w = new Date(today); cutoff4w.setDate(today.getDate() - 28);
    const cutoff6w = new Date(today); cutoff6w.setDate(today.getDate() - 42);
    const cutoff4wStr = cutoff4w.toISOString().split('T')[0];
    const cutoff6wStr = cutoff6w.toISOString().split('T')[0];

    const churches = await base44.asServiceRole.entities.Church.filter({ status: 'active' });
    if (churches.length === 0) return Response.json({ ok: true, message: 'No active churches' });

    let totalFlagged = 0;
    let totalAlerted = 0;
    const results = [];

    for (const church of churches) {
      const churchId = church.id;

      const members = await base44.asServiceRole.entities.ChurchMember.filter({ church_id: churchId, status: 'active' });
      if (members.length === 0) continue;

      // Single attendance fetch — shared by both jobs
      const recentAttendance = await base44.asServiceRole.entities.AttendanceRecord.filter(
        { church_id: churchId }, '-date', 2000
      );

      const lastAttendedMap = {};
      for (const record of recentAttendance) {
        if (record.present === false) continue;
        const existing = lastAttendedMap[record.member_id];
        if (!existing || record.date > existing) {
          lastAttendedMap[record.member_id] = record.date;
        }
      }

      // --- 6-week job: create follow-up tasks for inactive members ---
      const existingPending = await base44.asServiceRole.entities.FollowUpTask.filter({ church_id: churchId, type: 'inactive_member', status: 'pending' });
      const existingInProgress = await base44.asServiceRole.entities.FollowUpTask.filter({ church_id: churchId, type: 'inactive_member', status: 'in_progress' });
      const existingIds = new Set([...existingPending, ...existingInProgress].map(t => t.member_id).filter(Boolean));

      const tasksToCreate = [];
      for (const member of members) {
        if (existingIds.has(member.id)) continue;
        const lastDate = lastAttendedMap[member.id];
        if (!lastDate || lastDate < cutoff6wStr) {
          const weeksAbsent = lastDate
            ? Math.floor((new Date(todayStr) - new Date(lastDate)) / (7 * 24 * 60 * 60 * 1000))
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
            date_added: todayStr,
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

      // --- 4-week job: email admins about members in the 4-6 week window ---
      const absentMembers = members
        .filter(m => {
          const lastDate = lastAttendedMap[m.id];
          if (!lastDate) return false;
          return lastDate < cutoff4wStr && lastDate >= cutoff6wStr;
        })
        .map(m => {
          const lastDate = lastAttendedMap[m.id];
          const weeksAbsent = Math.floor((new Date(todayStr) - new Date(lastDate)) / (7 * 24 * 60 * 60 * 1000));
          return { ...m, lastDate, weeksAbsent };
        });

      if (absentMembers.length > 0) {
        const adminEmails = church.admin_emails || (church.admin_email ? [church.admin_email] : []);
        if (adminEmails.length > 0) {
          const rows = absentMembers.map(m => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:10px 8px;font-weight:600;color:#1e293b;">${m.first_name} ${m.last_name}</td>
              <td style="padding:10px 8px;color:#64748b;">${m.email || '—'}</td>
              <td style="padding:10px 8px;color:#d97706;font-weight:600;">${m.weeksAbsent} weeks</td>
              <td style="padding:10px 8px;">
                ${m.email
                  ? `<a href="mailto:${m.email}?subject=${encodeURIComponent('We miss you!')}&body=${encodeURIComponent(`Dear ${m.first_name},\n\nWe've noticed we haven't seen you in a few weeks and wanted to check in. You are missed! We hope you're doing well and look forward to seeing you soon.\n\nWith love,\n${church.name}`)}" style="display:inline-block;background:#f59e0b;color:white;padding:4px 12px;border-radius:6px;text-decoration:none;font-size:12px;">Reach Out ✉️</a>`
                  : '<span style="color:#94a3b8;font-size:12px;">No email</span>'
                }
              </td>
            </tr>`).join('');

          const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:620px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#b45309 0%,#f59e0b 100%);padding:28px 32px;">
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700;">⚠️ 4-Week Absence Alert</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">${church.name} · ${absentMembers.length} member${absentMembers.length !== 1 ? 's' : ''} need follow-up</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#475569;margin:0 0 16px;">The following members have not been recorded in attendance for <strong>4 or more weeks</strong>. Please reach out before they reach the 6-week threshold.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#fef3c7;">
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.05em;">Member</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.05em;">Email</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.05em;">Absent</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#92400e;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Members absent 6+ weeks will have a follow-up task created automatically.</p>
    </div>
  </div>
</body></html>`;

          for (const adminEmail of adminEmails) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: adminEmail,
              subject: `⚠️ ${absentMembers.length} Members Absent 4+ Weeks — ${church.name}`,
              body: html,
              from_name: church.name,
            });
          }
          totalAlerted += absentMembers.length;
        }
      }

      results.push({ church: church.name, flagged: tasksToCreate.length, alerted: absentMembers.length });
    }

    return Response.json({ ok: true, total_flagged: totalFlagged, total_alerted: totalAlerted, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});