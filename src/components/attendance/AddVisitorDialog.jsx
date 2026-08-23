import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AddVisitorDialog({ churchId, churchAdminEmail, user, serviceDate, onClose, onAdded }) {
  const [form, setForm] = useState({ visitor_name: '', visitor_email: '', visitor_phone: '' });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.visitor_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);

    // Split name into first/last for ChurchMember record
    const nameParts = form.visitor_name.trim().split(' ');
    const first_name = nameParts[0] || form.visitor_name.trim();
    const last_name = nameParts.slice(1).join(' ') || '';

    // Create a ChurchMember with status 'visitor' so they appear in the Guests tab
    let guestMember;
    try {
      // Avoid duplicates — check if a visitor with the same name already exists
      const existing = await base44.entities.ChurchMember.filter({
        church_id: churchId, status: 'visitor', first_name, last_name,
      });
      if (existing.length === 0) {
        guestMember = await base44.entities.ChurchMember.create({
          church_id: churchId,
          first_name,
          last_name,
          email: form.visitor_email || '',
          phone: form.visitor_phone || '',
          status: 'visitor',
          member_since: serviceDate,
        });
      } else {
        guestMember = existing[0];
      }
    } catch (_) {}

    // Create follow-up task
    await base44.entities.FollowUpTask.create({
      church_id: churchId,
      visitor_name: form.visitor_name,
      visitor_email: form.visitor_email,
      status: 'pending',
      date_added: serviceDate,
      added_by_name: user?.full_name || user?.email || 'Staff',
      added_by_email: user?.email || '',
    });

    // Send email to person who added + church admin
    const recipients = [user?.email, churchAdminEmail].filter(Boolean);
    for (const to of recipients) {
      if (!to) continue;
      await base44.integrations.Core.SendEmail({
        to,
        subject: `New Visitor: ${form.visitor_name} — Follow-Up Needed`,
        body: `A new visitor was recorded on ${format(new Date(serviceDate + 'T00:00:00'), 'MMMM d, yyyy')}.\n\n` +
          `Name: ${form.visitor_name}\n` +
          `Email: ${form.visitor_email || 'Not provided'}\n` +
          `Added by: ${user?.full_name || user?.email || 'Staff'}\n\n` +
          `Please follow up with this visitor. You can assign a follow-up task from the Attendance page.`,
      });
    }

    toast.success(`Guest added — follow-up emails sent`);
    onAdded?.({ id: guestMember?.id || `visitor-${Date.now()}`, member_name: form.visitor_name, isVisitor: true });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Add Visitor / Guest
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <p className="text-sm text-muted-foreground">This will create a follow-up task and notify the church admin.</p>
          <div>
            <Label>Full Name *</Label>
            <Input value={form.visitor_name} onChange={e => setForm({ ...form, visitor_name: e.target.value })} placeholder="Visitor's full name" />
          </div>
          <div>
            <Label>Email Address</Label>
            <Input value={form.visitor_email} onChange={e => setForm({ ...form, visitor_email: e.target.value })} placeholder="visitor@email.com" type="email" />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input value={form.visitor_phone} onChange={e => setForm({ ...form, visitor_phone: e.target.value })} placeholder="(555) 000-0000" type="tel" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Add Visitor'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}