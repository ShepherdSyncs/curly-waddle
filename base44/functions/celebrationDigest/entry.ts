import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Combined: weeklyBirthdayDigest (14-day window from MemberProfiles)
//         + upcomingMilestoneAlert (7-day birthday & anniversary from ChurchMembers)
// Runs once per week (Monday). Shares church/user fetches across both jobs.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Build 14-day window lookup for birthday digest
    const window14 = [];
    for (let offset = 0; offset <= 13; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      window14.push({ month: d.getMonth() + 1, day: d.getDate(), offset });
    }

    // 7-day target for milestone alerts
    const target7 = new Date(today);
    target7.setDate(today.getDate() + 7);
    const targetMonth7 = target7.getMonth() + 1;
    const targetDay7 = target7.getDate();
    const target7Label = target7.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const churches = await base44.asServiceRole.entities.Church.list();
    if (churches.length === 0) return Response.json({ ok: true, message: 'No churches found' });

    // Fetch all users once — shared across all churches
    const allUsers = await base44.asServiceRole.entities.User.list();

    const summary = [];

    for (const church of churches) {
      if (church.status === 'suspended') continue;
      const churchName = church.name || 'Your Church';
      const churchId = church.id;

      // Shared staff list for this church
      const staffList = allUsers.filter(u =>
        u.church_id === churchId &&
        (u.role === 'church_admin' || u.role === 'church_staff' || u.role === 'global_admin' || u.role === 'admin')
      );
      const adminEmails = [...(church.admin_emails || []), church.admin_email].filter(Boolean);
      const allRecipients = [...new Set([...staffList.map(u => u.email), ...adminEmails].filter(Boolean))];

      if (allRecipients.length === 0) continue;

      // ---- Job 1: 14-day birthday digest from MemberProfiles ----
      const profiles = await base44.asServiceRole.entities.MemberProfile.filter({
        church_id: churchId,
        show_in_directory: true,
      });

      const upcomingBirthdays = [];
      for (const profile of profiles) {
        if (!profile.birthday) continue;
        const bday = new Date(profile.birthday + 'T00:00:00');
        const match = window14.find(r => r.month === bday.getMonth() + 1 && r.day === bday.getDate());
        if (match) {
          upcomingBirthdays.push({
            name: profile.display_name || profile.user_email,
            email: profile.user_email,
            birthday: profile.birthday,
            daysUntil: match.offset,
          });
        }
      }
      upcomingBirthdays.sort((a, b) => a.daysUntil - b.daysUntil);

      if (upcomingBirthdays.length > 0) {
        const weekLabel = `${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${new Date(today.getTime() + 13 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

        const bdayRows = upcomingBirthdays.map(m => {
          const dayLabel = m.daysUntil === 0 ? '🎂 Today!' : m.daysUntil === 1 ? 'Tomorrow' : `In ${m.daysUntil} days`;
          const bdayFormatted = new Date(m.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          const greetingSubject = encodeURIComponent(`Happy Birthday, ${m.name.split(' ')[0]}! 🎉`);
          const greetingBody = encodeURIComponent(`Dear ${m.name.split(' ')[0]},\n\nWishing you a wonderful birthday filled with joy and God's blessings! We are so grateful for you and thank God for the gift of your life.\n\nWith love and prayers,\n${churchName}`);
          const mailtoLink = `mailto:${m.email}?subject=${greetingSubject}&body=${greetingBody}`;
          return `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:12px 8px;font-weight:600;color:#1e293b;">${m.name}</td>
              <td style="padding:12px 8px;color:#64748b;">${bdayFormatted}</td>
              <td style="padding:12px 8px;color:#6366f1;font-weight:500;">${dayLabel}</td>
              <td style="padding:12px 8px;">
                ${m.email ? `<a href="${mailtoLink}" style="display:inline-block;background:#6366f1;color:white;padding:5px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Send Greeting ✉️</a>` : '<span style="color:#94a3b8;font-size:13px;">No email</span>'}
              </td>
            </tr>`;
        }).join('');

        const bdayHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#6366f1 100%);padding:32px 36px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:32px;">✝️</span>
        <div>
          <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">${churchName}</h1>
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">Birthday Digest — ${weekLabel}</p>
        </div>
      </div>
    </div>
    <div style="padding:32px 36px;">
      <p style="color:#475569;margin:0 0 24px;">Here are upcoming member birthdays in the next 14 days. Click <em>Send Greeting</em> to open a pre-filled email draft.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Member</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Birthday</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">When</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>${bdayRows}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">Sent weekly by ShepherdSyncs · Members with birthdays in the next 14 days are included.</p>
    </div>
  </div>
</body></html>`;

        for (const email of allRecipients) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `🎂 ${upcomingBirthdays.length} Upcoming Birthday${upcomingBirthdays.length !== 1 ? 's' : ''} — ${churchName} (${weekLabel})`,
            body: bdayHtml,
            from_name: churchName,
          });
        }
      }

      // ---- Job 2: 7-day milestone alert (birthdays & anniversaries from ChurchMembers) ----
      const members = await base44.asServiceRole.entities.ChurchMember.filter({ church_id: churchId, status: 'active' });

      const birthdays7 = [];
      const anniversaries7 = [];

      for (const member of members) {
        const fullName = `${member.first_name} ${member.last_name}`.trim();

        if (member.date_of_birth) {
          const d = new Date(member.date_of_birth + 'T00:00:00');
          if (d.getMonth() + 1 === targetMonth7 && d.getDate() === targetDay7) {
            birthdays7.push({ name: fullName, email: member.email, date: member.date_of_birth });
          }
        }

        if (member.wedding_anniversary) {
          const d = new Date(member.wedding_anniversary + 'T00:00:00');
          if (d.getMonth() + 1 === targetMonth7 && d.getDate() === targetDay7) {
            anniversaries7.push({ name: fullName, email: member.email, date: member.wedding_anniversary });
          }
        }
      }

      if (birthdays7.length > 0 || anniversaries7.length > 0) {
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
                ${mailtoLink ? `<a href="${mailtoLink}" style="display:inline-block;background:#1e3a5f;color:white;padding:5px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Send Greeting ✉️</a>` : '<span style="color:#94a3b8;font-size:13px;">No email on file</span>'}
              </td>
            </tr>`;
        }).join('');

        const totalCount = birthdays7.length + anniversaries7.length;
        const allRows = [...buildRows(birthdays7, 'birthday'), ...buildRows(anniversaries7, 'anniversary')].join('');

        const milestoneHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
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
      <p style="color:#475569;margin:0 0 8px;font-size:15px;">The following member${totalCount !== 1 ? 's have' : ' has'} a special occasion coming up on <strong>${target7Label}</strong> — just 7 days away.</p>
      <p style="color:#64748b;margin:0 0 24px;font-size:14px;">Consider reaching out personally to celebrate with them.</p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 8px;text-align:left;width:32px;"></th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Member</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Occasion</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>${allRows}</tbody>
      </table>
      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">Sent automatically by ShepherdSyncs · 7-day advance notice</p>
    </div>
  </div>
</body></html>`;

        for (const email of allRecipients) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `🎉 ${totalCount} Upcoming Celebration${totalCount !== 1 ? 's' : ''} in 1 Week — ${churchName}`,
            body: milestoneHtml,
            from_name: churchName,
          });
        }
      }

      summary.push({
        church: churchName,
        birthday_digest: upcomingBirthdays.length,
        milestone_alerts: birthdays7.length + anniversaries7.length,
        notified: allRecipients.length,
      });
    }

    return Response.json({ ok: true, processed: summary });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});