import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { churchId, userName, userEmail, invitationCode } = await req.json();

    if (!churchId || !userName || !userEmail || !invitationCode) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify a matching, pending invitation actually exists before sending any email —
    // prevents this endpoint being used to spam arbitrary church admin inboxes.
    const matchingInvitations = await base44.asServiceRole.entities.ChurchInvitation.filter({
      church_id: churchId,
      code: invitationCode,
      user_email: userEmail,
      status: 'pending',
    });
    if (matchingInvitations.length === 0) {
      return Response.json({ error: 'No matching invitation found' }, { status: 403 });
    }

    // Get church info
    const church = await base44.asServiceRole.entities.Church.filter({ id: churchId });
    if (!church || church.length === 0) {
      return Response.json({ error: 'Church not found' }, { status: 404 });
    }

    const churchData = church[0];
    const adminEmail = churchData.email;
    const verifyUrl = `${Deno.env.get('APP_URL') || 'https://shepherdsyncs.com'}/verify-member?code=${invitationCode}`;

    if (!adminEmail) {
      return Response.json({ error: 'Church has no email configured' }, { status: 400 });
    }

    const emailBody = `
Hi ${churchData.pastor_name || 'Pastor'},

A new member has signed up for ${churchData.name} using your church invitation link!

**Member Details:**
- Name: ${userName}
- Email: ${userEmail}

Please review and verify this member's information. You can also assign them to ministry groups during verification.

Click here to verify: ${verifyUrl}

Thanks,
ShepherdSyncs
    `.trim();

    await base44.integrations.Core.SendEmail({
      to: adminEmail,
      subject: `New Member Signed Up: ${userName}`,
      body: emailBody,
      from_name: 'ShepherdSyncs',
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});