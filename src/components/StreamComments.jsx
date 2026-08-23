import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function StreamComments({ stream, churchId }) {
  const [name, setName] = useState('');
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', stream?.id],
    queryFn: () => base44.entities.StreamComment.filter({ stream_id: stream.id }, 'created_date', 100),
    enabled: !!stream?.id,
    refetchInterval: 10000,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.StreamComment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', stream?.id] });
      setComment('');
      toast.success('Comment posted!');
    },
  });

  const handleSubmit = () => {
    if (!comment.trim()) return;
    createMutation.mutate({
      stream_id: stream.id,
      church_id: churchId,
      content: comment.trim(),
      author_name: name.trim() || 'Anonymous',
    });
  };

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3 flex items-center gap-2">
        <MessageCircle className="w-4 h-4" /> Comments ({comments.length})
      </h3>

      {/* Post comment */}
      <div className="space-y-2 mb-4">
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm"
        />
        <div className="flex gap-2">
          <Input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share a comment or prayer request..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!comment.trim() || createMutation.isPending}
            className="bg-sidebar-primary text-white hover:bg-sidebar-primary/80 flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Comments list */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-white/30 text-sm text-center py-4">No comments yet. Be the first!</p>
        )}
        {[...comments].reverse().map(c => (
          <div key={c.id} className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm font-medium text-white/80">{c.author_name || 'Anonymous'}</span>
              <span className="text-xs text-white/30">{format(new Date(c.created_date), 'h:mm a')}</span>
            </div>
            <p className="text-sm text-white/70">{c.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}