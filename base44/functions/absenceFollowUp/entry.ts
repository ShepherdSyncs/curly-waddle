import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Triggered by an entity automation when a MinistryAttendance record is created/updated with present=false
// Also called directly with { schedule_id, group_id, church_id } to send a batch digest

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));

  // Support both entity automation payload and direct call
  const { schedule_id, group_id, church_id } = body.data || body;

  if (!schedule_id || !group_id || !church_id) {
    return Response.json({ error: 'Missing schedule_id, group_id, or church_id' }, { status: 400 });
  }

  // Get all absent members for this schedule
  const absentRecords = await base44.asServiceRole.entities.MinistryAttendance.filter({
    schedule_id,
    group_id,
    church_id,
    present: false,
  });

  if (absentRecords.length === 0) {
    return Response.json({ ok: true, message: 'No absent members, no email sent.' });
  }

  // Get group info
  const groups = await base44.asServiceRole.entities.MinistryGroup.filter({ id: group_id });
  const group = groups[0];
  if (!group) return Response.json({ error: 'Group not found' }, { status: 404 });

  // Get schedule info
  const schedules = await base44.asServiceRole.entities.MinistrySchedule.filter({ id: schedule_id });
  const schedule = schedules[0];

  // Find hospitality group leader for this church
  const allGroups = await base44.asServiceRole.entities.MinistryGroup.filter({
    church_id,
    category: 'hospitality',
    is_active: true,
  });

  const hospitalityGroup = allGroups[0];
  const recipientEmail = hospitalityGroup?.leader_email;
  const recipientName = hospitalityGroup?.leader_name || 'Hospitality Leader';

  if (!recipientEmail) {
    return Response.json({ ok: false, message: 'No hospitality group leader found to notify.' });
  }

  const dateLabel = schedule?.date
    ? new Date(schedule.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'Recent Service';

  const churchName = group.church_id; // we'll use the name from church lookup if available
  const churches = await base44.asServiceRole.entities.Church.filter({ id: church_id });
  const church = churches[0];

  const rows = absentRecords.map(r => `
    <tr style="border-bottom:1px solid #e2e8f0;">
      <td style="padding:10px 8px;font-weight:600;color:#1e293b;">${r.member_name}</td>
      <td style="padding:10px 8px;color:#64748b;">${r.member_email || '—'}</td>
      <td style="padding:10px 8px;">
        ${r.member_email
          ? `<a href="mailto:${r.member_email}?subject=${encodeURIComponent('We missed you!')}&body=${encodeURIComponent(`Dear ${r.member_name.split(' ')[0]},\n\nWe missed you at ${schedule?.title || 'our recent service'} on ${dateLabel}. We hope you're doing well and look forward to seeing you soon!\n\nWith love,\n${church?.name || 'Your Church Family'}`)}" style="display:inline-block;background:#6366f1;color:white;padding:4px 12px;border-radius:6px;text-decoration:none;font-size:12px;">Follow Up ✉️</a>`
          : '<span style="color:#94a3b8;font-size:12px;">No email</span>'
        }
      </td>
    </tr>`).join('');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#6366f1 100%);padding:28px 32px;">
      <h1 style="margin:0;color:white;font-size:20px;font-weight:700;">✝️ Shepherd — Absence Follow-Up</h1>
      <p style="margin:6px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${church?.name || 'Church'} · ${group.name}</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="color:#475569;margin:0 0 8px;">Hi ${recipientName},</p>
      <p style="color:#475569;margin:0 0 20px;">
        The following ${absentRecords.length} member${absentRecords.length !== 1 ? 's were' : ' was'} marked <strong>absent</strong> at 
        <strong>${schedule?.title || 'a recent service'}</strong> on <strong>${dateLabel}</strong>. 
        Please reach out to check in on them.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Member</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Email</th>
            <th style="padding:9px 8px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Sent automatically by Shepherd · Ministry Attendance</p>
    </div>
  </div>
</body>
</html>`;

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: recipientEmail,
    subject: `📋 ${absentRecords.length} Absent at "${schedule?.title || group.name}" — Follow-Up Needed`,
    body: html,
    from_name: church?.name || 'ShepherdSyncs',
  });

  return Response.json({ ok: true, absent: absentRecords.length, notified: recipientEmail });
});