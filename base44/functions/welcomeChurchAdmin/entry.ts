import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Called after a new church is created by a global admin.
// 1. Invites the pastor email as a "church_admin" user.
// 2. Stores the admin_email on the church record.
// 3. Sends a branded welcome email with their signup link.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Only global admins can trigger this
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'global_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { churchId, pastorEmail, pastorName, churchName } = await req.json();

    if (!churchId || !pastorEmail) {
      return Response.json({ error: 'Missing churchId or pastorEmail' }, { status: 400 });
    }

    // Derive the signup slug (same logic as ChurchSignupLinks component)
    const slug = churchName
      ? churchName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      : churchId;

    const signupUrl = `${Deno.env.get('APP_URL') || 'https://app.shepherdsyncs.com'}/signup?church=${slug}`;
    const appUrl = Deno.env.get('APP_URL') || 'https://app.shepherdsyncs.com';

    // 1. Invite the pastor as church_admin
    await base44.asServiceRole.users.inviteUser(pastorEmail, 'church_admin');

    // 2. Save admin_email on the church record
    await base44.asServiceRole.entities.Church.update(churchId, { admin_email: pastorEmail });

    // 3. Ensure "Pastoral Staff" ministry group exists for this church, then add admin
    let pastoralGroup;
    const existingGroups = await base44.asServiceRole.entities.MinistryGroup.filter({
      church_id: churchId,
      name: 'Pastoral Staff',
    });
    if (existingGroups.length > 0) {
      pastoralGroup = existingGroups[0];
    } else {
      pastoralGroup = await base44.asServiceRole.entities.MinistryGroup.create({
        church_id: churchId,
        name: 'Pastoral Staff',
        description: 'Church administrative and pastoral leadership',
        category: 'pastoral',
        is_active: true,
        color: '#6366f1',
      });
    }

    // Add the admin as a member of Pastoral Staff (if not already)
    const existingMembers = await base44.asServiceRole.entities.MinistryGroupMember.filter({
      group_id: pastoralGroup.id,
      member_email: pastorEmail,
    });
    if (existingMembers.length === 0) {
      await base44.asServiceRole.entities.MinistryGroupMember.create({
        group_id: pastoralGroup.id,
        church_id: churchId,
        member_email: pastorEmail,
        member_name: pastorName || pastorEmail,
        role_in_group: 'Church Admin',
      });
    }

    // 3. Send welcome email
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
      <h2 style="margin:0 0 6px;color:#071920;font-size:20px;">Welcome, ${pastorName || 'Pastor'}! 🎉</h2>
      <p style="color:#475569;margin:0 0 20px;line-height:1.6;">
        Your church account for <strong>${churchName}</strong> has been set up on ShepherdSyncs. 
        You now have full <strong>Church Admin</strong> access and can start configuring your church right away.
      </p>

      <!-- CTA: Create Account -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;font-weight:600;">Step 1 — Create Your Account</p>
        <p style="margin:0 0 14px;color:#334155;font-size:14px;">Click below to log in and set up your password. Use the email address this message was sent to.</p>
        <a href="${appUrl}" style="display:inline-block;background:linear-gradient(135deg,#1F7A8C,#2FA4B5);color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
          Access ShepherdSyncs →
        </a>
      </div>

      <!-- Signup Link -->
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-size:13px;color:#16a34a;text-transform:uppercase;letter-spacing:.06em;font-weight:600;">Step 2 — Share Your Church Signup Link</p>
        <p style="margin:0 0 10px;color:#334155;font-size:14px;">Send this link to your members so they can request access to your church portal:</p>
        <div style="background:white;border:1px solid #d1fae5;border-radius:6px;padding:10px 14px;font-family:monospace;font-size:13px;color:#065f46;word-break:break-all;">
          ${signupUrl}
        </div>
      </div>

      <!-- What you can do -->
      <div style="margin-bottom:24px;">
        <p style="font-size:13px;color:#64748b;text-transform:uppercase;letter-spacing:.06em;font-weight:600;margin:0 0 10px;">What You Can Do</p>
        <ul style="margin:0;padding:0;list-style:none;">
          ${[
            '✅ Add and manage church members',
            '✅ Track attendance and giving',
            '✅ Manage ministry groups and schedules',
            '✅ Send announcements to your team',
            '✅ Review and approve new member signups',
            '✅ View analytics and spiritual records',
          ].map(item => `<li style="padding:5px 0;color:#334155;font-size:14px;">${item}</li>`).join('')}
        </ul>
      </div>

      <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
        Questions? Reply to this email or contact us at <a href="mailto:info@shepherdsyncs.com" style="color:#1F7A8C;">info@shepherdsyncs.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 40px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">© 2024 ShepherdSyncs · All rights reserved</p>
    </div>
  </div>
</body>
</html>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'ShepherdSyncs',
      to: pastorEmail,
      subject: `Welcome to ShepherdSyncs — ${churchName} is ready!`,
      body: html,
    });

    return Response.json({ success: true, signup_url: signupUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});