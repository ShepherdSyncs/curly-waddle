import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Ensures the "Pastoral Staff" MinistryGroup exists for a church
// and that the given admin email is a member of it.
// Called when a new church admin is granted access.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'global_admin' && user.role !== 'church_admin')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { churchId, adminEmail, adminName } = await req.json();
    if (!churchId || !adminEmail) {
      return Response.json({ error: 'Missing churchId or adminEmail' }, { status: 400 });
    }

    // Find or create Pastoral Staff group
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

    // Add admin as member if not already present
    const existingMembers = await base44.asServiceRole.entities.MinistryGroupMember.filter({
      group_id: pastoralGroup.id,
      member_email: adminEmail,
    });

    if (existingMembers.length === 0) {
      await base44.asServiceRole.entities.MinistryGroupMember.create({
        group_id: pastoralGroup.id,
        church_id: churchId,
        member_email: adminEmail,
        member_name: adminName || adminEmail,
        role_in_group: 'Church Admin',
      });
    }

    return Response.json({ success: true, group_id: pastoralGroup.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});