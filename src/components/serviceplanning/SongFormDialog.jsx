import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function SongFormDialog({ churchId, song, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    default_key: song?.default_key || '',
    bpm: song?.bpm || '',
    ccli_number: song?.ccli_number || '',
    tags: (song?.tags || []).join(', '),
    lyrics_url: song?.lyrics_url || '',
    notes: song?.notes || '',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        artist: form.artist.trim() || null,
        default_key: form.default_key.trim() || null,
        bpm: form.bpm ? parseInt(form.bpm, 10) : null,
        ccli_number: form.ccli_number.trim() || null,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        lyrics_url: form.lyrics_url.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (song?.id) return base44.entities.Song.update(song.id, payload);
      return base44.entities.Song.create({ ...payload, church_id: churchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['songs', churchId] });
      toast.success(song?.id ? 'Song updated' : 'Song added');
      onClose();
    },
    onError: (err) => toast.error(err.message || 'Failed to save song'),
  });

  const handleSave = () => {
    if (!form.title.trim()) { toast.error('Enter a song title'); return; }
    saveMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{song?.id ? 'Edit Song' : 'Add Song'}</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="mb-1 block">Title *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Song title" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">Artist</Label>
              <Input value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">Default Key</Label>
              <Input value={form.default_key} onChange={(e) => setForm({ ...form, default_key: e.target.value })} placeholder="e.g. G" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block">BPM</Label>
              <Input type="number" value={form.bpm} onChange={(e) => setForm({ ...form, bpm: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1 block">CCLI #</Label>
              <Input value={form.ccli_number} onChange={(e) => setForm({ ...form, ccli_number: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Tags (comma separated)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="fast, worship, christmas" />
          </div>
          <div>
            <Label className="mb-1 block">Chord Chart / Lyrics Link</Label>
            <Input value={form.lyrics_url} onChange={(e) => setForm({ ...form, lyrics_url: e.target.value })} placeholder="https://..." />
          </div>
          <div>
            <Label className="mb-1 block">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : 'Save Song'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
