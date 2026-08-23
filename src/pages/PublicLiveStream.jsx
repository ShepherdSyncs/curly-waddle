import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio, Calendar, Eye, Play, Cross, Heart } from 'lucide-react';
import { format } from 'date-fns';
import StreamComments from '@/components/StreamComments';
import HLSPlayer from '@/components/HLSPlayer';
import GivingModal from '@/components/livestream/GivingModal';
import { Button } from '@/components/ui/button';

// Get church_id from URL: /live?church=CHURCH_ID
function getChurchId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('church');
}

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white animate-pulse">
      <span className="w-2 h-2 rounded-full bg-white" />
      LIVE
    </span>
  );
}

export default function PublicLiveStream() {
  const churchId = getChurchId();
  const [selected, setSelected] = useState(null);
  const [showGiving, setShowGiving] = useState(false);

  const { data: streams = [], isLoading } = useQuery({
    queryKey: ['public-streams', churchId],
    queryFn: () => churchId
      ? base44.entities.LiveStream.filter({ church_id: churchId, is_archived: false }, '-created_date', 50)
      : base44.entities.LiveStream.filter({ is_archived: false }, '-created_date', 50),
    refetchInterval: 15000, // poll every 15s for live status changes
  });

  const liveStream = streams.find(s => s.status === 'live');
  const pastStreams = streams.filter(s => s.status === 'ended');

  // Auto-select: live first, else latest past
  useEffect(() => {
    if (!selected) {
      if (liveStream) setSelected(liveStream);
      else if (pastStreams.length > 0) setSelected(pastStreams[0]);
    }
    // If a stream just went live, switch to it
    if (liveStream && selected?.id !== liveStream.id) {
      setSelected(liveStream);
    }
  }, [streams]);

  const activeStream = selected || liveStream || pastStreams[0];

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <Cross className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-serif font-bold text-lg leading-none">Shepherd Live</h1>
              <p className="text-xs text-white/50">Live & Archived Services</p>
            </div>
          </div>
          {liveStream && <LiveBadge />}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        {/* Main player */}
        <div className="flex-1 min-w-0">
          {activeStream ? (
            <>
              {/* Video player */}
              <div className="relative w-full bg-black rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
                {activeStream.playback_url ? (
                  <HLSPlayer
                    src={activeStream.playback_url}
                    autoPlay={activeStream.status === 'live'}
                    poster={activeStream.thumbnail_url}
                    className="absolute inset-0 w-full h-full"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/40">
                    <Radio className="w-12 h-12 mb-3" />
                    {activeStream.status === 'live'
                      ? <p className="text-sm">Stream starting soon...</p>
                      : <p className="text-sm">No playback URL configured</p>
                    }
                  </div>
                )}
                {activeStream.status === 'live' && (
                  <div className="absolute top-3 left-3">
                    <LiveBadge />
                  </div>
                )}
              </div>

              {/* Stream info */}
              <div className="mt-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-semibold">{activeStream.title}</h2>
                    {activeStream.description && <p className="text-white/60 text-sm mt-1">{activeStream.description}</p>}
                  </div>

                  <div className="flex items-center gap-3 text-white/50 text-sm flex-wrap">
                    {activeStream.started_at && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(activeStream.started_at), 'MMM d, yyyy')}
                      </span>
                    )}
                    {activeStream.viewer_count > 0 && (
                      <span className="flex items-center gap-1.5">
                        <Eye className="w-4 h-4" />
                        {activeStream.viewer_count.toLocaleString()} viewers
                      </span>
                    )}
                    <Button
                      size="sm"
                      className="gap-2 bg-primary hover:bg-primary/90 text-white"
                      onClick={() => setShowGiving(true)}
                    >
                      <Heart className="w-4 h-4" /> Click to Give
                    </Button>
                  </div>
                </div>
                <StreamComments stream={activeStream} churchId={churchId} />
              </div>
            </>
          ) : (
            <div className="w-full bg-slate-900 rounded-xl flex flex-col items-center justify-center py-24 text-white/30">
              <Radio className="w-16 h-16 mb-4" />
              <p className="text-lg font-medium">No live stream right now</p>
              <p className="text-sm mt-1">Check back during service times</p>
            </div>
          )}
        </div>

        {/* Sidebar: past streams */}
        <div className="lg:w-80 flex-shrink-0">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            {liveStream ? 'Also Available' : 'Past Services'}
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
              {streams.map(stream => (
                <button
                  key={stream.id}
                  onClick={() => setSelected(stream)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex gap-3 ${
                    activeStream?.id === stream.id
                      ? 'border-sidebar-primary bg-sidebar-primary/20'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-24 h-16 flex-shrink-0 rounded-lg bg-slate-800 overflow-hidden relative">
                    {stream.thumbnail_url
                      ? <img src={stream.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Play className="w-6 h-6 text-white/30" /></div>
                    }
                    {stream.status === 'live' && (
                      <span className="absolute top-1 left-1 text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded">LIVE</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2 leading-snug">{stream.title}</p>
                    {stream.started_at && (
                      <p className="text-xs text-white/40 mt-1">{format(new Date(stream.started_at), 'MMM d, yyyy')}</p>
                    )}
                    <Badge variant="outline" className={`mt-1 text-[10px] px-1.5 py-0 border-0 ${
                      stream.status === 'live' ? 'bg-red-500/20 text-red-300' :
                      stream.status === 'ended' ? 'bg-white/10 text-white/50' :
                      'bg-yellow-500/20 text-yellow-300'
                    }`}>
                      {stream.status}
                    </Badge>
                  </div>
                </button>
              ))}
              {streams.length === 0 && (
                <p className="text-white/30 text-sm text-center py-8">No streams yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {showGiving && (
        <GivingModal
          churchId={churchId}
          churchName={streams[0]?.title ? undefined : undefined}
          onClose={() => setShowGiving(false)}
        />
      )}
    </div>
  );
}