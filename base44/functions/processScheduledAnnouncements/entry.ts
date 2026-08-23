import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all scheduled announcements whose time has passed
    const now = new Date().toISOString();
    const scheduled = await base44.asServiceRole.entities.MinistryAnnouncement.filter({ status: 'scheduled' });
    const due = scheduled.filter(a => a.scheduled_for && a.scheduled_for <= now);

    // Early exit — nothing to process
    if (due.length === 0) return Response.json({ success: true, processed: 0 });

    let processed = 0;
    for (const announcement of due) {
      if (!announcement.send_email) {
        await base44.asServiceRole.entities.MinistryAnnouncement.update(announcement.id, { status: 'sent', email_sent: false });
        processed++;
        continue;
      }

      const members = await base44.asServiceRole.entities.MinistryGroupMember.filter({ group_id: announcement.group_id });
      const groups = await base44.asServiceRole.entities.MinistryGroup.filter({ id: announcement.group_id });
      const group = groups[0];

      for (const member of members) {
        if (!member.member_email) continue;
        await base44.asServiceRole.integrations.Core.SendEmail({
          from_name: group?.name || 'ShepherdSyncs',
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
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">Sent by ${announcement.sender_name || 'Ministry Leader'} · Shepherd Church App</p>
  </div>
</div>`,
        });
      }

      await base44.asServiceRole.entities.MinistryAnnouncement.update(announcement.id, {
        status: 'sent',
        email_sent: true,
      });
      processed++;
    }

    return Response.json({ success: true, processed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});