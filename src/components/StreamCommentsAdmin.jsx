import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function StreamCommentsAdmin({ streamId }) {
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments-admin', streamId],
    queryFn: () => base44.entities.StreamComment.filter({ stream_id: streamId }, '-created_date', 100),
    enabled: !!streamId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.StreamComment.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments-admin', streamId] });
      toast.success('Comment removed');
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No comments on this stream</p>
        )}
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50 border">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{c.author_name || 'Anonymous'}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(c.created_date), 'MMM d, h:mm a')}</span>
                </div>
                <p className="text-sm text-foreground/80 mt-0.5">{c.content}</p>
              </div>
              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive hover:text-destructive flex-shrink-0" onClick={() => deleteMutation.mutate(c.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}