import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const churches = await base44.asServiceRole.entities.Church.filter({}, 'name', 200);
    // Return only public fields — strip sensitive integration credentials (Twilio, admin emails)
    const publicChurches = churches.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      subdomain: c.subdomain,
      city: c.city,
      state: c.state,
      phone: c.phone,
      email: c.email,
      pastor_name: c.pastor_name,
      logo_url: c.logo_url,
      status: c.status,
      livestream_enabled: c.livestream_enabled,
      online_giving_platform: c.online_giving_platform,
      online_giving_url: c.online_giving_url,
      ai_chat_enabled: c.ai_chat_enabled,
      ai_chat_description: c.ai_chat_description,
    }));
    return Response.json(publicChurches);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});