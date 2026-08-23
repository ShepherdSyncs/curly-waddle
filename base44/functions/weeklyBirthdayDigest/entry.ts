import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Allow both scheduled (no user) and manual admin trigger
  let isAdmin = false;
  try {
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && user?.role !== 'global_admin' && user?.role !== 'church_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    isAdmin = true;
  } catch {
    // Called from scheduler — no user context, proceed
  }

  const today = new Date();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // Look ahead 14 days
  const results = [];

  for (let offset = 0; offset <= 13; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    results.push({ month: d.getMonth() + 1, day: d.getDate(), offset });
  }

  // Fetch all churches
  const churches = await base44.asServiceRole.entities.Church.list();

  const summary = [];

  for (const church of churches) {
    if (church.status === 'suspended') continue;

    // Get member profiles with birthdays for this church
    const profiles = await base44.asServiceRole.entities.MemberProfile.filter({
      church_id: church.id,
      show_in_directory: true,
    });

    const upcoming = [];
    for (const profile of profiles) {
      if (!profile.birthday) continue;

      const bday = new Date(profile.birthday + 'T00:00:00');
      const bMonth = bday.getMonth() + 1;
      const bDay = bday.getDate();

      const match = results.find(r => r.month === bMonth && r.day === bDay);
      if (match) {
        upcoming.push({
          name: profile.display_name || profile.user_email,
          email: profile.user_email,
          birthday: profile.birthday,
          daysUntil: match.offset,
          bMonth,
          bDay,
        });
      }
    }

    if (upcoming.length === 0) continue;

    // Sort by days until birthday
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    // Find pastoral staff (church_admin and church_staff roles) for this church
    const allUsers = await base44.asServiceRole.entities.User.list();
    const staffList = allUsers.filter(u =>
      u.church_id === church.id &&
      (u.role === 'church_admin' || u.role === 'church_staff' || u.role === 'global_admin')
    );

    if (staffList.length === 0) continue;

    // Build email body
    const churchName = church.name;
    const weekLabel = `${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${new Date(today.getTime() + 13 * 86400000).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;

    const rows = upcoming.map(m => {
      const dayLabel = m.daysUntil === 0 ? '🎂 Today!' : m.daysUntil === 1 ? 'Tomorrow' : `In ${m.daysUntil} days`;
      const bdayFormatted = new Date(m.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      const greetingSubject = encodeURIComponent(`Happy Birthday, ${m.name.split(' ')[0]}! 🎉`);
      const greetingBody = encodeURIComponent(
        `Dear ${m.name.split(' ')[0]},\n\nWishing you a wonderful birthday filled with joy and God's blessings! We are so grateful for you and thank God for the gift of your life.\n\nWith love and prayers,\n${churchName}`
      );
      const mailtoLink = `mailto:${m.email}?subject=${greetingSubject}&body=${greetingBody}`;

      return `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:12px 8px;font-weight:600;color:#1e293b;">${m.name}</td>
          <td style="padding:12px 8px;color:#64748b;">${bdayFormatted}</td>
          <td style="padding:12px 8px;color:#6366f1;font-weight:500;">${dayLabel}</td>
          <td style="padding:12px 8px;">
            ${m.email
              ? `<a href="${mailtoLink}" style="display:inline-block;background:#6366f1;color:white;padding:5px 14px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:500;">Send Greeting ✉️</a>`
              : '<span style="color:#94a3b8;font-size:13px;">No email</span>'
            }
          </td>
        </tr>`;
    }).join('');

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#1e3a8a 0%,#6366f1 100%);padding:32px 36px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:32px;">✝️</span>
        <div>
          <h1 style="margin:0;color:white;font-size:22px;font-weight:700;">Shepherd</h1>
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">Birthday Digest — ${weekLabel}</p>
        </div>
      </div>
    </div>

    <!-- Body -->
    <div style="padding:32px 36px;">
      <p style="color:#475569;margin:0 0 24px;">Here are upcoming member birthdays for <strong>${churchName}</strong> in the next 14 days. Click <em>Send Greeting</em> to open a pre-filled email draft.</p>

      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Member</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Birthday</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">When</th>
            <th style="padding:10px 8px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;">Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
        Sent weekly by Shepherd · <em>Members with birthdays in the next 14 days are included.</em>
      </p>
    </div>
  </div>
</body>
</html>`;

    // Send to each staff member
    for (const staff of staffList) {
      if (!staff.email) continue;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: staff.email,
        subject: `🎂 ${upcoming.length} Upcoming Birthday${upcoming.length !== 1 ? 's' : ''} — ${churchName} (${weekLabel})`,
        body: htmlBody,
        from_name: churchName || 'ShepherdSyncs',
      });
    }

    summary.push({ church: churchName, birthdays: upcoming.length, staffNotified: staffList.length });
  }

  return Response.json({ ok: true, processed: summary });
});