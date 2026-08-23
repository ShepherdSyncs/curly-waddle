import React, { useState } from 'react';
import StreamCommentsAdmin from '@/components/StreamCommentsAdmin';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Radio, Plus, Trash2, Settings, Copy, ExternalLink,
  Play, Square, Eye, Share2, ChevronDown, ChevronUp, Tv2, CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import StreamKeyBox from '@/components/StreamKeyBox';

const SERVICE_TIME_PRESETS = [
  { label: 'Sunday 9:00 AM', get: () => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7); d.setHours(9, 0, 0, 0); return d; },
    label2: 'Sunday 11:00 AM', get2: () => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7); d.setHours(11, 0, 0, 0); return d; } },
  { label: 'Sunday 6:00 PM', get: () => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay()) % 7 || 7); d.setHours(18, 0, 0, 0); return d; } },
  { label: 'Wednesday 7:00 PM', get: () => { const d = new Date(); const day = d.getDay(); const diff = (3 - day + 7) % 7 || 7; d.setDate(d.getDate() + diff); d.setHours(19, 0, 0, 0); return d; } },
];

const MUX_RTMP_SERVER = 'rtmps://global-live.mux.com:443/app';

const PLATFORM_PRESETS = [
  { name: 'YouTube', rtmp_url: 'rtmp://a.rtmp.youtube.com/live2' },
  { name: 'Facebook', rtmp_url: 'rtmps://live-api-s.facebook.com:443/rtmp' },
  { name: 'Twitch', rtmp_url: 'rtmp://live.twitch.tv/live' },
  { name: 'Custom RTMP', rtmp_url: '' },
];

export default function LiveStreamAdmin() {
  const { user, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [configStream, setConfigStream] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newChurchId, setNewChurchId] = useState('');
  const [destForm, setDestForm] = useState({ platform: 'YouTube', rtmp_url: PLATFORM_PRESETS[0].rtmp_url, stream_key: '' });
  const [addingDest, setAddingDest] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledFor, setScheduledFor] = useState('');
  const [reuseFrom, setReuseFrom] = useState('');

  const { data: churches = [] } = useQuery({
    queryKey: ['churches'],
    queryFn: () => base44.entities.Church.list(),
    enabled: !!isGlobalAdmin,
  });

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['livestreams', user?.church_id],
    queryFn: () => user?.church_id
      ? base44.entities.LiveStream.filter({ church_id: user.church_id, is_archived: false }, '-created_date', 50)
      : base44.entities.LiveStream.filter({ is_archived: false }, '-created_date', 50),
    enabled: !!user,
  });

  const invoke = (action, extra = {}) =>
    base44.functions.invoke('streamManager', { action, ...extra });

  const createStream = async () => {
    if (!newTitle.trim()) return;
    const effectiveChurchId = user?.church_id || newChurchId;
    if (!effectiveChurchId) { toast.error('Please select a church'); return; }

    if (isScheduling) {
      if (!reuseFrom) { toast.error('Select a stream to reuse the key from'); return; }
      if (!scheduledFor) { toast.error('Please pick a date and time'); return; }
      toast.loading('Scheduling service…', { id: 'create' });
      try {
        const res = await invoke('schedule', {
          title: newTitle, description: newDesc, church_id: effectiveChurchId,
          source_stream_id: reuseFrom, scheduled_for: new Date(scheduledFor).toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ['livestreams'] });
        toast.dismiss('create');
        setCreateOpen(false);
        setNewTitle(''); setNewDesc(''); setNewChurchId('');
        setIsScheduling(false); setScheduledFor(''); setReuseFrom('');
        toast.success('Service scheduled — same stream key & RTMP as the source');
        setConfigStream(res.stream || res.data?.stream);
      } catch (e) {
        toast.dismiss('create');
        toast.error(e.message || 'Failed to schedule');
      }
      return;
    }

    toast.loading('Creating Mux live stream…', { id: 'create' });
    try {
      const res = await invoke('create', { title: newTitle, description: newDesc, church_id: effectiveChurchId });
      queryClient.invalidateQueries({ queryKey: ['livestreams'] });
      toast.dismiss('create');
      setCreateOpen(false);
      setNewTitle(''); setNewDesc(''); setNewChurchId('');
      toast.success('Stream created — your RTMP key is ready');
      setConfigStream(res.stream || res.data?.stream);
    } catch (e) {
      toast.dismiss('create');
      toast.error(e.message || 'Failed to create stream');
    }
  };

  const goLive = async (stream) => {
    await invoke('go_live', { stream_id: stream.id });
    queryClient.invalidateQueries({ queryKey: ['livestreams'] });
    toast.success('Stream marked as LIVE — start OBS now');
  };

  const endStream = async (stream) => {
    await invoke('end_stream', { stream_id: stream.id });
    queryClient.invalidateQueries({ queryKey: ['livestreams'] });
    toast.success('Stream ended');
    if (configStream?.id === stream.id) setConfigStream(null);
  };

  const addDestination = async () => {
    if (!destForm.rtmp_url || !destForm.stream_key) { toast.error('RTMP URL and stream key required'); return; }
    setAddingDest(true);
    await invoke('add_simulcast', {
      stream_id: configStream.id,
      rtmp_url: destForm.rtmp_url,
      stream_key: destForm.stream_key,
      platform: destForm.platform,
    });
    queryClient.invalidateQueries({ queryKey: ['livestreams'] });
    // refresh configStream
    const updated = await base44.entities.LiveStream.filter({ church_id: configStream.church_id }, '-created_date', 50);
    const fresh = updated.find(s => s.id === configStream.id);
    if (fresh) setConfigStream(fresh);
    setDestForm({ platform: 'YouTube', rtmp_url: PLATFORM_PRESETS[0].rtmp_url, stream_key: '' });
    setAddingDest(false);
    toast.success('Simulcast destination added');
  };

  const removeDestination = async (dest, idx) => {
    await invoke('remove_simulcast', {
      stream_id: configStream.id,
      simulcast_id: dest.mux_simulcast_id,
      dest_index: idx,
    });
    queryClient.invalidateQueries({ queryKey: ['livestreams'] });
    setConfigStream(prev => ({ ...prev, destinations: (prev.destinations || []).filter((_, i) => i !== idx) }));
    toast.success('Destination removed');
  };

  const archiveStream = async (stream) => {
    await base44.entities.LiveStream.update(stream.id, { is_archived: true });
    queryClient.invalidateQueries({ queryKey: ['livestreams'] });
    toast.success('Archived');
  };

  const publicUrl = (stream) => `${window.location.origin}/live?church=${stream.church_id}`;

  if (!isChurchAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Church Admin access required</div>;
  }

  const liveNow = streams.find(s => s.status === 'live');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
            <Radio className="w-6 h-6 text-red-500" />
            Live Stream
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Powered by Mux — RTMP ingest, HLS playback, simulcast</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.church_id && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(publicUrl({ church_id: user.church_id })); toast.success('Public link copied!'); }}>
              <Share2 className="w-3.5 h-3.5" /> Copy Public Link
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> New Stream
          </Button>
        </div>
      </div>

      {/* How it works */}
      <Card className="border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800">
        <CardContent className="p-4 text-sm text-blue-800 dark:text-blue-300 space-y-1">
          <p className="font-semibold flex items-center gap-2"><Tv2 className="w-4 h-4" /> How to go live</p>
          <ol className="list-decimal ml-5 space-y-1 text-xs">
            <li>Click <strong>New Stream</strong> to create a Mux live stream session.</li>
            <li>Click <strong>Configure</strong> on the stream — copy the <strong>RTMP Server</strong> and <strong>Stream Key</strong>.</li>
            <li>In OBS: <em>Settings → Stream → Custom</em>. Paste server &amp; key. Click <strong>Start Streaming</strong>.</li>
            <li>Optionally add <strong>Simulcast Destinations</strong> (YouTube, Facebook) in the Configure panel — Mux will forward your stream automatically.</li>
            <li>Click <strong>Go Live</strong> here so your congregation can watch on the public page.</li>
            <li>Click <strong>End Stream</strong> when done.</li>
          </ol>
        </CardContent>
      </Card>

      {/* Live now banner */}
      {liveNow && (
        <Card className="border-red-300 bg-red-50 dark:bg-red-900/10">
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-700 dark:text-red-300">{liveNow.title}</p>
                <p className="text-xs text-red-500">Live since {liveNow.started_at ? format(new Date(liveNow.started_at), 'h:mm a') : '…'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => window.open(publicUrl(liveNow), '_blank')}>
                <Eye className="w-3.5 h-3.5" /> View Public
              </Button>
              <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={() => endStream(liveNow)}>
                <Square className="w-3.5 h-3.5" /> End Stream
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Streams list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <div className="space-y-3">
          {streams.map(stream => (
            <Card key={stream.id} className={stream.status === 'live' ? 'ring-2 ring-red-400' : ''}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="w-24 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Radio className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{stream.title}</span>
                      <Badge variant="outline" className={
                        stream.status === 'live' ? 'border-red-400 text-red-600 bg-red-50' :
                        stream.status === 'ended' ? 'border-green-300 text-green-600 bg-green-50' :
                        'border-gray-300 text-gray-500'
                      }>
                        {stream.status === 'live' ? '● LIVE' : stream.status}
                      </Badge>
                    </div>
                    {stream.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{stream.description}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {format(new Date(stream.created_date), 'MMM d, yyyy')}
                      {stream.destinations?.length > 0 && ` · ${stream.destinations.length} simulcast${stream.destinations.length !== 1 ? 's' : ''}`}
                      {stream.source_stream_id && ' · Reuses shared key'}
                    </p>
                    {stream.scheduled_for && (
                      <Badge variant="outline" className="border-blue-300 text-blue-600 bg-blue-50 text-xs">
                        <CalendarClock className="w-3 h-3 mr-1" />
                        {format(new Date(stream.scheduled_for), 'MMM d, h:mm a')}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setConfigStream(stream)}>
                      <Settings className="w-3.5 h-3.5" /> Configure
                    </Button>
                    {stream.status === 'idle' && (
                      <Button size="sm" className="text-xs gap-1 bg-red-500 hover:bg-red-600" onClick={() => goLive(stream)}>
                        <Play className="w-3.5 h-3.5" /> Go Live
                      </Button>
                    )}
                    {stream.status === 'live' && (
                      <Button size="sm" variant="destructive" className="text-xs gap-1" onClick={() => endStream(stream)}>
                        <Square className="w-3.5 h-3.5" /> End
                      </Button>
                    )}
                    {stream.status === 'ended' && (
                      <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={() => archiveStream(stream)}>
                        Archive
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {streams.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No streams yet. Create your first stream session.</p>
            </div>
          )}
        </div>
      )}

      {/* Create Stream Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Stream Session</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {isGlobalAdmin && !user?.church_id && (
              <div>
                <Label>Church *</Label>
                <Select value={newChurchId} onValueChange={setNewChurchId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select a church" /></SelectTrigger>
                  <SelectContent>
                    {churches.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Service Title *</Label><Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Sunday Morning Service" /></div>
            <div><Label>Description</Label><Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional description" /></div>

            {/* Schedule toggle */}
            <div className="p-3 rounded-lg border border-dashed space-y-3">
              <button type="button" onClick={() => setIsScheduling(!isScheduling)} className="flex items-center gap-2 text-sm font-medium w-full text-left">
                <CalendarClock className="w-4 h-4 text-primary" />
                Schedule in advance
                <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${isScheduling ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {isScheduling ? 'ON' : 'OFF'}
                </span>
              </button>
              {isScheduling && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">Schedule a future service that reuses an existing stream's RTMP server &amp; stream key — configure OBS once, use it for every scheduled service.</p>
                  <div>
                    <Label className="text-xs">Reuse stream key from *</Label>
                    <Select value={reuseFrom} onValueChange={setReuseFrom}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select an existing stream" /></SelectTrigger>
                      <SelectContent>
                        {streams.filter(s => s.stream_key && !s.source_stream_id).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Date &amp; Time *</Label>
                    <Input type="datetime-local" value={scheduledFor} onChange={e => setScheduledFor(e.target.value)} className="mt-1" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {SERVICE_TIME_PRESETS.map(p => (
                      <button key={p.label} type="button" onClick={() => setScheduledFor(p.get().toISOString().slice(0,16))}
                        className="text-xs px-2 py-1 rounded-lg border hover:bg-muted">
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {!isScheduling && (
              <p className="text-xs text-muted-foreground">A Mux live stream will be provisioned automatically. You'll receive the RTMP server &amp; stream key after creation.</p>
            )}
            <Button className="w-full" onClick={createStream} disabled={!newTitle.trim() || (isGlobalAdmin && !user?.church_id && !newChurchId) || (isScheduling && (!reuseFrom || !scheduledFor))}>
              {isScheduling ? 'Schedule Service' : 'Create Stream Session'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Configure Stream Dialog */}
      <Dialog open={!!configStream} onOpenChange={v => !v && setConfigStream(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Configure: {configStream?.title}</DialogTitle></DialogHeader>
          {configStream && (
            <div className="space-y-5 mt-2">

              {/* OBS / Encoder setup */}
              <div className="p-3 rounded-lg bg-muted/50 border space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">OBS / Encoder Settings</p>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">RTMP Server (paste into OBS → Stream → Server)</p>
                  <StreamKeyBox label="RTMP Server" value={MUX_RTMP_SERVER} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Stream Key (paste into OBS → Stream → Stream Key)</p>
                  <StreamKeyBox label="Stream Key" value={configStream.stream_key} />
                </div>
                <p className="text-xs text-muted-foreground pt-1">In OBS: <em>Settings → Stream → Service: Custom</em>. Paste the server &amp; key above, then click <strong>Start Streaming</strong>.</p>
              </div>

              {/* HLS Playback URL (read-only info) */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">HLS Playback URL (auto-generated)</p>
                <StreamKeyBox label="Playback URL" value={configStream.playback_url || 'Will be available once stream is active'} />
                <p className="text-xs text-muted-foreground mt-1">This is shown automatically to viewers on your public page — no configuration needed.</p>
              </div>

              {/* Simulcast Destinations */}
              <div>
                <p className="text-sm font-semibold mb-1">Simulcast Destinations</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Mux will re-stream to these platforms automatically while you stream via OBS. Add your YouTube / Facebook stream keys here.
                </p>

                {(configStream.destinations || []).map((dest, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 mb-2 rounded-lg bg-muted/50 border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{dest.platform}</p>
                      <p className="text-xs text-muted-foreground truncate">{dest.rtmp_url}</p>
                      <p className="text-xs text-muted-foreground">Key: {dest.stream_key ? `${dest.stream_key.substring(0, 8)}…` : '(none)'}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => removeDestination(dest, idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}

                <div className="p-3 rounded-lg border border-dashed space-y-3">
                  <p className="text-xs font-medium text-muted-foreground">Add Simulcast Destination</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORM_PRESETS.map(p => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => setDestForm(prev => ({ ...prev, platform: p.name, rtmp_url: p.rtmp_url }))}
                        className={`text-xs px-2 py-1.5 rounded-lg border transition-colors text-left ${destForm.platform === p.name ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted border-border'}`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                  <div>
                    <Label className="text-xs">RTMP URL</Label>
                    <Input className="mt-1 text-xs" value={destForm.rtmp_url} onChange={e => setDestForm({ ...destForm, rtmp_url: e.target.value })} placeholder="rtmp://..." />
                  </div>
                  <div>
                    <Label className="text-xs">Stream Key (from YouTube / Facebook Studio)</Label>
                    <Input className="mt-1 text-xs" value={destForm.stream_key} onChange={e => setDestForm({ ...destForm, stream_key: e.target.value })} placeholder="Paste stream key from platform" />
                  </div>
                  <Button size="sm" className="w-full" onClick={addDestination} disabled={addingDest}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> {addingDest ? 'Adding…' : 'Add Simulcast Destination'}
                  </Button>
                </div>
              </div>

              {/* Public Link */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Public Viewer Link</p>
                <StreamKeyBox label="Public Link" value={publicUrl(configStream)} />
              </div>

              {/* Comments */}
              <StreamCommentsAdmin streamId={configStream?.id} />

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t">
                {configStream.status === 'idle' && (
                  <Button className="flex-1 bg-red-500 hover:bg-red-600 gap-2" onClick={() => { goLive(configStream); setConfigStream(null); }}>
                    <Play className="w-4 h-4" /> Go Live
                  </Button>
                )}
                {configStream.status === 'live' && (
                  <Button className="flex-1" variant="destructive" onClick={() => endStream(configStream)}>
                    <Square className="w-4 h-4 mr-2" /> End Stream
                  </Button>
                )}
                <Button variant="outline" onClick={() => window.open(publicUrl(configStream), '_blank')} className="gap-1.5">
                  <Eye className="w-4 h-4" /> Preview
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}