import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID');
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET');
const MUX_BASE = 'https://api.mux.com';

function muxAuth() {
  return 'Basic ' + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
}

async function muxRequest(method, path, body) {
  const res = await fetch(`${MUX_BASE}${path}`, {
    method,
    headers: {
      'Authorization': muxAuth(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.messages?.[0] || `Mux error: ${res.status}`);
  return json.data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'church_admin' || user.role === 'global_admin' || user.role === 'admin';
    if (!isAdmin) return Response.json({ error: 'Church admin access required' }, { status: 403 });
    const isGlobalAdmin = user.role === 'global_admin' || user.role === 'admin';

    const body = await req.json();
    const { action, stream_id, title, description, destinations, source_stream_id, scheduled_for } = body;

    const churchId = user.church_id || body.church_id;

    // For any action operating on an existing stream_id, verify it actually
    // belongs to this admin's own church before allowing any changes to it.
    if (stream_id && !isGlobalAdmin) {
      const target = await base44.asServiceRole.entities.LiveStream.get(stream_id);
      if (!target || target.church_id !== churchId) {
        return Response.json({ error: 'Stream not found for your church' }, { status: 403 });
      }
    }

    // ── CREATE: provisions a Mux Live Stream ──────────────────────────────────
    if (action === 'create') {
      if (!churchId) return Response.json({ error: 'church_id required' }, { status: 400 });

      // Create Mux live stream (low-latency)
      const muxStream = await muxRequest('POST', '/video/v1/live-streams', {
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        latency_mode: 'low',
        reconnect_window: 60,
      });

      const streamKey = muxStream.stream_key;
      const muxId = muxStream.id;
      const playbackId = muxStream.playback_ids?.[0]?.id;
      const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : '';

      const stream = await base44.asServiceRole.entities.LiveStream.create({
        church_id: churchId,
        title: title || 'Sunday Service',
        description: description || '',
        status: 'idle',
        stream_key: streamKey,
        playback_url: playbackUrl,
        destinations: [],
        chat_enabled: true,
        is_archived: false,
        mux_live_stream_id: muxId,
        mux_playback_id: playbackId,
      });

      return Response.json({
        stream,
        rtmp_ingest: 'rtmps://global-live.mux.com:443/app',
        stream_key: streamKey,
      });
    }

    // ── SCHEDULE: creates a LiveStream record reusing an existing stream's Mux credentials ──
    if (action === 'schedule') {
      if (!churchId) return Response.json({ error: 'church_id required' }, { status: 400 });
      if (!source_stream_id) return Response.json({ error: 'source_stream_id required' }, { status: 400 });

      const source = await base44.asServiceRole.entities.LiveStream.get(source_stream_id);
      if (!source) return Response.json({ error: 'Source stream not found' }, { status: 404 });
      if (!isGlobalAdmin && source.church_id !== churchId) {
        return Response.json({ error: 'Source stream not found for your church' }, { status: 403 });
      }
      if (!source.stream_key) return Response.json({ error: 'Source stream has no stream key' }, { status: 400 });

      const stream = await base44.asServiceRole.entities.LiveStream.create({
        church_id: churchId,
        title: title || 'Scheduled Service',
        description: description || '',
        status: 'idle',
        stream_key: source.stream_key,
        playback_url: source.playback_url || '',
        mux_live_stream_id: source.mux_live_stream_id || '',
        mux_playback_id: source.mux_playback_id || '',
        destinations: [],
        chat_enabled: true,
        is_archived: false,
        scheduled_for: scheduled_for || null,
        source_stream_id: source_stream_id,
      });

      return Response.json({
        stream,
        rtmp_ingest: 'rtmps://global-live.mux.com:443/app',
        stream_key: source.stream_key,
      });
    }

    // ── ADD SIMULCAST DESTINATION (YouTube / Facebook / custom) ──────────────
    if (action === 'add_simulcast') {
      const { rtmp_url, stream_key: destKey, platform } = body;
      const dbStream = await base44.asServiceRole.entities.LiveStream.get(stream_id);
      if (!dbStream.mux_live_stream_id) return Response.json({ error: 'No Mux stream found' }, { status: 400 });

      const simulcast = await muxRequest('POST', `/video/v1/live-streams/${dbStream.mux_live_stream_id}/simulcast-targets`, {
        url: rtmp_url,
        stream_key: destKey,
        passthrough: platform,
      });

      const updatedDests = [...(dbStream.destinations || []), {
        platform,
        rtmp_url,
        stream_key: destKey,
        enabled: true,
        mux_simulcast_id: simulcast.id,
      }];

      const stream = await base44.asServiceRole.entities.LiveStream.update(stream_id, {
        destinations: updatedDests,
      });

      return Response.json({ stream, simulcast });
    }

    // ── REMOVE SIMULCAST DESTINATION ─────────────────────────────────────────
    if (action === 'remove_simulcast') {
      const { simulcast_id, dest_index } = body;
      const dbStream = await base44.asServiceRole.entities.LiveStream.get(stream_id);

      if (dbStream.mux_live_stream_id && simulcast_id) {
        await muxRequest('DELETE', `/video/v1/live-streams/${dbStream.mux_live_stream_id}/simulcast-targets/${simulcast_id}`);
      }

      const updatedDests = (dbStream.destinations || []).filter((_, i) => i !== dest_index);
      const stream = await base44.asServiceRole.entities.LiveStream.update(stream_id, { destinations: updatedDests });
      return Response.json({ stream });
    }

    // ── GO LIVE ───────────────────────────────────────────────────────────────
    if (action === 'go_live') {
      const stream = await base44.asServiceRole.entities.LiveStream.update(stream_id, {
        status: 'live',
        started_at: new Date().toISOString(),
      });
      return Response.json({ stream });
    }

    // ── END STREAM ────────────────────────────────────────────────────────────
    if (action === 'end_stream') {
      const dbStream = await base44.asServiceRole.entities.LiveStream.get(stream_id);

      // Only disable the Mux live stream for master streams (not scheduled copies that share credentials)
      if (dbStream.mux_live_stream_id && !dbStream.source_stream_id) {
        await muxRequest('PUT', `/video/v1/live-streams/${dbStream.mux_live_stream_id}/disable`, {});
      }

      const endedAt = new Date().toISOString();
      const stream = await base44.asServiceRole.entities.LiveStream.update(stream_id, {
        status: 'ended',
        ended_at: endedAt,
      });

      // Auto-save to Sermon Archives
      await base44.asServiceRole.entities.Sermon.create({
        church_id: dbStream.church_id,
        title: dbStream.title,
        description: dbStream.description || '',
        date: endedAt.split('T')[0],
        video_url: dbStream.playback_url || '',
        is_published: true,
        speaker: '',
        tags: ['livestream'],
      });

      return Response.json({ stream });
    }

    // ── DELETE MUX STREAM (cleanup) ───────────────────────────────────────────
    if (action === 'delete_mux') {
      const dbStream = await base44.asServiceRole.entities.LiveStream.get(stream_id);
      if (dbStream.mux_live_stream_id) {
        await muxRequest('DELETE', `/video/v1/live-streams/${dbStream.mux_live_stream_id}`);
      }
      await base44.asServiceRole.entities.LiveStream.delete(stream_id);
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});