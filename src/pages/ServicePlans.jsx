import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, ListMusic, Plus, Trash2, Search, ExternalLink, FileText, Music2, Radio } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import SongFormDialog from '@/components/serviceplanning/SongFormDialog';
import ServicePlanEditorDialog from '@/components/serviceplanning/ServicePlanEditorDialog';

const parseDate = (d) => (d ? new Date(d + 'T00:00:00') : new Date(NaN));
const safeFormat = (d, fmt) => { const p = parseDate(d); return isNaN(p) ? '—' : format(p, fmt); };

export default function ServicePlans() {
  const { user, isStaff } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [editingSong, setEditingSong] = useState(null);
  const [showSongForm, setShowSongForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [songSearch, setSongSearch] = useState('');

  const { data: songs = [] } = useQuery({
    queryKey: ['songs', churchId],
    queryFn: () => base44.entities.Song.filter({ church_id: churchId }, 'title', 500),
    enabled: !!churchId,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['set-lists', churchId],
    queryFn: () => base44.entities.SetList.filter({ church_id: churchId }, '-service_date', 200),
    enabled: !!churchId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['ministry-groups', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId, is_active: true }, 'name', 100),
    enabled: !!churchId,
  });

  const { data: church } = useQuery({
    queryKey: ['church-for-service-plan', churchId],
    queryFn: async () => (await base44.entities.Church.filter({ id: churchId }))?.[0] || null,
    enabled: !!churchId,
  });

  const groupById = useMemo(() => Object.fromEntries(groups.map(g => [g.id, g])), [groups]);

  const deleteSongMutation = useMutation({
    mutationFn: (id) => base44.entities.Song.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['songs', churchId] }); toast.success('Song removed'); },
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id) => base44.entities.SetList.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] }); toast.success('Service plan deleted'); },
  });

  const filteredSongs = useMemo(() => {
    if (!songSearch) return songs;
    const q = songSearch.toLowerCase();
    return songs.filter(s => s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q) || (s.tags || []).some(t => t.toLowerCase().includes(q)));
  }, [songs, songSearch]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = plans.filter(s => s.service_date >= today).sort((a, b) => a.service_date.localeCompare(b.service_date));
  const past = plans.filter(s => s.service_date < today).sort((a, b) => b.service_date.localeCompare(a.service_date));

  if (!churchId) return <div className="text-center py-12 text-muted-foreground">No church assigned</div>;
  if (!isStaff) return <div className="text-center py-12 text-muted-foreground">Access restricted</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-2">
          <ListMusic className="w-7 h-7 text-primary" />
          Service Plan
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Plan songs, announcements, and the order of service — and run it live from your phone.</p>
      </div>

      <Tabs defaultValue="plans">
        <TabsList>
          <TabsTrigger value="plans">Service Plans</TabsTrigger>
          <TabsTrigger value="library">Song Library ({songs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="mt-4 space-y-4">
          <Button className="gap-2" onClick={() => setEditingPlan({})}>
            <Plus className="w-4 h-4" /> New Service Plan
          </Button>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h3>
            {upcoming.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No upcoming service plans yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {upcoming.map(sl => (
                  <Card key={sl.id} className="hover:border-primary/50 transition-colors">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="text-center min-w-[48px] cursor-pointer" onClick={() => setEditingPlan(sl)}>
                        <p className="text-xs text-muted-foreground uppercase">{safeFormat(sl.service_date, 'MMM')}</p>
                        <p className="text-2xl font-bold leading-tight">{safeFormat(sl.service_date, 'd')}</p>
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setEditingPlan(sl)}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{sl.title}</p>
                          {sl.group_id && groupById[sl.group_id] && <Badge variant="secondary" className="text-xs">{groupById[sl.group_id].name}</Badge>}
                          {sl.is_live && <Badge className="text-xs bg-red-100 text-red-700 border-red-200 gap-1"><Radio className="w-3 h-3" /> Live</Badge>}
                        </div>
                        {sl.notes && <p className="text-xs text-muted-foreground truncate">{sl.notes}</p>}
                      </div>
                      <Button asChild size="sm" variant="outline" className="flex-shrink-0 gap-1.5">
                        <Link to={`/live-service/${sl.id}`}><Radio className="w-3.5 h-3.5" /> Live</Link>
                      </Button>
                      <Button
                        size="icon" variant="ghost" className="w-7 h-7 text-destructive flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this service plan?')) deletePlanMutation.mutate(sl.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {past.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past</h3>
              <div className="space-y-2">
                {past.slice(0, 15).map(sl => (
                  <Card key={sl.id} className="opacity-70 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => setEditingPlan(sl)}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <p className="text-sm text-muted-foreground w-24 flex-shrink-0">{safeFormat(sl.service_date, 'MMM d, yyyy')}</p>
                      <p className="text-sm flex-1 truncate">{sl.title}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="library" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={songSearch} onChange={(e) => setSongSearch(e.target.value)} placeholder="Search songs, artist, tags..." className="pl-8" />
            </div>
            <Button className="gap-2" onClick={() => { setEditingSong(null); setShowSongForm(true); }}>
              <Plus className="w-4 h-4" /> Add Song
            </Button>
          </div>

          {filteredSongs.length === 0 ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground">
              <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
              <p>No songs in your library yet.</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-1.5">
              {filteredSongs.map(song => (
                <Card key={song.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{song.title}</p>
                        {song.default_key && <Badge variant="outline" className="text-xs">Key: {song.default_key}</Badge>}
                        {song.bpm && <Badge variant="outline" className="text-xs">{song.bpm} BPM</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {song.artist && <p className="text-xs text-muted-foreground">{song.artist}</p>}
                        {(song.tags || []).map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                      </div>
                    </div>
                    {song.pdf_url && (
                      <a href={song.pdf_url} target="_blank" rel="noopener noreferrer" title="Chord chart" className="text-muted-foreground hover:text-primary flex-shrink-0">
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                    {song.audio_url && (
                      <a href={song.audio_url} target="_blank" rel="noopener noreferrer" title="Audio" className="text-muted-foreground hover:text-primary flex-shrink-0">
                        <Music2 className="w-4 h-4" />
                      </a>
                    )}
                    {song.lyrics_url && (
                      <a href={song.lyrics_url} target="_blank" rel="noopener noreferrer" title="Link" className="text-muted-foreground hover:text-primary flex-shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={() => { setEditingSong(song); setShowSongForm(true); }}>Edit</Button>
                    <Button
                      size="icon" variant="ghost" className="w-7 h-7 text-destructive flex-shrink-0"
                      onClick={() => { if (window.confirm(`Remove "${song.title}" from the library?`)) deleteSongMutation.mutate(song.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showSongForm && (
        <SongFormDialog churchId={churchId} song={editingSong} onClose={() => { setShowSongForm(false); setEditingSong(null); }} />
      )}
      {editingPlan && (
        <ServicePlanEditorDialog
          churchId={churchId}
          church={church}
          plan={editingPlan.id ? editingPlan : null}
          groups={groups}
          onClose={() => setEditingPlan(null)}
        />
      )}
    </div>
  );
}
