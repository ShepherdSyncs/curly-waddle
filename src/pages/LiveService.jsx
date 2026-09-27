import React, { useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Radio, Music, ChevronRight, Megaphone, Play, Square, Key } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LiveService() {
  const { id } = useParams();
  const { user, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const { data: plan } = useQuery({
    queryKey: ['live-service-plan', id],
    queryFn: async () => (await base44.entities.SetList.filter({ id }))?.[0] || null,
    enabled: !!id,
    refetchInterval: 4000,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['live-service-songs', id],
    queryFn: () => base44.entities.SetListSong.filter({ set_list_id: id }, 'position', 100),
    enabled: !!id,
    refetchInterval: 4000,
  });

  const { data: songs = [] } = useQuery({
    queryKey: ['songs', churchId],
    queryFn: () => base44.entities.Song.filter({ church_id: churchId }, 'title', 500),
    enabled: !!churchId,
  });

  const { data: group } = useQuery({
    queryKey: ['live-service-group', plan?.group_id],
    queryFn: async () => (await base44.entities.MinistryGroup.filter({ id: plan.group_id }))?.[0] || null,
    enabled: !!plan?.group_id,
  });

  // Live updates: any change to this plan or its songs refetches immediately
  // rather than waiting for the polling interval, so control changes feel instant.
  useEffect(() => {
    const unsub1 = base44.entities.SetList.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['live-service-plan', id] });
    });
    const unsub2 = base44.entities.SetListSong.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['live-service-songs', id] });
    });
    return () => { unsub1?.(); unsub2?.(); };
  }, [id, queryClient]);

  const songById = useMemo(() => Object.fromEntries(songs.map(s => [s.id, s])), [songs]);
  const sorted = useMemo(() => [...entries].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)), [entries]);

  const canControl = isChurchAdmin || isGlobalAdmin || (group && group.leader_email === user?.email);

  const currentEntry = sorted.find(e => e.id === plan?.live_current_entry_id) || sorted[0] || null;
  const currentIndex = currentEntry ? sorted.findIndex(e => e.id === currentEntry.id) : -1;

  const entryTitle = (entry) => {
    if (!entry) return '';
    const song = entry.song_id ? songById[entry.song_id] : null;
    return song?.title || entry.song_title_override || 'Untitled';
  };
  const entryArtist = (entry) => (entry?.song_id ? songById[entry.song_id]?.artist : null);
  const entryKey = (entry) => entry?.key_override || (entry?.song_id ? songById[entry.song_id]?.default_key : null);

  const setCurrentMutation = useMutation({
    mutationFn: (entryId) => base44.entities.SetList.update(id, { live_current_entry_id: entryId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['live-service-plan', id] }),
    onError: (err) => toast.error(err.message || 'Failed to update'),
  });

  const toggleLiveMutation = useMutation({
    mutationFn: (next) => base44.entities.SetList.update(id, {
      is_live: next,
      live_current_entry_id: next && !plan?.live_current_entry_id ? sorted[0]?.id || null : plan?.live_current_entry_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['live-service-plan', id] });
      queryClient.invalidateQueries({ queryKey: ['set-lists', churchId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update'),
  });

  const goToNext = () => {
    const next = sorted[currentIndex + 1];
    if (next) setCurrentMutation.mutate(next.id);
  };

  if (!plan) {
    return <div className="p-8 text-center text-muted-foreground">Loading service plan…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <Link to="/service-plan"><ArrowLeft className="w-4 h-4" /> Back</Link>
          </Button>
          {plan.is_live ? (
            <Badge className="bg-red-100 text-red-700 border-red-200 gap-1.5 text-sm px-2.5 py-1">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-sm px-2.5 py-1">Not live</Badge>
          )}
        </div>

        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold">{plan.title}</h1>
          <p className="text-sm text-muted-foreground">
            {plan.service_date ? format(new Date(plan.service_date + 'T00:00:00'), 'EEEE, MMMM d, yyyy') : ''}
            {group ? ` · ${group.name}` : ''}
          </p>
        </div>

        {canControl && (
          <div className="flex gap-2">
            {plan.is_live ? (
              <Button variant="outline" className="gap-1.5" onClick={() => toggleLiveMutation.mutate(false)} disabled={toggleLiveMutation.isPending}>
                <Square className="w-4 h-4" /> End Live Service
              </Button>
            ) : (
              <Button className="gap-1.5" onClick={() => toggleLiveMutation.mutate(true)} disabled={toggleLiveMutation.isPending || sorted.length === 0}>
                <Play className="w-4 h-4" /> Start Live Service
              </Button>
            )}
            {currentIndex >= 0 && currentIndex < sorted.length - 1 && (
              <Button variant="outline" className="gap-1.5" onClick={goToNext} disabled={setCurrentMutation.isPending}>
                Next Song <ChevronRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Now Playing */}
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="p-5">
            <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">Now Playing</p>
            {currentEntry ? (
              <>
                <p className="text-2xl font-bold">{entryTitle(currentEntry)}</p>
                <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                  {entryArtist(currentEntry) && <span>{entryArtist(currentEntry)}</span>}
                  {entryKey(currentEntry) && <span className="flex items-center gap-1"><Key className="w-3.5 h-3.5" /> {entryKey(currentEntry)}</span>}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No songs in this plan yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Song list */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Music className="w-4 h-4" /> Song List
          </h3>
          <div className="space-y-1.5">
            {sorted.map((entry, i) => {
              const isCurrent = currentEntry?.id === entry.id;
              return (
                <button
                  key={entry.id}
                  disabled={!canControl}
                  onClick={() => canControl && setCurrentMutation.mutate(entry.id)}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                    isCurrent ? 'border-primary bg-primary/10' : 'bg-card hover:bg-muted/50'
                  } ${canControl ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className={`text-xs w-5 text-center flex-shrink-0 ${isCurrent ? 'font-bold text-primary' : 'text-muted-foreground'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm truncate ${isCurrent ? 'font-semibold' : ''}`}>{entryTitle(entry)}</p>
                    {entryArtist(entry) && <p className="text-xs text-muted-foreground truncate">{entryArtist(entry)}</p>}
                  </div>
                  {entryKey(entry) && <Badge variant="outline" className="text-xs flex-shrink-0">{entryKey(entry)}</Badge>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Announcements */}
        {(plan.announcements || []).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Megaphone className="w-4 h-4" /> Announcements
            </h3>
            <div className="space-y-1.5">
              {plan.announcements.map(a => (
                <Card key={a.id}><CardContent className="p-3 text-sm">{a.text}</CardContent></Card>
              ))}
            </div>
          </div>
        )}

        {!canControl && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Only the worship leader or a church admin can change the current song.
          </p>
        )}
      </div>
    </div>
  );
}
