import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { churchId } = await req.json();

    if (!churchId) {
      return Response.json({ error: 'churchId is required' }, { status: 400 });
    }

    const streams = await base44.asServiceRole.entities.LiveStream.filter(
      { church_id: churchId, is_archived: false },
      '-created_date',
      50
    );

    // Strip sensitive streaming credentials — only public playback data is exposed to viewers
    const publicStreams = streams.map((s) => ({
      id: s.id,
      church_id: s.church_id,
      title: s.title,
      description: s.description,
      status: s.status,
      thumbnail_url: s.thumbnail_url,
      playback_url: s.playback_url,
      mux_playback_id: s.mux_playback_id,
      started_at: s.started_at,
      ended_at: s.ended_at,
      scheduled_for: s.scheduled_for,
      viewer_count: s.viewer_count,
      chat_enabled: s.chat_enabled,
      is_archived: s.is_archived,
    }));
    return Response.json(publicStreams);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});