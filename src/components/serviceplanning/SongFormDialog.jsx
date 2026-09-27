import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Music2, Upload, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function SongFormDialog({ churchId, song, onClose }) {
  const queryClient = useQueryClient();
  const pdfInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const [form, setForm] = useState({
    title: song?.title || '',
    artist: song?.artist || '',
    default_key: song?.default_key || '',
    bpm: song?.bpm || '',
    ccli_number: song?.ccli_number || '',
    tags: (song?.tags || []).join(', '),
    lyrics_url: song?.lyrics_url || '',
    notes: song?.notes || '',
    pdf_url: song?.pdf_url || '',
    pdf_filename: song?.pdf_filename || '',
    audio_url: song?.audio_url || '',
    audio_filename: song?.audio_filename || '',
  });
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingAudio, setUploadingAudio] = useState(false);

  const handleUpload = async (file, kind) => {
    const setUploading = kind === 'pdf' ? setUploadingPdf : setUploadingAudio;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(prev => ({
        ...prev,
        [`${kind}_url`]: file_url,
        [`${kind}_filename`]: file.name,
      }));
      toast.success(`${kind === 'pdf' ? 'Chart' : 'Audio'} uploaded`);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

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
        pdf_url: form.pdf_url || null,
        pdf_filename: form.pdf_filename || null,
        audio_url: form.audio_url || null,
        audio_filename: form.audio_filename || null,
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
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
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
            <Label className="mb-1 block">Link (lyrics, chart, YouTube, etc.)</Label>
            <Input value={form.lyrics_url} onChange={(e) => setForm({ ...form, lyrics_url: e.target.value })} placeholder="https://..." />
          </div>

          {/* Chord chart PDF */}
          <div>
            <Label className="mb-1 block">Chord Chart (PDF)</Label>
            {form.pdf_url ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-muted/30">
                <a href={form.pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary truncate">
                  <FileText className="w-4 h-4 flex-shrink-0" /> <span className="truncate">{form.pdf_filename || 'chart.pdf'}</span>
                </a>
                <Button size="icon" variant="ghost" className="w-6 h-6 flex-shrink-0" onClick={() => setForm(prev => ({ ...prev, pdf_url: '', pdf_filename: '' }))}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploadingPdf} onClick={() => pdfInputRef.current?.click()}>
                {uploadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingPdf ? 'Uploading…' : 'Upload PDF'}
              </Button>
            )}
            <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'pdf')} />
          </div>

          {/* Audio file */}
          <div>
            <Label className="mb-1 block">Audio (reference track)</Label>
            {form.audio_url ? (
              <div className="p-2 rounded-lg border bg-muted/30 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm truncate">
                    <Music2 className="w-4 h-4 flex-shrink-0 text-primary" /> <span className="truncate">{form.audio_filename || 'audio'}</span>
                  </span>
                  <Button size="icon" variant="ghost" className="w-6 h-6 flex-shrink-0" onClick={() => setForm(prev => ({ ...prev, audio_url: '', audio_filename: '' }))}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <audio controls src={form.audio_url} className="w-full h-8" />
              </div>
            ) : (
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={uploadingAudio} onClick={() => audioInputRef.current?.click()}>
                {uploadingAudio ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploadingAudio ? 'Uploading…' : 'Upload Audio'}
              </Button>
            )}
            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'audio')} />
          </div>

          <div>
            <Label className="mb-1 block">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saveMutation.isPending || uploadingPdf || uploadingAudio}>
              {saveMutation.isPending ? 'Saving…' : 'Save Song'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
