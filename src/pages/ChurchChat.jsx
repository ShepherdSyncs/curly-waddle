import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Send, MessageSquare, Megaphone, Trash2, Hash, Users, Pin, ChevronRight, Menu } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import useAppUser from '@/hooks/useAppUser';
import { hasTierFeature } from '@/lib/tiers';
import VisitorChatInbox from '@/components/chat/VisitorChatInbox';
import MassTextingTab from '@/components/chat/MassTextingTab';

function formatMsgDate(d) {
  const date = new Date(d);
  if (isToday(date)) return format(date, 'h:mm a');
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`;
  return format(date, 'MMM d · h:mm a');
}

// Youth members (age 8–17) can read group channels and reply, but cannot initiate in general
// Adults can chat freely; admins/leaders can send announcements
function isYouthRole(user) {
  return user?.role === 'youth';
}

function canSendInGeneral(user, isChurchAdmin, isMinistryStaff) {
  // Youth cannot post in general channel
  if (isYouthRole(user)) return false;
  return true;
}

function canSendAnnouncement(user, isChurchAdmin, isMinistryStaff, group, groups) {
  if (isChurchAdmin) return true;
  if (!group) return false;
  // Group leader of this specific group
  return group?.leader_email === user?.email;
}

export default function ChurchChat() {
  const { user, loading, isChurchAdmin, isMinistryStaff, activeChurch } = useAppUser();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState({ type: 'general', group: null });
  const [text, setText] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commTab, setCommTab] = useState('chat');
  const bottomRef = useRef(null);

  const churchTier = activeChurch?.subscription_tier || 'free';
  const canMassText = isChurchAdmin && hasTierFeature(churchTier, 'massTexting');

  const churchId = user?.church_id;

  // Fetch ministry groups user belongs to (or all if admin)
  const { data: groups = [] } = useQuery({
    queryKey: ['ministry-groups-chat', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId, is_active: true }),
    enabled: !!churchId,
  });

  // Fetch ministry group memberships to know which groups user is in
  const { data: memberships = [] } = useQuery({
    queryKey: ['ministry-memberships-chat', churchId, user?.email],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ church_id: churchId, member_email: user?.email }),
    enabled: !!churchId && !!user?.email,
  });

  // Determine which groups this user can see
  const visibleGroupIds = new Set(memberships.map(m => m.group_id));
  const visibleGroups = isChurchAdmin
    ? groups
    : groups.filter(g =>
        g.leader_email === user?.email ||
        g.attendance_leader_email === user?.email ||
        visibleGroupIds.has(g.id)
      );

  // Build query key based on active channel
  const channelKey = activeChannel.type === 'general'
    ? ['church-chat', churchId, 'general']
    : ['church-chat', churchId, 'group', activeChannel.group?.id];

  const { data: messages = [], isLoading } = useQuery({
    queryKey: channelKey,
    queryFn: async () => {
      if (activeChannel.type === 'general') {
        return base44.entities.ChurchChatMessage.filter(
          { church_id: churchId, channel_type: 'general' },
          '-created_date', 100
        );
      } else {
        return base44.entities.ChurchChatMessage.filter(
          { church_id: churchId, channel_type: 'group', group_id: activeChannel.group?.id },
          '-created_date', 100
        );
      }
    },
    enabled: !!churchId,
    refetchInterval: 10000,
  });

  // Real-time subscription
  useEffect(() => {
    if (!churchId) return;
    const unsub = base44.entities.ChurchChatMessage.subscribe((event) => {
      if (event.data?.church_id !== churchId) return;
      queryClient.invalidateQueries({ queryKey: ['church-chat', churchId] });
    });
    return unsub;
  }, [churchId, queryClient]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sorted = [...messages].reverse();

  const activeGroup = activeChannel.group;
  const canSend = activeChannel.type === 'general'
    ? canSendInGeneral(user, isChurchAdmin, isMinistryStaff)
    : true; // all group members can reply in group channels

  const canAnnounce = canSendAnnouncement(user, isChurchAdmin, isMinistryStaff, activeGroup, groups);

  const sendMutation = useMutation({
    mutationFn: () => base44.entities.ChurchChatMessage.create({
      church_id: churchId,
      channel_type: activeChannel.type,
      group_id: activeGroup?.id || null,
      group_name: activeGroup?.name || null,
      sender_id: user?.id,
      sender_name: user?.full_name || user?.email,
      sender_email: user?.email,
      sender_role: user?.role,
      body: text.trim(),
      is_announcement: isAnnouncement,
      pinned: false,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: channelKey });
      setText('');
      if (isAnnouncement) {
        toast.success('Announcement sent to channel');
        setIsAnnouncement(false);
      }
    },
    onError: () => toast.error('Failed to send message'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ChurchChatMessage.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: channelKey }),
  });

  const handleSend = () => {
    if (!text.trim() || !canSend) return;
    sendMutation.mutate();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!churchId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-center p-8">
        <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
        <p className="font-medium">No church connected</p>
        <p className="text-sm mt-1">You need to be a verified church member to access chat.</p>
      </div>
    );
  }

  const channelLabel = activeChannel.type === 'general'
    ? '# general'
    : `# ${activeGroup?.name || 'Group'}`;

  return (
    <div className="space-y-4">
    {canMassText && (
      <Tabs value={commTab} onValueChange={setCommTab}>
        <TabsList>
          <TabsTrigger value="chat">Church Chat</TabsTrigger>
          <TabsTrigger value="mass-texting">Mass Texting</TabsTrigger>
        </TabsList>
      </Tabs>
    )}
    {(!canMassText || commTab === 'chat') ? (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden rounded-xl border bg-card">
      {/* Mobile sidebar toggle */}
      <button
        className="lg:hidden absolute top-4 left-4 z-20 p-2 bg-muted rounded-lg"
        onClick={() => setSidebarOpen(v => !v)}
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Channel sidebar */}
      <aside className={`
        ${sidebarOpen ? 'flex' : 'hidden'} lg:flex
        flex-col w-56 flex-shrink-0 border-r bg-muted/30
        absolute lg:static inset-y-0 left-0 z-10 lg:z-auto
      `}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Church Chat</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{user?.church_name}</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {/* Visitor Messages — church admin / staff only */}
          {(isChurchAdmin || isMinistryStaff) && (
            <button
              onClick={() => { setActiveChannel({ type: 'visitors', group: null }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left mb-2 ${
                activeChannel.type === 'visitors'
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">Visitor Messages</span>
            </button>
          )}
          {/* General channel — not for youth */}
          {!isYouthRole(user) && (
            <button
              onClick={() => { setActiveChannel({ type: 'general', group: null }); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                activeChannel.type === 'general'
                  ? 'bg-primary/15 text-primary font-semibold'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Hash className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">general</span>
            </button>
          )}

          {/* Group channels */}
          {visibleGroups.length > 0 && (
            <>
              <p className="px-3 pt-3 pb-1 text-xs uppercase tracking-wider text-muted-foreground/60 font-semibold">
                My Groups
              </p>
              {visibleGroups.map(group => {
                const isActive = activeChannel.type === 'group' && activeChannel.group?.id === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => { setActiveChannel({ type: 'group', group }); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
                      isActive
                        ? 'bg-primary/15 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: group.color || '#6366f1' }}
                    />
                    <span className="truncate">{group.name}</span>
                  </button>
                );
              })}
            </>
          )}
        </nav>
      </aside>

      {/* Main chat area — Visitor inbox or regular chat */}
      {activeChannel.type === 'visitors' ? (
        <div className="flex-1 flex flex-col min-w-0">
          <VisitorChatInbox churchId={churchId} />
        </div>
      ) : (
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel header */}
        <div className="px-4 py-3 border-b flex items-center gap-3 flex-shrink-0">
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(true)}>
            <ChevronRight className="w-4 h-4 rotate-180" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {activeChannel.type === 'general'
              ? <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              : <div className="w-4 h-4 rounded-sm flex-shrink-0" style={{ backgroundColor: activeGroup?.color || '#6366f1' }} />
            }
            <span className="font-semibold truncate">
              {activeChannel.type === 'general' ? 'general' : activeGroup?.name}
            </span>
            {activeChannel.type === 'general' && (
              <Badge variant="outline" className="text-xs flex-shrink-0">Church-wide</Badge>
            )}
            {isYouthRole(user) && activeChannel.type === 'group' && (
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-400 flex-shrink-0">Reply only</Badge>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-center py-16">
              <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
              <p className="font-medium">No messages yet</p>
              <p className="text-sm mt-1">
                {activeChannel.type === 'general' ? 'Start the conversation!' : 'Be the first to post in this group.'}
              </p>
            </div>
          ) : sorted.map(msg => {
            const isMe = msg.sender_email === user?.email;
            const canDelete = isMe || isChurchAdmin ||
              (activeChannel.type === 'group' && activeGroup?.leader_email === user?.email);

            return (
              <div key={msg.id} className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                  isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {(msg.sender_name || '?')[0].toUpperCase()}
                </div>

                <div className={`max-w-[75%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className={`flex items-center gap-1.5 text-xs text-muted-foreground ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="font-medium">{isMe ? 'You' : msg.sender_name}</span>
                    {msg.is_announcement && (
                      <Badge className="text-[10px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-600 border-amber-400 border">
                        <Megaphone className="w-2.5 h-2.5 mr-0.5" /> Announcement
                      </Badge>
                    )}
                    <span className="opacity-60">{formatMsgDate(msg.created_date)}</span>
                  </div>

                  <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words ${
                    msg.is_announcement
                      ? 'bg-amber-500/10 border border-amber-400/30 text-foreground rounded-tl-sm'
                      : isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-muted text-foreground rounded-tl-sm'
                  }`}>
                    {msg.body}
                  </div>
                </div>

                {canDelete && (
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity self-start mt-2 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(msg.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Compose area */}
        <div className="p-3 border-t flex-shrink-0">
          {/* Announcement toggle — admins and group leaders only */}
          {canAnnounce && (
            <div className="mb-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAnnouncement(v => !v)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  isAnnouncement
                    ? 'bg-amber-500/20 border-amber-400 text-amber-600 font-semibold'
                    : 'border-muted-foreground/30 text-muted-foreground hover:bg-muted'
                }`}
              >
                <Megaphone className="w-3 h-3" />
                {isAnnouncement ? 'Announcement mode ON' : 'Send as Announcement'}
              </button>
              {isAnnouncement && (
                <span className="text-xs text-muted-foreground">This will be pinned & highlighted for all members</span>
              )}
            </div>
          )}

          {canSend ? (
            <div className="flex gap-2">
              <Textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={
                  isAnnouncement
                    ? `Broadcast announcement to ${channelLabel}…`
                    : `Message ${channelLabel}…`
                }
                rows={2}
                className="flex-1 resize-none text-sm"
              />
              <Button
                size="icon"
                className={`h-full aspect-square self-end ${isAnnouncement ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-primary/90'}`}
                onClick={handleSend}
                disabled={!text.trim() || sendMutation.isPending}
              >
                {isAnnouncement ? <Megaphone className="w-4 h-4" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm">
              <MessageSquare className="w-4 h-4" />
              {isYouthRole(user)
                ? 'Youth members can reply in group channels — select a group from the sidebar.'
                : 'You cannot post in this channel.'}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
    ) : (
      <MassTextingTab />
    )}
    </div>
  );
}