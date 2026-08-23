import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Play, Plus, Search, Mic, Calendar, Clock, BookOpen, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import SermonPlayer from '@/components/sermons/SermonPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LiveStreamAdmin from '@/pages/LiveStreamAdmin';

const CATEGORIES = ['service', 'bible_study', 'youth', 'conference', 'special', 'other'];

const emptyForm = {
  title: '', speaker: '', date: format(new Date(), 'yyyy-MM-dd'),
  series: '', description: '', scripture_reference: '',
  video_url: '', audio_url: '', thumbnail_url: '',
  duration_minutes: '', tags: '', is_published: true,
};

export default function SermonArchive() {
  const { user, isStaff, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [speakerFilter, setSpeakerFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editSermon, setEditSermon] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [playerSermon, setPlayerSermon] = useState(null);

  const { data: sermons = [], isLoading } = useQuery({
    queryKey: ['sermons', churchId],
    queryFn: () => base44.entities.Sermon.filter({ church_id: churchId }, '-date', 200),
    enabled: !!churchId,
  });

  const saveMutation = useMutation({
    mutationFn: (data) => editSermon
      ? base44.entities.Sermon.update(editSermon.id, data)
      : base44.entities.Sermon.create({ ...data, church_id: churchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sermons'] });
      setFormOpen(false);
      setEditSermon(null);
      setForm(emptyForm);
      toast.success(editSermon ? 'Sermon updated' : 'Sermon added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Sermon.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sermons'] });
      toast.success('Sermon deleted');
    },
  });

  const togglePublish = (sermon) => {
    base44.entities.Sermon.update(sermon.id, { is_published: !sermon.is_published });
    queryClient.invalidateQueries({ queryKey: ['sermons'] });
  };

  const openEdit = (s) => {
    setEditSermon(s);
    setForm({
      title: s.title || '', speaker: s.speaker || '', date: s.date || '',
      series: s.series || '', description: s.description || '',
      scripture_reference: s.scripture_reference || '',
      video_url: s.video_url || '', audio_url: s.audio_url || '',
      thumbnail_url: s.thumbnail_url || '',
      duration_minutes: s.duration_minutes || '',
      tags: (s.tags || []).join(', '), is_published: s.is_published !== false,
    });
    setFormOpen(true);
  };

  const handleSave = () => {
    if (!form.title || !form.date) { toast.error('Title and date are required'); return; }
    saveMutation.mutate({
      ...form,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : undefined,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    });
  };

  const speakers = [...new Set(sermons.map(s => s.speaker).filter(Boolean))];

  const visible = sermons.filter(s => {
    if (!isStaff && !s.is_published) return false;
    const q = search.toLowerCase();
    const matchSearch = !q || s.title?.toLowerCase().includes(q) || s.speaker?.toLowerCase().includes(q) || s.series?.toLowerCase().includes(q) || s.scripture_reference?.toLowerCase().includes(q);
    const matchSpeaker = speakerFilter === 'all' || s.speaker === speakerFilter;
    return matchSearch && matchSpeaker;
  });

  const showLiveStreamTab = isChurchAdmin || isGlobalAdmin;

  const sermonsContent = (
    <>
      {isStaff && (
        <div className="flex justify-end">
          <Button onClick={() => { setEditSermon(null); setForm(emptyForm); setFormOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Sermon
          </Button>
        </div>
      )}
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search sermons, speakers, scripture…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={speakerFilter} onValueChange={setSpeakerFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Speakers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Speakers</SelectItem>
            {speakers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {/* Grid */}
      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-52 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Mic className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No sermons found{search ? ' matching your search' : ''}.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(sermon => (
            <SermonCard
              key={sermon.id}
              sermon={sermon}
              isStaff={isStaff}
              onPlay={() => setPlayerSermon(sermon)}
              onEdit={() => openEdit(sermon)}
              onDelete={() => deleteMutation.mutate(sermon.id)}
              onTogglePublish={() => togglePublish(sermon)}
            />
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
          <Mic className="w-6 h-6 text-primary" /> Sermon Archive
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{sermons.filter(s => s.is_published).length} sermons available</p>
      </div>

      {showLiveStreamTab ? (
        <Tabs defaultValue="sermons" className="space-y-4">
          <TabsList>
            <TabsTrigger value="sermons">Sermons</TabsTrigger>
            <TabsTrigger value="livestream">Live Stream</TabsTrigger>
          </TabsList>
          <TabsContent value="sermons" className="space-y-6">
            {sermonsContent}
          </TabsContent>
          <TabsContent value="livestream">
            <LiveStreamAdmin />
          </TabsContent>
        </Tabs>
      ) : sermonsContent}

      {/* Add/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={v => { if (!v) { setFormOpen(false); setEditSermon(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSermon ? 'Edit Sermon' : 'Add Sermon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="The Grace of God" /></div>
              <div><Label>Speaker</Label><Input value={form.speaker} onChange={e => setForm({ ...form, speaker: e.target.value })} placeholder="Pastor John" /></div>
              <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>Series</Label><Input value={form.series} onChange={e => setForm({ ...form, series: e.target.value })} placeholder="Series name" /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })} placeholder="45" /></div>
              <div className="col-span-2"><Label>Scripture Reference</Label><Input value={form.scripture_reference} onChange={e => setForm({ ...form, scripture_reference: e.target.value })} placeholder="John 3:16-17" /></div>
              <div className="col-span-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description…" /></div>
              <div className="col-span-2"><Label>Video URL</Label><Input value={form.video_url} onChange={e => setForm({ ...form, video_url: e.target.value })} placeholder="YouTube, Vimeo, or direct link" /></div>
              <div className="col-span-2"><Label>Audio URL</Label><Input value={form.audio_url} onChange={e => setForm({ ...form, audio_url: e.target.value })} placeholder="Direct MP3/audio link" /></div>
              <div className="col-span-2"><Label>Thumbnail URL</Label><Input value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://…" /></div>
              <div className="col-span-2"><Label>Tags (comma separated)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="grace, salvation, faith" /></div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pub" checked={form.is_published} onChange={e => setForm({ ...form, is_published: e.target.checked })} className="rounded" />
              <label htmlFor="pub" className="text-sm">Published (visible to members)</label>
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving…' : editSermon ? 'Update Sermon' : 'Add Sermon'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Player Dialog */}
      {playerSermon && (
        <SermonPlayer sermon={playerSermon} onClose={() => setPlayerSermon(null)} />
      )}
    </div>
  );
}

function SermonCard({ sermon, isStaff, onPlay, onEdit, onDelete, onTogglePublish }) {
  const hasMedia = sermon.video_url || sermon.audio_url;
  return (
    <Card className={`overflow-hidden hover:shadow-md transition-shadow ${!sermon.is_published ? 'opacity-60' : ''}`}>
      {/* Thumbnail */}
      <div
        className="h-36 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative cursor-pointer"
        style={sermon.thumbnail_url ? { backgroundImage: `url(${sermon.thumbnail_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        onClick={hasMedia ? onPlay : undefined}
      >
        {!sermon.thumbnail_url && <Mic className="w-10 h-10 text-primary/40" />}
        {hasMedia && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-t-lg">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-primary ml-0.5" />
            </div>
          </div>
        )}
        {!sermon.is_published && (
          <Badge variant="secondary" className="absolute top-2 left-2 text-xs">Draft</Badge>
        )}
      </div>

      <CardContent className="p-4 space-y-2">
        <div>
          <h3 className="font-semibold leading-tight line-clamp-2">{sermon.title}</h3>
          {sermon.series && <p className="text-xs text-primary mt-0.5">{sermon.series}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {sermon.speaker && <span className="flex items-center gap-1"><Mic className="w-3 h-3" />{sermon.speaker}</span>}
          {sermon.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(new Date(sermon.date), 'MMM d, yyyy')}</span>}
          {sermon.duration_minutes && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{sermon.duration_minutes}m</span>}
        </div>
        {sermon.scripture_reference && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> {sermon.scripture_reference}
          </p>
        )}
        <div className="flex items-center gap-1 pt-1">
          {hasMedia && (
            <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={onPlay}>
              <Play className="w-3.5 h-3.5" /> {sermon.video_url ? 'Watch' : 'Listen'}
            </Button>
          )}
          {isStaff && (
            <>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={onEdit}><Edit2 className="w-3.5 h-3.5" /></Button>
              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={onTogglePublish} title={sermon.is_published ? 'Unpublish' : 'Publish'}>
                {sermon.is_published ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </Button>
              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={onDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}