import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { churchId } = await req.json();

    if (!churchId) {
      return Response.json({ error: 'churchId is required' }, { status: 400 });
    }

    const events = await base44.asServiceRole.entities.ChurchEvent.filter(
      { church_id: churchId, is_published: true },
      'date',
      50
    );

    return Response.json(events);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});