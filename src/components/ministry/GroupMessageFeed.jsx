import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, Pin, Trash2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';

function formatMsgDate(d) {
  const date = new Date(d);
  if (isToday(date)) return `Today ${format(date, 'h:mm a')}`;
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d · h:mm a');
}

export default function GroupMessageFeed({ group, user, isAdmin, memberCount }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['group-messages', group.id],
    queryFn: () => base44.entities.MinistryAnnouncement.filter({ group_id: group.id }, '-created_date', 100),
    enabled: !!group.id,
    refetchInterval: 15000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: () => base44.entities.MinistryAnnouncement.create({
      group_id: group.id,
      church_id: group.church_id,
      title: text.trim().slice(0, 60) || 'Message',
      body: text.trim(),
      sender_name: user?.full_name || user?.email || 'Member',
      sender_email: user?.email || '',
      type: 'message',
      send_email: false,
      status: 'sent',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', group.id] });
      setText('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MinistryAnnouncement.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', group.id] });
      toast.success('Message deleted');
    },
  });

  const handleSend = () => {
    if (!text.trim()) return;
    sendMutation.mutate();
  };

  // Display newest at bottom (reverse order)
  const sorted = [...messages].reverse();

  return (
    <div className="flex flex-col h-full min-h-[400px] max-h-[600px]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
          style={{ backgroundColor: group.color || '#6366f1' }}>
          {group.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{group.name}</p>
          <p className="text-xs text-muted-foreground">{memberCount} members · team message board</p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <MessageSquare className="w-3 h-3" /> {messages.length}
        </Badge>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center text-muted-foreground">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Be the first to post an update to your team!</p>
          </div>
        ) : sorted.map(msg => {
          const isMe = msg.sender_email === user?.email;
          const canDelete = isMe || isAdmin;
          const typeIcon = msg.type === 'announcement' ? '📢' : msg.type === 'reminder' ? '🔔' : '💬';

          return (
            <div key={msg.id} className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5
                ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {(msg.sender_name || '?')[0].toUpperCase()}
              </div>
              <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                <div className={`flex items-center gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <span className="text-xs font-medium text-muted-foreground">{isMe ? 'You' : msg.sender_name}</span>
                  <span className="text-xs text-muted-foreground/60">{formatMsgDate(msg.created_date)}</span>
                  {msg.type !== 'message' && <span className="text-xs">{typeIcon}</span>}
                </div>
                <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed
                  ${isMe
                    ? 'bg-primary text-primary-foreground rounded-tr-sm'
                    : 'bg-muted text-foreground rounded-tl-sm'
                  }`}>
                  {msg.body}
                </div>
              </div>
              {canDelete && (
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteMutation.mutate(msg.id)}
                  title="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="pt-3 border-t flex gap-2">
        <Textarea
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={`Message ${group.name}…`}
          rows={2}
          className="flex-1 resize-none text-sm"
        />
        <Button
          size="icon"
          className="h-full aspect-square bg-primary hover:bg-primary/90 self-end"
          onClick={handleSend}
          disabled={!text.trim() || sendMutation.isPending}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}