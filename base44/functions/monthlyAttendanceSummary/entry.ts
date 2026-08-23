import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Generates a monthly attendance summary email for each church admin.
// Can be triggered manually (admin only) or via scheduled automation (first of each month).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no user) or admin trigger
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'global_admin' && user.role !== 'church_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // scheduled — proceed
    }

    const now = new Date();
    // Report covers the previous calendar month
    const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const reportMonth = now.getMonth() === 0 ? 12 : now.getMonth(); // 1-12
    const monthName = new Date(reportYear, reportMonth - 1, 1).toLocaleString('en-US', { month: 'long' });

    const monthStart = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
    const monthEnd = `${reportYear}-${String(reportMonth).padStart(2, '0')}-31`;

    // Four-week absence cutoff
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];

    const churches = await base44.asServiceRole.entities.Church.list();
    const allUsers = await base44.asServiceRole.entities.User.list();
    const processed = [];

    for (const church of churches) {
      if (church.status === 'suspended') continue;

      const members = await base44.asServiceRole.entities.ChurchMember.filter({
        church_id: church.id,
        status: 'active',
      });
      if (members.length === 0) continue;

      // Attendance for the month
      const monthAttendance = await base44.asServiceRole.entities.AttendanceRecord.filter({
        church_id: church.id,
      }, '-date', 2000);

      const monthRecords = monthAttendance.filter(r => r.date >= monthStart && r.date <= monthEnd);
      const recentRecords = monthAttendance.filter(r => r.date >= fourWeeksAgoStr);

      // Group by date to get per-service attendance
      const byDate = {};
      for (const r of monthRecords) {
        if (!byDate[r.date]) byDate[r.date] = { present: 0, absent: 0, date: r.date };
        if (r.present !== false) byDate[r.date].present++;
        else byDate[r.date].absent++;
      }
      const services = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

      const totalPresent = services.reduce((s, d) => s + d.present, 0);
      const avgAttendance = services.length > 0 ? Math.round(totalPresent / services.length) : 0;

      // Find members absent for 4+ consecutive weeks
      const presentMemberIds = new Set(recentRecords.filter(r => r.present !== false).map(r => r.member_id));
      const absentMembers = members.filter(m => !presentMemberIds.has(m.id));

      // Find staff to notify
      const staffList = allUsers.filter(u =>
        u.church_id === church.id &&
        (u.role === 'church_admin' || u.role === 'church_staff' || u.role === 'global_admin') &&
        u.email
      );
      if (staffList.length === 0) continue;

      // Build attendance trend rows
      const trendRows = services.map(s => `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px;color:#1e293b;">${new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
          <td style="padding:10px 8px;color:#16a34a;font-weight:600;">${s.present}</td>
          <td style="padding:10px 8px;color:#dc2626;">${s.absent}</td>
          <td style="padding:10px 8px;color:#6366f1;font-weight:600;">${s.present + s.absent > 0 ? Math.round(s.present / (s.present + s.absent) * 100) : 0}%</td>
        </tr>`).join('');

      const absentRows = absentMembers.map(m => {
        const mailto = m.email
          ? `mailto:${m.email}?subject=${encodeURIComponent(`We Miss You, ${m.first_name}!`)}&body=${encodeURIComponent(`Dear ${m.first_name},\n\nWe've noticed you haven't been with us recently and we miss you! Please know that our doors are always open and we'd love to see you back.\n\nWith love,\n${church.name}`)}`
          : null;
        return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 8px;color:#1e293b;font-weight:600;">${m.first_name} ${m.last_name}</td>
          <td style="padding:10px 8px;color:#64748b;">${m.email || '—'}</td>
          <td style="padding:10px 8px;">${mailto ? `<a href="${mailto}" style="background:#ef4444;color:white;padding:4px 12px;border-radius:5px;text-decoration:none;font-size:12px;">Reach Out ✉️</a>` : '<span style="color:#94a3b8;font-size:12px;">No email</span>'}</td>
        </tr>`;
      }).join('');

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:680px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#0f4c75 0%,#1F7A8C 100%);padding:32px 36px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:32px;">✝️</span>
        <div>
          <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">ShepherdSyncs</h1>
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">Monthly Attendance Report — ${monthName} ${reportYear}</p>
        </div>
      </div>
    </div>
    <div style="padding:32px 36px;">
      <h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">${church.name}</h2>
      <p style="margin:0 0 24px;color:#64748b;font-size:14px;">Here's your attendance summary for <strong>${monthName} ${reportYear}</strong>.</p>

      <!-- Summary Stats -->
      <div style="display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;">
        <div style="flex:1;min-width:120px;background:#f0fdf4;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#16a34a;">${services.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Services Recorded</div>
        </div>
        <div style="flex:1;min-width:120px;background:#eff6ff;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#2563eb;">${avgAttendance}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Avg. Attendance</div>
        </div>
        <div style="flex:1;min-width:120px;background:#fef2f2;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#dc2626;">${absentMembers.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Absent 4+ Weeks</div>
        </div>
        <div style="flex:1;min-width:120px;background:#faf5ff;border-radius:10px;padding:16px;text-align:center;">
          <div style="font-size:28px;font-weight:700;color:#7c3aed;">${members.length}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">Active Members</div>
        </div>
      </div>

      ${services.length > 0 ? `
      <!-- Attendance Trend Table -->
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:15px;">📊 Service-by-Service Breakdown</h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Date</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Present</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Absent</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Rate</th>
          </tr>
        </thead>
        <tbody>${trendRows}</tbody>
      </table>` : '<p style="color:#94a3b8;margin-bottom:28px;">No services recorded this month.</p>'}

      ${absentMembers.length > 0 ? `
      <!-- Absent Members -->
      <h3 style="margin:0 0 12px;color:#dc2626;font-size:15px;">⚠️ Members Absent 4+ Consecutive Weeks</h3>
      <p style="margin:0 0 12px;color:#64748b;font-size:13px;">These members have not been marked present in the last 28 days. Consider reaching out.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #fecaca;border-radius:8px;overflow:hidden;margin-bottom:28px;">
        <thead>
          <tr style="background:#fef2f2;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Member</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Email</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Action</th>
          </tr>
        </thead>
        <tbody>${absentRows}</tbody>
      </table>` : '<p style="color:#16a34a;font-weight:600;margin-bottom:28px;">✅ No members absent for 4+ consecutive weeks. Great job!</p>'}

      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Sent by ShepherdSyncs · Monthly Attendance Report for ${monthName} ${reportYear}</p>
    </div>
  </div>
</body>
</html>`;

      for (const staff of staffList) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: staff.email,
          subject: `📊 ${monthName} Attendance Report — ${church.name}`,
          body: htmlBody,
          from_name: church.name || 'ShepherdSyncs',
        });
      }

      processed.push({
        church: church.name,
        services: services.length,
        avgAttendance,
        absentMembers: absentMembers.length,
        staffNotified: staffList.length,
      });
    }

    return Response.json({ ok: true, month: `${monthName} ${reportYear}`, processed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});