import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { assignee_name, assignee_email, visitor_name, church_id } = await req.json();
    if (!assignee_email) return Response.json({ error: 'assignee_email is required' }, { status: 400 });

    // Get church name
    let churchName = 'Your Church';
    let pastorName = 'Church Leadership';
    if (church_id) {
      const churches = await base44.asServiceRole.entities.Church.filter({ id: church_id });
      const church = churches[0];
      if (church) {
        churchName = church.name || churchName;
        pastorName = church.pastor_name || pastorName;
      }
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: churchName,
      to: assignee_email,
      subject: `Follow-Up Assignment: ${visitor_name || 'New Visitor'}`,
      body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #1e3a5f; color: white; padding: 20px 24px; border-radius: 8px 8px 0 0;">
    <h2 style="margin: 0; font-size: 18px;">📋 Visitor Follow-Up Assignment</h2>
    <p style="margin: 4px 0 0; opacity: 0.8; font-size: 13px;">${churchName}</p>
  </div>
  <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
    <p style="color: #374151; margin: 0 0 16px;">Dear ${assignee_name || 'Ministry Leader'},</p>
    <p style="color: #374151; line-height: 1.7; margin: 0 0 16px;">
      You have been assigned a visitor follow-up task for <strong>${visitor_name || 'a recent visitor'}</strong>. 
      We ask that you reach out to them personally — whether by phone, email, or an in-person visit — 
      to welcome them, answer any questions they may have, and explore meaningful ways they can become 
      more engaged in the life and mission of our church community.
    </p>
    <p style="color: #374151; line-height: 1.7; margin: 0 0 16px;">
      Your care and outreach make a tremendous difference. Thank you for your faithful service.
    </p>
    <div style="background: #f0f9ff; border-left: 4px solid #1e3a5f; padding: 12px 16px; border-radius: 0 6px 6px 0; margin: 0 0 20px;">
      <p style="color: #374151; font-size: 14px; margin: 0 0 4px;"><strong>Visitor:</strong> ${visitor_name || '—'}</p>
      <p style="color: #6b7280; font-size: 13px; margin: 0;">Please log in to the church portal to view full contact details and update the task status.</p>
    </div>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;" />
    <p style="color: #374151; font-size: 14px; margin: 0 0 4px;">Blessings,</p>
    <p style="color: #374151; font-size: 14px; font-weight: 600; margin: 0 0 4px;">${pastorName}</p>
    <p style="color: #9ca3af; font-size: 12px; margin: 0;">${churchName}</p>
  </div>
</div>
      `,
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});