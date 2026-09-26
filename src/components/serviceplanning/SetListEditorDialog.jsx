import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, Trash2, Plus, Music, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_TYPES = [
  { value: 'sunday_morning', label: 'Sunday Morning' },
  { value: 'sunday_evening', label: 'Sunday Evening' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'special_event', label: 'Special Event' },
  { value: 'other', label: 'Other' },
];

export default function SetListEditorDialog({ churchId, setList, onClose }) {
  const queryClient = useQueryClient();
  const isNew = !setList?.id;
  const [meta, setMeta] = useState({
    service_date: setList?.service_date || '',
    title: setList?.title || 'Sunday Service',
    service_type: setList?.service_type || 'sunday_morning',
    notes: setList?.notes || '',
  });
  const [savingMeta, setSavingMeta] = useState(false);
  const [setListId, setSetListId] = useState(setList?.id || null);
  const [addSongId, setAddSongId] = useState('');
  const [adHocTitle, setAdHocTitle] = useState('');

  const { data: songs = [] } = useQuery({
    queryKey: ['songs', churchId],
    queryFn: () => base44.entities.Song.filter({ church_id: churchId }, 'title', 500),
    enabled: !!churchId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['set-list-songs', setListId],
    queryFn: () => base44.entities.SetListSong.filter({ set_list_id: setListId }, 'position', 100),
    enabled: !!setListId,
  });

  const songById = useMemo(() => Object.fromEntries(songs.map(s => [s.id, s])), [songs]);
  const sorted = useMemo(() => [...entries].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [entries]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['set-list-songs', setListId] });

  const saveMeta = async () => {
    if (!meta.service_date) { toast.error('Pick a date'); return; }
    setSavingMeta(true);
    try {
      if (isNew && !setListId) {
        const created = await base44.entities.SetList.create({ church_id: churchId, ...meta });
        setSetListId(created.id);
        queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] });
        toast.success('Set list created — now add songs below');
      } else {
        await base44.entities.SetList.update(setListId, meta);
        queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] });
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
          church_id: churchId, set_list_id: setListId, song_id: addSongId,
          position: nextPos, key_override: song?.default_key || null,
        });
      }
      if (adHocTitle.trim()) {
        return base44.entities.SetListSong.create({
          church_id: churchId, set_list_id: setListId, song_id: null,
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isNew && !setListId ? 'New Set List' : 'Edit Set List'}</DialogTitle></DialogHeader>

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
            <Label className="mb-1 block">Notes</Label>
            <Textarea rows={2} value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Theme, communion, baptisms, etc." />
          </div>
          <Button size="sm" variant="outline" onClick={saveMeta} disabled={savingMeta}>
            {savingMeta ? 'Saving…' : (isNew && !setListId ? 'Create Set List' : 'Save Details')}
          </Button>

          {setListId && (
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
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
