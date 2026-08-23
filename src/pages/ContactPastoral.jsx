import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mail, Send, CheckCircle2, Heart } from 'lucide-react';
import { toast } from 'sonner';

export default function ContactPastoral() {
  const { user, loading } = useAppUser();
  const [church, setChurch] = useState(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!user?.church_id) return;
    base44.entities.Church.filter({ id: user.church_id })
      .then(res => { if (res?.length) setChurch(res[0]); })
      .catch(() => {});
  }, [user?.church_id]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (!church) {
      toast.error('Could not find your church. Please contact your church administrator directly.');
      return;
    }

    const adminEmails = church.admin_emails?.length
      ? church.admin_emails
      : church.admin_email
        ? [church.admin_email]
        : church.email
          ? [church.email]
          : [];

    if (adminEmails.length === 0) {
      toast.error('No pastoral team email found for your church');
      return;
    }

    setSending(true);
    const senderName = user?.full_name || user?.email || 'A church member';
    const senderEmail = user?.email || 'unknown';
    const emailSubject = subject.trim() || `Message from ${senderName}`;
    const body = `Hello ${church.pastor_name || 'Pastoral Team'},

You have received a new message from a church member via ShepherdSyncs.

From: ${senderName} (${senderEmail})
Subject: ${emailSubject}

Message:
${message.trim()}

---
You can reply directly to this member's email address above.
Sent via ShepherdSyncs — Contact Pastoral Team feature`;

    try {
      await base44.entities.PastoralMessage.create({
        church_id: user.church_id,
        church_name: church.name,
        sender_name: senderName,
        sender_email: senderEmail,
        subject: subject.trim(),
        body: message.trim(),
        status: 'new',
        church_admin_emails: adminEmails,
      });

      for (const email of adminEmails) {
        try {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: emailSubject,
            body,
            from_name: senderName,
          });
        } catch (e) {
          // best-effort per recipient
        }
      }
      setSent(true);
      setSubject('');
      setMessage('');
      toast.success('Your message has been sent to the pastoral team');
    } catch (err) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Contact Pastoral Team</h1>
          <p className="text-muted-foreground text-sm">Send a private message to your church's pastoral team</p>
        </div>
      </div>

      {sent ? (
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Message Sent</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Your message has been sent to the pastoral team at {church?.name || 'your church'}. They will get back to you as soon as possible.
            </p>
            <Button onClick={() => setSent(false)} variant="outline">
              Send Another Message
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Send a Message</CardTitle>
            <CardDescription>
              This goes directly to your pastoral team. For urgent matters, please contact your church office directly.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Subject (optional)</Label>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What would you like to discuss?"
                disabled={sending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Share your thoughts, questions, or prayer needs with the pastoral team..."
                rows={6}
                disabled={sending}
              />
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground">
              <Heart className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
              <span>Your message will be sent to the pastoral team at {church?.name || 'your church'} and they can reply to you at {user?.email || 'your email on file'}.</span>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={sending || !message.trim()} className="gap-2">
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send Message'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}