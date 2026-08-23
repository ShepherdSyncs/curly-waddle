import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { announcement_id, schedule_id } = await req.json();

    // Helper to get church name + signer for a given church_id and optional group
    async function getChurchContext(church_id, group) {
      let churchName = 'Your Church';
      let signerName = group?.leader_name || '';
      if (church_id) {
        const churches = await base44.asServiceRole.entities.Church.filter({ id: church_id });
        const church = churches[0];
        if (church) {
          churchName = church.name || churchName;
          if (!signerName) signerName = church.pastor_name || 'Pastor';
        }
      }
      if (!signerName) signerName = 'Ministry Leader';
      return { churchName, signerName };
    }

    if (announcement_id) {
      // Send announcement emails
      const announcements = await base44.asServiceRole.entities.MinistryAnnouncement.filter({ id: announcement_id });
      const announcement = announcements[0];
      if (!announcement) return Response.json({ error: 'Not found' }, { status: 404 });

      const members = await base44.asServiceRole.entities.MinistryGroupMember.filter({ group_id: announcement.group_id });
      const groups = await base44.asServiceRole.entities.MinistryGroup.filter({ id: announcement.group_id });
      const group = groups[0];
      const { churchName, signerName } = await getChurchContext(announcement.church_id, group);

      let sentCount = 0;
      for (const member of members) {
        if (!member.member_email) continue;
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: churchName,
          to: member.member_email,
          subject: `[${group?.name || 'Ministry'}] ${announcement.title}`,
          body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e3a5f; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">${group?.name || 'Ministry Group'}</h2>
    <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">${announcement.type.charAt(0).toUpperCase() + announcement.type.slice(1)}</p>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <h3 style="margin: 0 0 12px; color: #111827;">${announcement.title}</h3>
    <div style="color: #374151; line-height: 1.6; white-space: pre-wrap;">${announcement.body}</div>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="color: #374151; font-size: 14px; margin: 0 0 4px;">Blessings,</p>
    <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px;">${signerName}</p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${churchName}</p>
  </div>
</div>
          `,
        });
        sentCount++;
      }

      await base44.asServiceRole.entities.MinistryAnnouncement.update(announcement_id, {
        email_sent: true,
        status: 'sent',
      });

      return Response.json({ success: true, sent_to: sentCount });
    }

    if (schedule_id) {
      // Send schedule reminder
      const schedules = await base44.asServiceRole.entities.MinistrySchedule.filter({ id: schedule_id });
      const schedule = schedules[0];
      if (!schedule) return Response.json({ error: 'Not found' }, { status: 404 });

      const groups = await base44.asServiceRole.entities.MinistryGroup.filter({ id: schedule.group_id });
      const group = groups[0];
      const { churchName, signerName } = await getChurchContext(schedule.church_id, group);

      const assignees = schedule.assignees || [];
      let sentCount = 0;

      for (const assignee of assignees) {
        if (!assignee.member_email) continue;
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: churchName,
          to: assignee.member_email,
          subject: `Schedule Reminder: ${schedule.title}`,
          body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e3a5f; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">📅 Schedule Reminder</h2>
    <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">${group?.name || 'Ministry Group'}</p>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; margin: 0 0 16px;">Hi ${assignee.member_name || 'there'},</p>
    <h3 style="margin: 0 0 16px; color: #111827;">${schedule.title}</h3>
    <table style="width: 100%; border-collapse: collapse;">
      <tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px; width: 100px;">Date</td><td style="padding: 6px 0; font-weight: 600;">${schedule.date}</td></tr>
      ${schedule.time ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Time</td><td style="padding: 6px 0; font-weight: 600;">${schedule.time}${schedule.end_time ? ' – ' + schedule.end_time : ''}</td></tr>` : ''}
      ${schedule.location ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Location</td><td style="padding: 6px 0;">${schedule.location}</td></tr>` : ''}
      ${assignee.role ? `<tr><td style="padding: 6px 0; color: #6b7280; font-size: 14px;">Your Role</td><td style="padding: 6px 0;"><span style="background:#eff6ff;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:13px;">${assignee.role}</span></td></tr>` : ''}
    </table>
    ${schedule.notes ? `<div style="margin-top: 16px; padding: 12px; background: #f9fafb; border-radius: 6px; color: #374151; font-size: 14px;">${schedule.notes}</div>` : ''}
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="color: #374151; font-size: 14px; margin: 0 0 4px;">Blessings,</p>
    <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px;">${signerName}</p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${churchName}</p>
  </div>
</div>
          `,
        });
        sentCount++;
      }

      await base44.asServiceRole.entities.MinistrySchedule.update(schedule_id, { reminder_sent: true });

      return Response.json({ success: true, sent_to: sentCount });
    }

    return Response.json({ error: 'Missing announcement_id or schedule_id' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});