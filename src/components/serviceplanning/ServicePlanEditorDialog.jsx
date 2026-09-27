import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, Trash2, Plus, Music, Loader2, Megaphone, Printer, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { generateServicePlanPdf } from '@/lib/servicePlanPdf';

const SERVICE_TYPES = [
  { value: 'sunday_morning', label: 'Sunday Morning' },
  { value: 'sunday_evening', label: 'Sunday Evening' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'special_event', label: 'Special Event' },
  { value: 'other', label: 'Other' },
];

export default function ServicePlanEditorDialog({ churchId, church, plan, groups = [], onClose }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isNew = !plan?.id;
  const [meta, setMeta] = useState({
    service_date: plan?.service_date || '',
    title: plan?.title || 'Sunday Service',
    service_type: plan?.service_type || 'sunday_morning',
    notes: plan?.notes || '',
    group_id: plan?.group_id || '',
  });
  const [savingMeta, setSavingMeta] = useState(false);
  const [planId, setPlanId] = useState(plan?.id || null);
  const [addSongId, setAddSongId] = useState('');
  const [adHocTitle, setAdHocTitle] = useState('');
  const [newAnnouncement, setNewAnnouncement] = useState('');

  const { data: songs = [] } = useQuery({
    queryKey: ['songs', churchId],
    queryFn: () => base44.entities.Song.filter({ church_id: churchId }, 'title', 500),
    enabled: !!churchId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['set-list-songs', planId],
    queryFn: () => base44.entities.SetListSong.filter({ set_list_id: planId }, 'position', 100),
    enabled: !!planId,
  });

  const { data: currentPlan } = useQuery({
    queryKey: ['set-list', planId],
    queryFn: () => base44.entities.SetList.filter({ id: planId }),
    enabled: !!planId,
    select: (rows) => rows?.[0] || null,
  });

  const announcements = currentPlan?.announcements || plan?.announcements || [];

  const songById = useMemo(() => Object.fromEntries(songs.map(s => [s.id, s])), [songs]);
  const sorted = useMemo(() => [...entries].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [entries]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['set-list-songs', planId] });
  const invalidatePlan = () => {
    queryClient.invalidateQueries({ queryKey: ['set-list', planId] });
    queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] });
  };

  const saveMeta = async () => {
    if (!meta.service_date) { toast.error('Pick a date'); return; }
    setSavingMeta(true);
    try {
      const payload = { ...meta, group_id: meta.group_id || null };
      if (isNew && !planId) {
        const created = await base44.entities.SetList.create({ church_id: churchId, ...payload });
        setPlanId(created.id);
        queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] });
        toast.success('Service plan created — now add songs below');
      } else {
        await base44.entities.SetList.update(planId, payload);
        invalidatePlan();
        toast.success('Details saved');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to save');
    }
    setSavingMeta(false);
  };

  const addSongMutation = useMutation({
    mutationFn: async () => {
      const nextPos = sorted.length > 0 ? Math.max(...sorted.map(e => e.position || 0)) + 1 : 0;
      if (addSongId) {
        const song = songById[addSongId];
        return base44.entities.SetListSong.create({
          church_id: churchId, set_list_id: planId, song_id: addSongId,
          position: nextPos, key_override: song?.default_key || null,
        });
      }
      if (adHocTitle.trim()) {
        return base44.entities.SetListSong.create({
          church_id: churchId, set_list_id: planId, song_id: null,
          song_title_override: adHocTitle.trim(), position: nextPos,
        });
      }
      throw new Error('Pick a song or type a title');
    },
    onSuccess: () => { invalidate(); setAddSongId(''); setAdHocTitle(''); },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (id) => base44.entities.SetListSong.delete(id),
    onSuccess: invalidate,
  });

  const moveMutation = useMutation({
    mutationFn: async ({ a, b }) => {
      await base44.entities.SetListSong.update(a.id, { position: b.position });
      await base44.entities.SetListSong.update(b.id, { position: a.position });
    },
    onSuccess: invalidate,
  });

  const move = (index, dir) => {
    const other = sorted[index + dir];
    if (!other) return;
    moveMutation.mutate({ a: sorted[index], b: other });
  };

  const updateKeyMutation = useMutation({
    mutationFn: ({ id, key_override }) => base44.entities.SetListSong.update(id, { key_override }),
    onSuccess: invalidate,
  });

  const announcementsMutation = useMutation({
    mutationFn: (next) => base44.entities.SetList.update(planId, { announcements: next }),
    onSuccess: invalidatePlan,
    onError: (err) => toast.error(err.message || 'Failed to save announcements'),
  });

  const addAnnouncement = () => {
    if (!newAnnouncement.trim()) return;
    const next = [...announcements, { id: crypto.randomUUID?.() || String(Date.now()), text: newAnnouncement.trim() }];
    announcementsMutation.mutate(next);
    setNewAnnouncement('');
  };

  const removeAnnouncement = (id) => {
    announcementsMutation.mutate(announcements.filter(a => a.id !== id));
  };

  const handlePrint = () => {
    generateServicePlanPdf({
      church,
      plan: currentPlan || plan,
      meta,
      songs: sorted.map(entry => ({
        title: entry.song_id ? songById[entry.song_id]?.title : entry.song_title_override,
        artist: entry.song_id ? songById[entry.song_id]?.artist : null,
        key: entry.key_override,
      })),
      announcements,
    });
  };

  const selectedGroup = groups.find(g => g.id === meta.group_id);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew && !planId ? 'New Service Plan' : 'Edit Service Plan'}</DialogTitle></DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Service Date *</Label>
              <Input type="date" value={meta.service_date} onChange={(e) => setMeta({ ...meta, service_date: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Service Type</Label>
              <Select value={meta.service_type} onValueChange={(v) => setMeta({ ...meta, service_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SERVICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Title</Label>
            <Input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          </div>
          <div>
            <Label className="mb-1 block">Worship Team</Label>
            <Select value={meta.group_id || '_none'} onValueChange={(v) => setMeta({ ...meta, group_id: v === '_none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="Not linked to a group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Not linked to a group</SelectItem>
                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">The group's leader (and church admins) can update the song list live during service.</p>
          </div>
          <div>
            <Label className="mb-1 block">Notes</Label>
            <Textarea rows={2} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Theme, communion, baptisms, etc." />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={saveMeta} disabled={savingMeta}>
              {savingMeta ? 'Saving…' : (isNew && !planId ? 'Create Service Plan' : 'Save Details')}
            </Button>
            {planId && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handlePrint}>
                  <Printer className="w-3.5 h-3.5" /> Print / PDF
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/live-service/${planId}`)}>
                  <Radio className="w-3.5 h-3.5" /> Open Live Service
                </Button>
              </>
            )}
          </div>

          {planId && (
            <>
              <div className="pt-3 border-t space-y-3">
                <Label className="flex items-center gap-1.5"><Music className="w-4 h-4" /> Songs</Label>

                {sorted.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No songs added yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sorted.map((entry, i) => {
                      const song = entry.song_id ? songById[entry.song_id] : null;
                      const title = song?.title || entry.song_title_override || 'Untitled';
                      return (
                        <div key={entry.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
                          <span className="text-xs text-muted-foreground w-5 text-center flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{title}</p>
                            {song?.artist && <p className="text-xs text-muted-foreground">{song.artist}</p>}
                          </div>
                          <Input
                            value={entry.key_override || ''}
                            onChange={(e) => updateKeyMutation.mutate({ id: entry.id, key_override: e.target.value })}
                            placeholder="Key"
                            className="w-16 h-7 text-xs text-center flex-shrink-0"
                          />
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <Button size="icon" variant="ghost" className="w-6 h-6" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="w-6 h-6" disabled={i === sorted.length - 1} onClick={() => move(i, 1)}><ArrowDown className="w-3.5 h-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive" onClick={() => removeMutation.mutate(entry.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-2 items-end flex-wrap pt-1">
                  <div className="flex-1 min-w-[180px]">
                    <Label className="text-xs mb-1 block">Add from library</Label>
                    <Select value={addSongId} onValueChange={(v) => { setAddSongId(v); setAdHocTitle(''); }}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Choose a song…" /></SelectTrigger>
                      <SelectContent>
                        {songs.length === 0 ? (
                          <SelectItem value="_none" disabled>No songs in your library yet</SelectItem>
                        ) : (
                          songs.map(s => <SelectItem key={s.id} value={s.id}>{s.title}{s.artist ? ` — ${s.artist}` : ''}</SelectItem>)
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <span className="text-xs text-muted-foreground pb-2">or</span>
                  <div className="flex-1 min-w-[160px]">
                    <Label className="text-xs mb-1 block">One-off song title</Label>
                    <Input className="h-9" value={adHocTitle} onChange={(e) => { setAdHocTitle(e.target.value); setAddSongId(''); }} placeholder="Not in library" />
                  </div>
                  <Button size="sm" className="gap-1.5 h-9" onClick={() => addSongMutation.mutate()} disabled={addSongMutation.isPending || (!addSongId && !adHocTitle.trim())}>
                    {addSongMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
                  </Button>
                </div>
              </div>

              <div className="pt-3 border-t space-y-3">
                <Label className="flex items-center gap-1.5"><Megaphone className="w-4 h-4" /> Announcements</Label>
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No announcements added yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {announcements.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 p-2.5 rounded-lg border bg-muted/30">
                        <p className="text-sm flex-1">{a.text}</p>
                        <Button size="icon" variant="ghost" className="w-6 h-6 flex-shrink-0" onClick={() => removeAnnouncement(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea rows={2} value={newAnnouncement} onChange={(e) => setNewAnnouncement(e.target.value)} placeholder="e.g. Potluck next Sunday after service" />
                  <Button size="sm" className="gap-1.5 self-end" onClick={addAnnouncement} disabled={!newAnnouncement.trim() || announcementsMutation.isPending}>
                    <Plus className="w-4 h-4" /> Add
                  </Button>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
