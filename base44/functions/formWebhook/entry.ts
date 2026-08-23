import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // token + integrationId passed as payload fields
    const { integration_id, token, ...formData } = body;

    if (!integration_id || !token) {
      return Response.json({ error: 'Missing integration_id or token' }, { status: 400 });
    }

    // Load the integration config using service role (no user auth — this is a webhook)
    const integration = await base44.asServiceRole.entities.FormIntegration.get(integration_id);
    if (!integration) return Response.json({ error: 'Integration not found' }, { status: 404 });
    if (!integration.is_active) return Response.json({ error: 'Integration is disabled' }, { status: 403 });
    if (integration.webhook_token !== token) return Response.json({ error: 'Invalid token' }, { status: 403 });

    // Map incoming form fields to ChurchMember fields using field_map
    const fieldMap = integration.field_map || {};
    const memberData = { church_id: integration.church_id, status: 'visitor' };

    for (const [memberField, formField] of Object.entries(fieldMap)) {
      if (formField && formData[formField] !== undefined) {
        memberData[memberField] = formData[formField];
      }
    }

    // Fallback: try common field names if no map set
    if (!memberData.first_name) memberData.first_name = formData.first_name || formData.firstName || formData['First Name'] || '';
    if (!memberData.last_name) memberData.last_name = formData.last_name || formData.lastName || formData['Last Name'] || '';
    if (!memberData.email) memberData.email = formData.email || formData.Email || '';
    if (!memberData.phone) memberData.phone = formData.phone || formData.Phone || '';

    if (!memberData.first_name && !memberData.last_name) {
      return Response.json({ error: 'Could not extract name from form data' }, { status: 422 });
    }

    // Create ChurchMember record
    const member = await base44.asServiceRole.entities.ChurchMember.create(memberData);

    // Create FollowUpTask if enabled
    if (integration.create_follow_up !== false) {
      await base44.asServiceRole.entities.FollowUpTask.create({
        church_id: integration.church_id,
        visitor_name: `${memberData.first_name} ${memberData.last_name}`.trim(),
        visitor_email: memberData.email || '',
        visitor_phone: memberData.phone || '',
        type: 'visitor',
        status: 'pending',
        date_added: new Date().toISOString().split('T')[0],
        notes: `Submitted via form: ${integration.name}`,
      });
    }

    // Update stats on the integration
    await base44.asServiceRole.entities.FormIntegration.update(integration_id, {
      last_received_at: new Date().toISOString(),
      total_submissions: (integration.total_submissions || 0) + 1,
    });

    return Response.json({ success: true, member_id: member.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}