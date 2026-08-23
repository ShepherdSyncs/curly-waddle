import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Triggered when a new ChurchInvitation is created.
// If this is the first signup for a church (no existing verified admin),
// automatically approve them and grant church_admin role.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Verify this is a legitimate platform entity-automation event, not a direct HTTP call
    if (!event || event.type !== 'create' || event.entity_name !== 'ChurchInvitation') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!data || !data.church_id || !data.user_email) {
      return Response.json({ skipped: 'missing data' });
    }

    const { church_id, user_email, user_name, id: invitationId } = data;

    // Verify the invitation record actually exists, is pending, and matches the event payload
    const matchingInvitations = await base44.asServiceRole.entities.ChurchInvitation.filter({
      id: invitationId,
      church_id,
      user_email,
      status: 'pending',
    });
    if (matchingInvitations.length === 0) {
      return Response.json({ skipped: 'invitation not found or already processed' });
    }

    // Check if there are already any verified invitations for this church
    const existingVerified = await base44.asServiceRole.entities.ChurchInvitation.filter({
      church_id,
      status: 'verified',
    });

    if (existingVerified.length > 0) {
      return Response.json({ skipped: 'admin already exists' });
    }

    // Also check if church already has an admin_email set
    const churches = await base44.asServiceRole.entities.Church.filter({ id: church_id });
    const church = churches[0];
    if (!church) {
      return Response.json({ skipped: 'church not found' });
    }

    if (church.admin_email || (church.admin_emails && church.admin_emails.length > 0)) {
      return Response.json({ skipped: 'church already has admin email set' });
    }

    // No admin yet — auto-approve this signup as church_admin
    // 1. Mark invitation as verified
    await base44.asServiceRole.entities.ChurchInvitation.update(invitationId, {
      status: 'verified',
      verified_by: 'system',
      verified_at: new Date().toISOString(),
    });

    // 2. Update church admin_email
    await base44.asServiceRole.entities.Church.update(church_id, {
      admin_email: user_email,
      admin_emails: [user_email],
    });

    // 3. Invite/promote user as church_admin
    await base44.asServiceRole.users.inviteUser(user_email, 'church_admin');

    // 4. Ensure Pastoral Staff group exists and add them
    let pastoralGroup;
    const existingGroups = await base44.asServiceRole.entities.MinistryGroup.filter({
      church_id,
      name: 'Pastoral Staff',
    });
    if (existingGroups.length > 0) {
      pastoralGroup = existingGroups[0];
    } else {
      pastoralGroup = await base44.asServiceRole.entities.MinistryGroup.create({
        church_id,
        name: 'Pastoral Staff',
        description: 'Church administrative and pastoral leadership',
        category: 'pastoral',
        is_active: true,
        color: '#6366f1',
      });
    }

    const existingMembers = await base44.asServiceRole.entities.MinistryGroupMember.filter({
      group_id: pastoralGroup.id,
      member_email: user_email,
    });
    if (existingMembers.length === 0) {
      await base44.asServiceRole.entities.MinistryGroupMember.create({
        group_id: pastoralGroup.id,
        church_id,
        member_email: user_email,
        member_name: user_name || user_email,
        role_in_group: 'Church Admin',
      });
    }

    // 5. Send welcome email
    const appUrl = Deno.env.get('APP_URL') || 'https://app.shepherdsyncs.com';
    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'ShepherdSyncs',
      to: user_email,
      subject: `You've been granted admin access to ${church.name}!`,
      body: `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">
    <div style="background:linear-gradient(135deg,#071920 0%,#1F7A8C 100%);padding:36px 40px;text-align:center;">
      <h1 style="margin:0;color:white;font-size:26px;font-weight:800;">ShepherdSyncs</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Church Management Platform</p>
    </div>
    <div style="padding:36px 40px;">
      <h2 style="margin:0 0 12px;color:#071920;">Welcome, ${user_name || 'Pastor'}! 🎉</h2>
      <p style="color:#475569;line-height:1.6;margin:0 0 20px;">
        You've been automatically granted <strong>Church Admin</strong> access for <strong>${church.name}</strong> as the first member to sign up.
      </p>
      <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#1F7A8C,#2FA4B5);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
        Access Your Dashboard →
      </a>
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;">
        Questions? Contact us at <a href="mailto:info@shepherdsyncs.com" style="color:#1F7A8C;">info@shepherdsyncs.com</a>
      </p>
    </div>
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">© 2024 ShepherdSyncs · All rights reserved</p>
    </div>
  </div>
</body>
</html>`,
    });

    return Response.json({ success: true, promoted: user_email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});