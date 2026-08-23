import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MUX_TOKEN_ID = Deno.env.get('MUX_TOKEN_ID');
const MUX_TOKEN_SECRET = Deno.env.get('MUX_TOKEN_SECRET');
const MUX_BASE = 'https://api.mux.com';

function muxAuth() {
  return 'Basic ' + btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
}

async function muxRequest(method, path) {
  const res = await fetch(`${MUX_BASE}${path}`, {
    method,
    headers: {
      'Authorization': muxAuth(),
      'Content-Type': 'application/json',
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.messages?.[0] || `Mux error: ${res.status}`);
  return json.data;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all active (live) streams
    const activeStreams = await base44.asServiceRole.entities.LiveStream.filter(
      { status: 'live' },
      '-started_at',
      100
    );

    if (activeStreams.length === 0) {
      return Response.json({ checked: 0, ended: 0 });
    }

    let ended = 0;

    // Check each stream's status in Mux
    for (const stream of activeStreams) {
      if (!stream.mux_live_stream_id) continue;

      const muxStream = await muxRequest('GET', `/video/v1/live-streams/${stream.mux_live_stream_id}`);
      
      // If stream is idle or disconnected, end it
      if (muxStream.status === 'idle' || muxStream.status === 'disconnected') {
        // Disable the Mux stream
        await muxRequest('PUT', `/video/v1/live-streams/${stream.mux_live_stream_id}/disable`);

        const endedAt = new Date().toISOString();
        await base44.asServiceRole.entities.LiveStream.update(stream.id, {
          status: 'ended',
          ended_at: endedAt,
        });

        // Auto-save to Sermon Archives
        await base44.asServiceRole.entities.Sermon.create({
          church_id: stream.church_id,
          title: stream.title,
          description: stream.description || '',
          date: endedAt.split('T')[0],
          video_url: stream.playback_url || '',
          is_published: true,
          speaker: '',
          tags: ['livestream'],
        });

        ended++;
      }
    }

    return Response.json({ checked: activeStreams.length, ended });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});