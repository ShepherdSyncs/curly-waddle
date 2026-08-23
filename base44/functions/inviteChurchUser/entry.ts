import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Called by church admins to invite a new user to their church.
// 1. Invites the email as the specified role (via service role so church admins can invite).
// 2. Sends a branded welcome email with from_name = church name (appears as coming from the church).
// 3. Returns success/failure.

const ALLOWED_ROLES = ['church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker', 'user'];

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Only church admins (and global admins) can invite
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'global_admin' && user.role !== 'church_admin') {
      return Response.json({ error: 'Forbidden — church admin access required' }, { status: 403 });
    }

    const { email, inviteName, role, churchId, churchName, extraPermissions } = await req.json();

    if (!email) return Response.json({ error: 'Email is required' }, { status: 400 });
    const assignedRole = ALLOWED_ROLES.includes(role) ? role : 'user';

    // Determine church context
    const targetChurchId = churchId || user.church_id;
    const targetChurchName = churchName || '';

    if (!targetChurchId) {
      return Response.json({ error: 'No church context found for this admin' }, { status: 400 });
    }

    // Build the extra_permissions list — always include manage_members (members access)
    const perms = [...new Set(['manage_members', ...(Array.isArray(extraPermissions) ? extraPermissions : [])])];

    // 1. Invite the user (church admins can invite as "user")
    await base44.users.inviteUser(email, 'user');

    // 1b. Update the user's role (if non-default), extra_permissions, and church association
    try {
      const allUsers = await base44.asServiceRole.entities.User.list();
      const newUser = allUsers.find(u => u.email === email);
      if (newUser) {
        const updateData = { extra_permissions: perms, church_id: targetChurchId, church_name: targetChurchName };
        if (assignedRole !== 'user') {
          updateData.role = assignedRole;
        }
        await base44.asServiceRole.entities.User.update(newUser.id, updateData);
      }
    } catch (e) {
      // Update is best-effort; admin can set role/permissions manually from the user list
    }

    // 2. Build the signup/login URL
    const appUrl = 'https://app.shepherdsyncs.com';

    // 3. Send branded welcome email (from_name = church name so it appears from the church)
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:620px;margin:40px auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.09);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#071920 0%,#1F7A8C 100%);padding:36px 40px;text-align:center;">
      <h1 style="margin:0;color:white;font-size:26px;font-weight:800;letter-spacing:-0.5px;">ShepherdSyncs</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">Church Management Platform</p>
    </div>

    <!-- Body -->
    <div style="padding:36px 40px;">
      <h2 style="margin:0 0 6px;color:#071920;font-size:20px;">You're Invited! 🎉</h2>
      <p style="color:#475569;margin:0 0 20px;line-height:1.6;">
        ${inviteName ? `<strong>${inviteName}</strong>, you` : 'You'} have been invited to join <strong>${targetChurchName}</strong> on ShepherdSyncs.
        Your account has been set up with <strong>${assignedRole.replace(/_/g, ' ')}</strong> access.
      </p>

      <!-- CTA -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;font-weight:600;">Get Started</p>
        <p style="margin:0 0 14px;color:#334155;font-size:14px;">Click below to log in and set up your password. Use the email address this message was sent to.</p>
        <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#1F7A8C,#2FA4B5);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Access ShepherdSyncs →
        </a>
      </div>

      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
        Questions? Contact your church administrator at <a href="mailto:${user.email}" style="color:#1F7A8C;">${user.email}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">© 2024 ShepherdSyncs · All rights reserved</p>
    </div>
  </div>
</body>
</html>`;

    let emailSent = false;
    try {
      await base44.asServiceRole.integrations.Core.SendEmail({
        from_name: targetChurchName || 'ShepherdSyncs',
        to: email,
        subject: `You're invited to join ${targetChurchName} on ShepherdSyncs`,
        body: html,
      });
      emailSent = true;
    } catch (e) {
      // SendEmail only reaches registered users; the platform's inviteUser already
      // sent a default invitation email, so this branded email is best-effort.
    }

    return Response.json({ success: true, email, role: assignedRole, email_sent: emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}