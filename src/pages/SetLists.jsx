import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Music, ListMusic, Plus, Trash2, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import SongFormDialog from '@/components/serviceplanning/SongFormDialog';
import SetListEditorDialog from '@/components/serviceplanning/SetListEditorDialog';

const parseDate = (d) => (d ? new Date(d + 'T00:00:00') : new Date(NaN));
const safeFormat = (d, fmt) => { const p = parseDate(d); return isNaN(p) ? '—' : format(p, fmt); };

export default function SetLists() {
  const { user, isStaff } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [editingSong, setEditingSong] = useState(null);
  const [showSongForm, setShowSongForm] = useState(false);
  const [editingSetList, setEditingSetList] = useState(null);
  const [songSearch, setSongSearch] = useState('');

  const { data: songs = [] } = useQuery({
    queryKey: ['songs', churchId],
    queryFn: () => base44.entities.Song.filter({ church_id: churchId }, 'title', 500),
    enabled: !!churchId,
  });

  const { data: setLists = [] } = useQuery({
    queryKey: ['set-lists', churchId],
    queryFn: () => base44.entities.SetList.filter({ church_id: churchId }, '-service_date', 200),
    enabled: !!churchId,
  });

  const deleteSongMutation = useMutation({
    mutationFn: (id) => base44.entities.Song.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['songs', churchId] }); toast.success('Song removed'); },
  });

  const deleteSetListMutation = useMutation({
    mutationFn: (id) => base44.entities.SetList.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] }); toast.success('Set list deleted'); },
  });

  const filteredSongs = useMemo(() => {
    if (!songSearch) return songs;
    const q = songSearch.toLowerCase();
    return songs.filter(s => s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q) || (s.tags || []).some(t => t.toLowerCase().includes(q)));
  }, [songs, songSearch]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = setLists.filter(s => s.service_date >= today).sort((a, b) => a.service_date.localeCompare(b.service_date));
  const past = setLists.filter(s => s.service_date < today).sort((a, b) => b.service_date.localeCompare(a.service_date));

  if (!churchId) return <div className="text-center py-12 text-muted-foreground">No church assigned</div>;
  if (!isStaff) return <div className="text-center py-12 text-muted-foreground">Access restricted</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-2">
          <ListMusic className="w-7 h-7 text-primary" />
          Set Lists
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Plan song sets for each service and keep a shared song library.</p>
      </div>

      <Tabs defaultValue="setlists">
        <TabsList>
          <TabsTrigger value="setlists">Set Lists</TabsTrigger>
          <TabsTrigger value="library">Song Library ({songs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="setlists" className="mt-4 space-y-4">
          <Button className="gap-2" onClick={() => setEditingSetList({})}>
            <Plus className="w-4 h-4" /> New Set List
          </Button>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h3>
            {upcoming.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">No upcoming set lists yet.</CardContent></Card>
            ) : (
              <div className="space-y-2">
                {upcoming.map(sl => (
                  <Card key={sl.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setEditingSetList(sl)}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="text-center min-w-[48px]">
                        <p className="text-xs text-muted-foreground uppercase">{safeFormat(sl.service_date, 'MMM')}</p>
                        <p className="text-2xl font-bold leading-tight">{safeFormat(sl.service_date, 'd')}</p>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{sl.title}</p>
                        {sl.notes && <p className="text-xs text-muted-foreground truncate">{sl.notes}</p>}
                      </div>
                      <Button
                        size="icon" variant="ghost" className="w-7 h-7 text-destructive flex-shrink-0"
                        onClick={(e) => { e.stopPropagation(); if (window.confirm('Delete this set list?')) deleteSetListMutation.mutate(sl.id); }}
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
                  <Card key={sl.id} className="opacity-70 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => setEditingSetList(sl)}>
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
                    {song.lyrics_url && (
                      <a href={song.lyrics_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary flex-shrink-0">
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
      {editingSetList && (
        <SetListEditorDialog churchId={churchId} setList={editingSetList.id ? editingSetList : null} onClose={() => setEditingSetList(null)} />
      )}
    </div>
  );
}
