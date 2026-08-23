import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Self-healing fix: many existing accounts (church admins verified via VerifyMembers.jsx,
// and the very first admin approved via autoApproveFirstAdmin) never had `church_id`
// persisted onto their actual User record — it was only ever derived client-side each
// session. This function independently re-derives the correct church_id/church_name
// SERVER-SIDE (never trusting anything the client passes in, since blindly trusting a
// client-supplied churchId would let a user claim membership in any church) and persists
// it, so future RLS rules that key off the user's own church_id work correctly.
//
// Safe to call on every app load — it's a no-op once church_id is already set correctly.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isGlobalAdmin = user.role === 'global_admin' || user.role === 'admin';
    if (isGlobalAdmin) {
      // Global admins are intentionally not scoped to a single church
      return Response.json({ skipped: 'global admin' });
    }

    let derivedChurchId = null;
    let derivedChurchName = null;

    if (user.role === 'church_admin') {
      const churches = await base44.asServiceRole.entities.Church.filter({});
      const matches = (churches || []).filter(c =>
        c.admin_email === user.email || (c.admin_emails || []).includes(user.email)
      );
      if (matches.length === 1) {
        derivedChurchId = matches[0].id;
        derivedChurchName = matches[0].name;
      } else if (matches.length > 1) {
        // Admin on multiple churches (e.g. a cross-church support account) —
        // don't arbitrarily lock them into just one. This account likely needs
        // 'global_admin' instead of 'church_admin' to keep working correctly.
        return Response.json({ skipped: 'admin on multiple churches — needs manual role review', churches: matches.map(c => ({ id: c.id, name: c.name })) });
      }
    } else {
      // Regular members / staff — derive from a verified invitation
      const invitations = await base44.asServiceRole.entities.ChurchInvitation.filter({
        user_email: user.email,
        status: 'verified',
      });
      if (invitations.length > 0) {
        derivedChurchId = invitations[0].church_id;
        const churches = await base44.asServiceRole.entities.Church.filter({ id: derivedChurchId });
        if (churches.length > 0) derivedChurchName = churches[0].name;
      }
    }

    if (!derivedChurchId) {
      return Response.json({ skipped: 'no church association found' });
    }

    if (user.church_id === derivedChurchId && user.church_name === derivedChurchName) {
      return Response.json({ ok: true, unchanged: true, church_id: derivedChurchId });
    }

    await base44.asServiceRole.entities.User.update(user.id, {
      church_id: derivedChurchId,
      church_name: derivedChurchName || undefined,
    });

    return Response.json({ ok: true, church_id: derivedChurchId, church_name: derivedChurchName });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
