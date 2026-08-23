import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automated daily sweep: sends reminders for ministry schedules
// happening in the next REMINDER_WINDOWS days that haven't been reminded yet.

// Send reminders at 3 days ahead AND 1 day ahead (24h)
const REMINDER_WINDOWS = [3, 1];

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function buildEmailBody(schedule, group, assignee, daysLabel, churchName, signerName) {
  return `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e3a5f; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">📋 Upcoming Schedule Reminder</h2>
    <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">${group?.name || 'Ministry Group'} · ${daysLabel}</p>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; margin: 0 0 16px;">Hi ${assignee.member_name || 'there'},</p>
    <p style="color: #374151; margin: 0 0 20px;">This is a friendly reminder that you are scheduled to serve <strong>${daysLabel.toLowerCase()}</strong>.</p>
    <h3 style="margin: 0 0 12px; color: #111827;">${schedule.title}</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 100px;">Date</td><td style="padding: 6px 0; font-weight: 600;">${schedule.date}</td></tr>
      ${schedule.time ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Time</td><td style="padding: 6px 0; font-weight: 600;">${schedule.time}${schedule.end_time ? ' – ' + schedule.end_time : ''}</td></tr>` : ''}
      ${schedule.location ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Location</td><td style="padding: 6px 0;">${schedule.location}</td></tr>` : ''}
      ${assignee.role ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Your Role</td><td style="padding: 6px 0;"><span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:13px;">${assignee.role}</span></td></tr>` : ''}
    </table>
    ${schedule.notes ? `<div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; color: #374151; font-size: 14px;"><strong>Notes:</strong> ${schedule.notes}</div>` : ''}
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="color: #374151; font-size: 14px; margin: 0 0 4px;">Blessings,</p>
    <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px;">${signerName}</p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${churchName}</p>
  </div>
</div>`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (service role) and manual admin triggers
    try {
      const user = await base44.auth.me();
    } catch (_) {
      // Called from scheduler — no user context, proceed as service
    }

    const today = todayUTC();

    // Fetch all upcoming schedules with assignees
    const allSchedules = await base44.asServiceRole.entities.MinistrySchedule.list('-date', 500);

    // Filter schedules that fall exactly on a reminder window day (3 days out OR 1 day out)
    const targetDates = REMINDER_WINDOWS.map(d => addDays(today, d));

    const toRemind = allSchedules.filter(s =>
      targetDates.includes(s.date) &&
      s.assignees?.length > 0
    );

    let totalSent = 0;
    const results = [];

    for (const schedule of toRemind) {
      const daysUntil = Math.round((new Date(schedule.date + 'T00:00:00Z') - new Date(today + 'T00:00:00Z')) / (1000 * 60 * 60 * 24));
      const is3Day = daysUntil === 3;
      const is1Day = daysUntil === 1;

      // Skip if this window's reminder was already sent
      if (is3Day && schedule.reminder_3day_sent) continue;
      if (is1Day && schedule.reminder_sent) continue;

      const groups = await base44.asServiceRole.entities.MinistryGroup.filter({ id: schedule.group_id });
      const group = groups[0];

      // Get church info for the "from" name and footer
      let churchName = 'Your Church';
      let signerName = group?.leader_name || '';
      if (schedule.church_id) {
        const churches = await base44.asServiceRole.entities.Church.filter({ id: schedule.church_id });
        const church = churches[0];
        if (church) {
          churchName = church.name || churchName;
          // Use group leader, fall back to pastor name
          if (!signerName) {
            signerName = church.pastor_name || 'Pastor';
          }
        }
      }
      if (!signerName) signerName = 'Ministry Leader';

      const daysLabel = daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`;
      const windowLabel = is3Day ? '3-Day Reminder' : '24-Hour Reminder';

      const assignees = schedule.assignees || [];
      let sentCount = 0;

      for (const assignee of assignees) {
        if (!assignee.member_email) continue;

        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: churchName,
          to: assignee.member_email,
          subject: `[${windowLabel}] You're scheduled for "${schedule.title}" – ${daysLabel}`,
          body: buildEmailBody(schedule, group, assignee, daysLabel, churchName, signerName),
        });
        sentCount++;
        totalSent++;
      }

      // Mark the appropriate flag
      const updatePayload = is3Day
        ? { reminder_3day_sent: true }
        : { reminder_sent: true };
      await base44.asServiceRole.entities.MinistrySchedule.update(schedule.id, updatePayload);

      results.push({ schedule_id: schedule.id, title: schedule.title, date: schedule.date, window: windowLabel, sent_to: sentCount });
    }

    return Response.json({
      success: true,
      checked: toRemind.length,
      total_emails_sent: totalSent,
      reminders: results,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});