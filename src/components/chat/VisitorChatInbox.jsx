import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Send, Bot, User as UserIcon, Church, MessageSquare, Clock, Radio, X } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import useAppUser from '@/hooks/useAppUser';
import { toast } from 'sonner';

function formatTime(d) {
  const date = new Date(d);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d · h:mm a');
}

const STATUS_CONFIG = {
  ai_active: { label: 'AI Active', color: 'bg-blue-100 text-blue-700' },
  waiting_for_pastoral: { label: 'Needs Attention', color: 'bg-amber-100 text-amber-700' },
  pastoral_active: { label: 'Pastoral Active', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-500' },
};

export default function VisitorChatInbox({ churchId }) {
  const { user, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const queryClient = useQueryClient();
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [text, setText] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch sessions
  const { data: sessions = [] } = useQuery({
    queryKey: ['visitor-chat-sessions', churchId],
    queryFn: () => base44.entities.VisitorChatSession.filter({ church_id: churchId }, '-last_message_at', 50),
    enabled: !!churchId,
    refetchInterval: 5000,
  });

  const selectedSession = sessions.find(s => s.id === selectedSessionId);

  // Fetch messages for selected session
  const { data: messages = [] } = useQuery({
    queryKey: ['visitor-chat-messages', selectedSessionId],
    queryFn: () => base44.entities.VisitorChatMessage.filter({ session_id: selectedSessionId }, '-created_date', 100),
    enabled: !!selectedSessionId,
    refetchInterval: 3000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Join chat (take over from AI)
  const joinMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.VisitorChatSession.update(selectedSessionId, {
        status: 'pastoral_active',
        pastoral_joined_by: user?.email,
        pastoral_joined_name: user?.full_name || user?.email,
      });
      await base44.entities.VisitorChatMessage.create({
        session_id: selectedSessionId,
        church_id: churchId,
        sender_type: 'system',
        sender_name: 'System',
        body: `A member of our Pastoral Team has joined the chat.`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-chat-sessions', churchId] });
      queryClient.invalidateQueries({ queryKey: ['visitor-chat-messages', selectedSessionId] });
      toast.success('You have joined the chat');
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.VisitorChatSession.update(selectedSessionId, { status: 'closed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-chat-sessions', churchId] });
      toast.success('Chat closed');
    },
  });

  // Send pastoral response
  const sendMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.VisitorChatMessage.create({
        session_id: selectedSessionId,
        church_id: churchId,
        sender_type: 'pastoral',
        sender_name: user?.full_name || user?.email,
        sender_email: user?.email,
        body: text.trim(),
      });
      await base44.entities.VisitorChatSession.update(selectedSessionId, {
        last_message_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visitor-chat-messages', selectedSessionId] });
      queryClient.invalidateQueries({ queryKey: ['visitor-chat-sessions', churchId] });
      setText('');
    },
    onError: () => toast.error('Failed to send message'),
  });

  const handleSend = () => {
    if (!text.trim()) return;
    sendMutation.mutate();
  };

  const handleJoin = () => {
    if (!isChurchAdmin && !isGlobalAdmin) {
      toast.error('Only church admins or global admins can join visitor chats');
      return;
    }
    joinMutation.mutate();
  };

  const canRespond = isChurchAdmin || isGlobalAdmin;
  const sortedMessages = [...messages].reverse();
  const sessionStatus = selectedSession?.status;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sessions list */}
      <div className={`${mobileShowChat ? 'hidden' : 'flex'} flex-col w-full sm:w-72 border-r flex-shrink-0 bg-muted/20`}>
        <div className="p-3 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Visitor Messages</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-6">
              <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">No visitor conversations yet</p>
            </div>
          ) : (
            sessions.map(s => {
              const config = STATUS_CONFIG[s.status] || STATUS_CONFIG.ai_active;
              const isSelected = s.id === selectedSessionId;
              return (
                <button
                  key={s.id}
                  onClick={() => { setSelectedSessionId(s.id); setMobileShowChat(true); }}
                  className={`w-full text-left p-3 border-b hover:bg-muted/40 transition-colors ${
                    isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {s.visitor_name || s.visitor_email || 'Anonymous Visitor'}
                    </span>
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${config.color}`}>
                      {config.label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {s.is_during_service && (
                      <span className="flex items-center gap-0.5 text-red-500 font-medium">
                        <Radio className="w-3 h-3" /> Live
                      </span>
                    )}
                    {s.last_message_at && <span>{formatTime(s.last_message_at)}</span>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation view */}
      <div className={`${mobileShowChat ? 'flex' : 'hidden'} flex-1 flex-col min-w-0`}>
        {!selectedSession ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center p-8">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">Select a conversation</p>
            <p className="text-sm mt-1">Choose a visitor chat from the list to view the conversation.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center gap-3 flex-shrink-0">
              <button className="sm:hidden p-1" onClick={() => setMobileShowChat(false)}>
                <X className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">
                  {selectedSession.visitor_name || selectedSession.visitor_email || 'Anonymous Visitor'}
                </p>
                {selectedSession.visitor_email && (
                  <p className="text-xs text-muted-foreground truncate">{selectedSession.visitor_email}</p>
                )}
              </div>
              <Badge variant="outline" className={`text-xs ${STATUS_CONFIG[sessionStatus]?.color}`}>
                {STATUS_CONFIG[sessionStatus]?.label}
              </Badge>
              {selectedSession.is_during_service && (
                <Badge className="text-xs bg-red-500/20 text-red-600 border-red-400">
                  <Radio className="w-3 h-3 mr-1" /> During Service
                </Badge>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sortedMessages.map(msg => {
                const isVisitor = msg.sender_type === 'visitor';
                const isSystem = msg.sender_type === 'system';
                const isAI = msg.sender_type === 'ai';
                const isPastoral = msg.sender_type === 'pastoral';

                if (isSystem) {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <div className="px-3 py-1.5 rounded-full bg-muted text-muted-foreground text-xs text-center max-w-[85%]">
                        {msg.body}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={msg.id} className={`flex gap-2.5 ${isVisitor ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isVisitor ? 'bg-primary text-primary-foreground' : isPastoral ? 'bg-green-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isVisitor ? <UserIcon className="w-4 h-4" /> : isPastoral ? <Church className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`max-w-[75%] flex flex-col gap-0.5 ${isVisitor ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium">
                          {isVisitor ? (selectedSession.visitor_name || 'Visitor') : msg.sender_name || (isPastoral ? 'Pastoral Team' : 'AI Assistant')}
                        </span>
                        <span className="opacity-60">{formatTime(msg.created_date)}</span>
                      </div>
                      <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
                        isVisitor
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : isPastoral
                            ? 'bg-green-600/15 text-foreground rounded-tl-sm'
                            : 'bg-muted text-foreground rounded-tl-sm'
                      }`}>
                        {msg.body}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Action area */}
            <div className="p-3 border-t flex-shrink-0">
              {sessionStatus === 'closed' ? (
                <div className="text-center text-sm text-muted-foreground py-2">This conversation has been closed.</div>
              ) : sessionStatus === 'ai_active' || sessionStatus === 'waiting_for_pastoral' ? (
                <div className="space-y-2">
                  {!canRespond && (
                    <p className="text-xs text-amber-600 text-center">Only church admins can join and respond to visitor chats.</p>
                  )}
                  <Button
                    onClick={handleJoin}
                    disabled={!canRespond || joinMutation.isPending}
                    className="w-full gap-2"
                  >
                    <Church className="w-4 h-4" />
                    {joinMutation.isPending ? 'Joining...' : 'Join Chat & Take Over'}
                  </Button>
                </div>
              ) : sessionStatus === 'pastoral_active' ? (
                canRespond ? (
                  <div className="flex gap-2">
                    <Textarea
                      value={text}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      placeholder="Type your response to the visitor..."
                      rows={2}
                      className="flex-1 resize-none text-sm"
                    />
                    <Button
                      size="icon"
                      className="h-full aspect-square self-end"
                      onClick={handleSend}
                      disabled={!text.trim() || sendMutation.isPending}
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm">
                    <Church className="w-4 h-4" />
                    {selectedSession.pastoral_joined_name || 'A pastoral team member'} is handling this chat. Only admins can respond.
                  </div>
                )
              ) : null}
              {canRespond && sessionStatus !== 'closed' && (
                <button
                  onClick={() => closeSessionMutation.mutate()}
                  className="w-full text-xs text-muted-foreground hover:text-destructive mt-2"
                >
                  Close conversation
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}