import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow scheduled (no user) or admin-triggered calls
    let user = null;
    try { user = await base44.auth.me(); } catch (_) {}
    if (user && user.role !== 'admin' && user.role !== 'global_admin' && user.role !== 'church_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get all active churches
    const churches = await base44.asServiceRole.entities.Church.list();
    const processed = [];

    for (const church of churches) {
      // Get upcoming events that have signup forms enabled
      const events = await base44.asServiceRole.entities.ChurchEvent.filter({
        church_id: church.id,
        enable_signup_form: true,
        is_published: true,
      });

      const upcomingEvents = events.filter(e => e.date >= todayStr);
      if (upcomingEvents.length === 0) continue;

      for (const event of upcomingEvents) {
        const signups = await base44.asServiceRole.entities.EventSignup.filter({ event_id: event.id });
        // Skip events with no signups — nothing to report
        if (signups.length === 0) continue;

        const totalAttendees = signups.reduce((sum, s) => sum + 1 + (s.guest_count || 0), 0);
        const signupLink = `https://app.base44.com/event-signup?event_id=${event.id}`;
        const adminLink = `https://app.base44.com/events?view_signups=${event.id}`;

        // Build the signups table
        const rows = signups.map(s => {
          const guestInfo = s.guest_count > 0
            ? `${s.guest_count} guest${s.guest_count !== 1 ? 's' : ''}${s.guest_names ? `: ${s.guest_names}` : ''}`
            : 'No guests';
          return `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px 12px;">${s.name}</td>
              <td style="padding:8px 12px;color:#64748b;">${s.email || '—'}</td>
              <td style="padding:8px 12px;color:#64748b;">${guestInfo}</td>
              <td style="padding:8px 12px;color:#64748b;">${s.notes || '—'}</td>
            </tr>`;
        }).join('');

        const emailBody = `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b;">
            <div style="background:linear-gradient(135deg,#1F7A8C,#2FA4B5);padding:24px 32px;border-radius:12px 12px 0 0;">
              <h2 style="color:white;margin:0;font-size:20px;">📋 Event Signup Update</h2>
              <p style="color:rgba(255,255,255,0.85);margin:6px 0 0;">${church.name}</p>
            </div>
            <div style="background:#f8fafc;padding:24px 32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
              <p style="margin:0 0 8px;">
                <strong>Event:</strong> ${event.title} on <strong>${event.date}</strong>${event.time ? ` at ${event.time}` : ''}
              </p>
              <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#1F7A8C;">
                ${signups.length} ${signups.length === 1 ? 'person has' : 'people have'} signed up · ${totalAttendees} total attendees
              </p>

              <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Name</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Email</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Guests</th>
                    <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase;">Notes</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>

              <div style="margin-top:20px;">
                <a href="${adminLink}" style="display:inline-block;background:#1F7A8C;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
                  View Full Signup List →
                </a>
              </div>
            </div>
          </div>`;

        // Collect emails to notify
        const notifyEmails = new Set();

        // Always notify church admins
        const adminEmails = church.admin_emails || (church.admin_email ? [church.admin_email] : []);
        adminEmails.forEach(e => e && notifyEmails.add(e));

        // Also notify the event's designated notify_email if set
        if (event.notify_email) notifyEmails.add(event.notify_email);

        for (const email of notifyEmails) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: email,
            subject: `Event "${event.title}" (${event.date}) — ${signups.length} signed up`,
            body: emailBody,
          });
        }

        processed.push({ event: event.title, date: event.date, signups: signups.length, totalAttendees, notified: [...notifyEmails] });
      }
    }

    return Response.json({ ok: true, processed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});