import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Send, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function AnnounceDialog({ group, user, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    body: '',
    type: 'announcement',
    send_email: true,
    scheduled_for: '',
    status: 'sent',
  });
  const [scheduling, setScheduling] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ['ministry-members', group.id],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ group_id: group.id }),
  });

  const sendMutation = useMutation({
    mutationFn: async (data) => {
      const announcement = await base44.entities.MinistryAnnouncement.create({
        ...data,
        group_id: group.id,
        church_id: group.church_id,
        sender_name: user.full_name,
        sender_email: user.email,
        status: scheduling ? 'scheduled' : 'sent',
        scheduled_for: scheduling ? data.scheduled_for : null,
      });
      if (data.send_email && !scheduling) {
        await base44.functions.invoke('ministryMailer', { announcement_id: announcement.id });
      }
      return announcement;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-announcements'] });
      toast.success(scheduling ? 'Announcement scheduled!' : 'Announcement sent!');
      onClose();
    },
  });

  const recipientNames = members.map(m => m.member_name);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Send to {group.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Recipients preview (names only) */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5" /> Recipients ({members.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recipientNames.slice(0, 8).map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{name}</Badge>
              ))}
              {recipientNames.length > 8 && (
                <Badge variant="secondary" className="text-xs">+{recipientNames.length - 8} more</Badge>
              )}
              {members.length === 0 && <p className="text-xs text-muted-foreground">No members in this group yet.</p>}
            </div>
          </div>

          <div>
            <Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="announcement">📢 Announcement</SelectItem>
                <SelectItem value="message">💬 Message</SelectItem>
                <SelectItem value="reminder">🔔 Reminder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Subject / Title *</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Rehearsal this Sunday" className="mt-1" />
          </div>

          <div>
            <Label>Message *</Label>
            <Textarea value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} rows={5} placeholder="Write your message here…" className="mt-1" />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">Send via Email</p>
              <p className="text-xs text-muted-foreground">Email members who have addresses on file</p>
            </div>
            <Switch checked={form.send_email} onCheckedChange={v => setForm({ ...form, send_email: v })} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Schedule</p>
                <p className="text-xs text-muted-foreground">Send at a future date/time</p>
              </div>
            </div>
            <Switch checked={scheduling} onCheckedChange={setScheduling} />
          </div>

          {scheduling && (
            <div>
              <Label>Send At</Label>
              <Input type="datetime-local" value={form.scheduled_for} onChange={e => setForm({ ...form, scheduled_for: e.target.value })} className="mt-1" />
            </div>
          )}

          <Button className="w-full gap-2" onClick={() => sendMutation.mutate(form)}
            disabled={!form.title || !form.body || sendMutation.isPending || (scheduling && !form.scheduled_for)}>
            <Send className="w-4 h-4" />
            {sendMutation.isPending ? 'Sending…' : scheduling ? 'Schedule Announcement' : 'Send Now'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}