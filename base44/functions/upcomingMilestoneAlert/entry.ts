import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled invocations and manual admin triggers
    try {
      const user = await base44.auth.me();
      if (user && user.role !== 'admin' && user.role !== 'global_admin' && user.role !== 'church_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    } catch {
      // Scheduled — no user context, proceed
    }

    // Target date: 7 days from today
    const target = new Date();
    target.setDate(target.getDate() + 7);
    const targetMonth = target.getMonth() + 1;
    const targetDay = target.getDate();

    const churches = await base44.asServiceRole.entities.Church.list();
    const summary = [];

    for (const church of churches) {
      if (church.status === 'suspended') continue;

      const members = await base44.asServiceRole.entities.ChurchMember.filter({
        church_id: church.id,
        status: 'active',
      });

      const birthdays = [];
      const anniversaries = [];

      for (const member of members) {
        const fullName = `${member.first_name} ${member.last_name}`.trim();

        if (member.date_of_birth) {
          const d = new Date(member.date_of_birth + 'T00:00:00');
          if (d.getMonth() + 1 === targetMonth && d.getDate() === targetDay) {
            birthdays.push({ name: fullName, email: member.email, date: member.date_of_birth });
          }
        }

        if (member.wedding_anniversary) {
          const d = new Date(member.wedding_anniversary + 'T00:00:00');
          if (d.getMonth() + 1 === targetMonth && d.getDate() === targetDay) {
            anniversaries.push({ name: fullName, email: member.email, date: member.wedding_anniversary });
          }
        }
      }

      if (birthdays.length === 0 && anniversaries.length === 0) continue;

      // Find admins/staff for this church
      const allUsers = await base44.asServiceRole.entities.User.list();
      const adminEmails = [
        ...(church.admin_emails || []),
        church.admin_email,
      ].filter(Boolean);

      const staffList = allUsers.filter(u =>
        u.church_id === church.id &&
        (u.role === 'church_admin' || u.role === 'church_staff' || u.role === 'global_admin' || u.role === 'admin')
      );

      const recipients = [
        ...staffList.map(u => u.email),
        ...adminEmails,
      ].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);

      if (recipients.length === 0) continue;

      const churchName = church.name || 'Your Church';
      const targetDateLabel = target.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      const buildRows = (items, type) => items.map(m => {
        const icon = type === 'birthday' ? '🎂' : '💍';
        const label = type === 'birthday' ? 'Birthday' : 'Wedding Anniversary';
        const greetingSubject = type === 'birthday'
          ? encodeURIComponent(`Happy Birthday, ${m.name.split(' ')[0]}! 🎉`)
          : encodeURIComponent(`Happy Anniversary, ${m.name.split(' ')[0]}! 💍`);
        const greetingBody = type === 'birthday'
          ? encodeURIComponent(`Dear ${m.name.split(' ')[0]},\n\nWishing you a wonderful birthday filled with joy and God's blessings! We are grateful for you and thank God for your life.\n\nWith love and prayers,\n${churchName}`)
          : encodeURIComponent(`Dear ${m.name.split(' ')[0]},\n\nCongratulations on your wedding anniversary! May God continue to bless your marriage with love, joy, and grace. We celebrate this milestone with you.\n\nWith love and prayers,\n${churchName}`);
        const mailtoLink = m.email ? `mailto:${m.email}?subject=${greetingSubject}&body=${greetingBody}` : null;

        return `
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:12px 8px;">${icon}</td>
            <td style="padding:12px 8px;font-weight:600;color:#1e293b;">${m.name}</td>
            <td style="padding:12px 8px;color:#64748b;">${label}</td>
            <td style="padding:12px 8px;">
              ${mailtoLink
                ? `<a href="${mailtoLink}" style="display:inline-block;background:#1e3a5f;color:white;padding:5px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Send Greeting ✉️</a>`
                : '<span style="color:#94a3b8;font-size:13px;">No email on file</span>'
              }
            </td>
          </tr>`;
      }).join('');

      const allRows = [
        ...buildRows(birthdays, 'birthday'),
        ...buildRows(anniversaries, 'anniversary'),
      ].join('');

      const totalCount = birthdays.length + anniversaries.length;

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a5f 0%,#1F7A8C 100%);padding:32px 36px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:32px;">✝️</span>
        <div>
          <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">${churchName}</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Upcoming Celebrations — 1 Week Notice</p>
        </div>
      </div>
    </div>

    <div style="padding:32px 36px;">
      <p style="color:#475569;margin:0 0 8px;font-size:15px;">
        The following member${totalCount !== 1 ? 's have' : ' has'} a special occasion coming up on
        <strong>${targetDateLabel}</strong> — just 7 days away.
      </p>
      <p style="color:#64748b;margin:0 0 24px;font-size:14px;">
        Consider reaching out personally to celebrate with them and show the church's love and support.
      </p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;width:32px;"></th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Member</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Occasion</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>${allRows}</tbody>
      </table>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
        Sent automatically by ShepherdSyncs · 7-day advance notice
      </p>
    </div>
  </div>
</body>
</html>`;

      for (const email of recipients) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: email,
          subject: `🎉 ${totalCount} Upcoming Celebration${totalCount !== 1 ? 's' : ''} in 1 Week — ${churchName}`,
          body: htmlBody,
          from_name: churchName,
        });
      }

      summary.push({ church: churchName, birthdays: birthdays.length, anniversaries: anniversaries.length, notified: recipients.length });
    }

    return Response.json({ ok: true, processed: summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});