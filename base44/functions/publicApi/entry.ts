import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Public REST API for external/third-party integrations.
// Auth: `Authorization: Bearer <api_key>` header — NOT a Base44 user session.
// Every request is scoped to the key's own church_id, which is looked up
// server-side from the key itself; the church_id is never trusted from the
// client, so a key can never read or write another church's data.
//
// Usage:
//   GET    /functions/publicApi?resource=members              list
//   GET    /functions/publicApi?resource=members&id=<id>       get one
//   POST   /functions/publicApi?resource=members  (JSON body)   create
//   PATCH  /functions/publicApi?resource=members&id=<id>        update
//   DELETE /functions/publicApi?resource=members&id=<id>        delete

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const RATE_LIMIT_PER_MINUTE = 60;

const RESOURCE_MAP = {
  members: { entity: 'ChurchMember', readScope: 'members:read', writeScope: 'members:write' },
  events: { entity: 'ChurchEvent', readScope: 'events:read', writeScope: 'events:write' },
  attendance: { entity: 'AttendanceRecord', readScope: 'attendance:read', writeScope: 'attendance:write' },
  giving: { entity: 'GivingRecord', readScope: 'giving:read', writeScope: 'giving:write' },
  sermons: { entity: 'Sermon', readScope: 'sermons:read', writeScope: 'sermons:write' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // --- Authenticate via API key ---
    const authHeader = req.headers.get('Authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      return Response.json({ error: 'Missing Authorization: Bearer <api_key> header' }, { status: 401 });
    }
    const rawKey = match[1].trim();
    if (!rawKey.startsWith('sk_')) {
      return Response.json({ error: 'Invalid API key format' }, { status: 401 });
    }
    const keyHash = await sha256(rawKey);

    const keys = await base44.asServiceRole.entities.ApiKey.filter({ key_hash: keyHash });
    const apiKey = keys?.[0];
    if (!apiKey || !apiKey.is_active) {
      return Response.json({ error: 'Invalid or revoked API key' }, { status: 401 });
    }
    const churchId = apiKey.church_id;

    // --- Best-effort rate limiting (rolling 60s window per key) ---
    const now = new Date();
    const windowStart = apiKey.rate_limit_window_start ? new Date(apiKey.rate_limit_window_start) : null;
    let windowCount = apiKey.rate_limit_window_count || 0;
    let newWindowStart = windowStart;
    if (!windowStart || (now.getTime() - windowStart.getTime()) > 60000) {
      newWindowStart = now;
      windowCount = 0;
    }
    windowCount += 1;
    if (windowCount > RATE_LIMIT_PER_MINUTE) {
      return Response.json({ error: `Rate limit exceeded (${RATE_LIMIT_PER_MINUTE} requests/minute)` }, { status: 429 });
    }

    // Fire-and-forget usage tracking
    base44.asServiceRole.entities.ApiKey.update(apiKey.id, {
      last_used_at: now.toISOString(),
      request_count: (apiKey.request_count || 0) + 1,
      rate_limit_window_start: newWindowStart.toISOString(),
      rate_limit_window_count: windowCount,
    }).catch(() => {});

    // --- Parse request ---
    const url = new URL(req.url);
    const resource = url.searchParams.get('resource');
    const id = url.searchParams.get('id');
    const method = req.method.toUpperCase();

    if (!resource) {
      return Response.json({ error: 'Missing ?resource= query param', available_resources: Object.keys(RESOURCE_MAP) }, { status: 400 });
    }
    const config = RESOURCE_MAP[resource];
    if (!config) {
      return Response.json({ error: `Unknown resource '${resource}'`, available_resources: Object.keys(RESOURCE_MAP) }, { status: 400 });
    }

    const hasScope = (scope) => (apiKey.scopes || []).includes(scope);
    const entity = base44.asServiceRole.entities[config.entity];

    if (method === 'GET') {
      if (!hasScope(config.readScope)) {
        return Response.json({ error: `This key lacks the '${config.readScope}' scope` }, { status: 403 });
      }
      if (id) {
        const record = await entity.get(id);
        if (!record || record.church_id !== churchId) {
          return Response.json({ error: 'Not found' }, { status: 404 });
        }
        return Response.json({ data: record });
      }
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);
      const records = await entity.filter({ church_id: churchId }, '-created_date', limit);
      return Response.json({ data: records, count: records.length });
    }

    if (method === 'POST') {
      if (!hasScope(config.writeScope)) {
        return Response.json({ error: `This key lacks the '${config.writeScope}' scope` }, { status: 403 });
      }
      const body = await req.json();
      delete body.church_id;
      delete body.id;
      const created = await entity.create({ ...body, church_id: churchId });
      return Response.json({ data: created }, { status: 201 });
    }

    if (method === 'PATCH') {
      if (!hasScope(config.writeScope)) {
        return Response.json({ error: `This key lacks the '${config.writeScope}' scope` }, { status: 403 });
      }
      if (!id) return Response.json({ error: 'Missing ?id= for update' }, { status: 400 });
      const existing = await entity.get(id);
      if (!existing || existing.church_id !== churchId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const body = await req.json();
      delete body.church_id;
      delete body.id;
      const updated = await entity.update(id, body);
      return Response.json({ data: updated });
    }

    if (method === 'DELETE') {
      if (!hasScope(config.writeScope)) {
        return Response.json({ error: `This key lacks the '${config.writeScope}' scope` }, { status: 403 });
      }
      if (!id) return Response.json({ error: 'Missing ?id= for delete' }, { status: 400 });
      const existing = await entity.get(id);
      if (!existing || existing.church_id !== churchId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      await entity.delete(id);
      return Response.json({ success: true });
    }

    return Response.json({ error: `Method ${method} not supported` }, { status: 405 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
