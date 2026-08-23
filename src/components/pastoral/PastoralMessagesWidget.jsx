import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Mail, X, Send, ChevronLeft, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function PastoralMessagesWidget() {
  const { user, isChurchAdmin } = useAppUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!user?.church_id) return;
    try {
      const res = await base44.entities.PastoralMessage.filter(
        { church_id: user.church_id },
        '-created_date',
        50
      );
      setMessages(res || []);
    } catch (e) {
      // silent
    }
  }, [user?.church_id]);

  useEffect(() => {
    if (!isChurchAdmin || !user?.church_id) return;
    fetchMessages();
    const unsubscribe = base44.entities.PastoralMessage.subscribe(() => {
      fetchMessages();
    });
    return unsubscribe;
  }, [isChurchAdmin, user?.church_id, fetchMessages]);

  const unreadCount = messages.filter(m => m.status === 'new').length;

  const handleReply = async () => {
    if (!reply.trim() || !selected) return;
    setSending(true);
    try {
      await base44.entities.PastoralMessage.update(selected.id, {
        status: 'replied',
        reply_body: reply.trim(),
        replied_by_name: user?.full_name || user?.email || 'Pastoral Team',
        replied_by_email: user?.email,
        replied_at: new Date().toISOString(),
      });

      await base44.integrations.Core.SendEmail({
        to: selected.sender_email,
        subject: `Re: ${selected.subject || 'Your message to the pastoral team'}`,
        body: `Hello ${selected.sender_name},\n\nThe pastoral team has replied to your message:\n\n--- Your original message ---\n${selected.body}\n--- End ---\n\nReply:\n${reply.trim()}\n\n— ${user?.full_name || 'Pastoral Team'}\n${user?.church_name || ''}`,
        from_name: user?.church_name || 'Pastoral Team',
      });

      setReply('');
      toast.success('Reply sent');
      setSelected(null);
      fetchMessages();
    } catch (e) {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  if (!isChurchAdmin) return null;

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
          aria-label="Pastoral Messages"
        >
          <Mail className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-5 h-5 flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-96 h-[32rem] max-h-[80vh] bg-card border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              {selected && (
                <button onClick={() => setSelected(null)} className="hover:opacity-80">
                  <ChevronLeft className="w-4 h-4" />
                </button>
              )}
              <Inbox className="w-4 h-4" />
              <span className="font-semibold text-sm">
                {selected ? 'Reply to Message' : 'Pastoral Messages'}
              </span>
            </div>
            <button onClick={() => { setOpen(false); setSelected(null); }} className="hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          {selected ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="font-semibold text-sm">{selected.sender_name}</p>
                  <p className="text-xs text-muted-foreground">{selected.sender_email}</p>
                </div>
                {selected.subject && (
                  <div>
                    <p className="text-xs text-muted-foreground">Subject</p>
                    <p className="text-sm font-medium">{selected.subject}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Message</p>
                  <p className="text-sm whitespace-pre-wrap mt-1">{selected.body}</p>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {selected.created_date ? format(new Date(selected.created_date), 'MMM d, h:mm a') : ''}
                </p>
                {selected.status === 'replied' && selected.reply_body && (
                  <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-primary font-semibold mb-1">Replied by {selected.replied_by_name}</p>
                    <p className="text-sm whitespace-pre-wrap">{selected.reply_body}</p>
                  </div>
                )}
              </div>
              {selected.status !== 'replied' && (
                <div className="border-t border-border p-3 space-y-2">
                  <Textarea
                    value={reply}
                    onChange={e => setReply(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    disabled={sending}
                  />
                  <Button onClick={handleReply} disabled={sending || !reply.trim()} size="sm" className="w-full gap-2">
                    <Send className="w-3.5 h-3.5" />
                    {sending ? 'Sending…' : 'Send Reply'}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6 text-center">
                  <Inbox className="w-10 h-10 mb-2 opacity-30" />
                  <p className="text-sm">No messages yet</p>
                  <p className="text-xs mt-1">Messages from the Contact Pastoral Team form will appear here.</p>
                </div>
              ) : (
                messages.map(msg => (
                  <button
                    key={msg.id}
                    onClick={() => setSelected(msg)}
                    className={`w-full text-left px-4 py-3 border-b border-border hover:bg-accent/50 transition-colors ${msg.status === 'new' ? 'bg-primary/5' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {msg.status === 'new' && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          <p className="font-semibold text-sm truncate">{msg.sender_name}</p>
                        </div>
                        {msg.subject && <p className="text-xs font-medium truncate mt-0.5">{msg.subject}</p>}
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.body}</p>
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {msg.created_date ? format(new Date(msg.created_date), 'M/d') : ''}
                      </span>
                    </div>
                    {msg.status === 'replied' && (
                      <span className="inline-block mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ Replied</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}