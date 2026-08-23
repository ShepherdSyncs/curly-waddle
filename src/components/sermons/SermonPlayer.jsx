import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Mic, Calendar, Clock, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

function getEmbedUrl(url) {
  if (!url) return null;
  // YouTube
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}?autoplay=1`;
  return null;
}

export default function SermonPlayer({ sermon, onClose }) {
  const embedUrl = getEmbedUrl(sermon.video_url);
  const isDirectVideo = sermon.video_url && !embedUrl;

  return (
    <Dialog open={true} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug">{sermon.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video embed or direct */}
          {embedUrl && (
            <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {isDirectVideo && (
            <video controls autoPlay className="w-full rounded-lg bg-black" src={sermon.video_url}>
              Your browser does not support video playback.
            </video>
          )}

          {/* Audio player */}
          {sermon.audio_url && !sermon.video_url && (
            <div className="p-4 rounded-lg bg-muted flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Mic className="w-7 h-7 text-primary" />
              </div>
              <audio controls autoPlay className="w-full" src={sermon.audio_url}>
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {sermon.speaker && <span className="flex items-center gap-1.5"><Mic className="w-4 h-4" />{sermon.speaker}</span>}
              {sermon.date && <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{format(new Date(sermon.date), 'MMMM d, yyyy')}</span>}
              {sermon.duration_minutes && <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{sermon.duration_minutes} minutes</span>}
              {sermon.scripture_reference && <span className="flex items-center gap-1.5"><BookOpen className="w-4 h-4" />{sermon.scripture_reference}</span>}
            </div>

            {sermon.series && <Badge variant="secondary">{sermon.series}</Badge>}

            {sermon.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{sermon.description}</p>
            )}

            {sermon.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sermon.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            )}
          </div>

          {/* External link fallback */}
          {sermon.video_url && !embedUrl && !isDirectVideo && (
            <Button variant="outline" className="w-full gap-2" onClick={() => window.open(sermon.video_url, '_blank')}>
              <ExternalLink className="w-4 h-4" /> Open Video
            </Button>
          )}
          {sermon.video_url && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => window.open(sermon.video_url, '_blank')}>
              <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}