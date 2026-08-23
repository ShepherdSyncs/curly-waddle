import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield } from 'lucide-react';

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'members_only', label: 'Members Only' },
  { value: 'private', label: 'Private (Hidden)' },
];

export default function EditProfileDialog({ profile, user, onSave, onClose, isSaving }) {
  const [form, setForm] = useState({
    display_name: profile?.display_name || user?.full_name || '',
    bio: profile?.bio || '',
    phone: profile?.phone || '',
    address: profile?.address || '',
    birthday: profile?.birthday || '',
    profile_photo_url: profile?.profile_photo_url || '',
    ministry_roles: (profile?.ministry_roles || []).join(', '),
    prayer_partner: profile?.prayer_partner || false,
    show_in_directory: profile?.show_in_directory !== false,
    privacy_email: profile?.privacy_email || 'members_only',
    privacy_phone: profile?.privacy_phone || 'members_only',
    privacy_address: profile?.privacy_address || 'private',
    privacy_birthday: profile?.privacy_birthday || 'members_only',
  });

  const handleSave = () => {
    onSave({
      ...form,
      ministry_roles: form.ministry_roles ? form.ministry_roles.split(',').map(r => r.trim()).filter(Boolean) : [],
    });
  };

  const Field = ({ label, children }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );

  return (
    <Dialog open={true} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit My Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Basic Info */}
          <div className="space-y-3">
            <Field label="Display Name">
              <Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="Your name" />
            </Field>
            <Field label="Bio / About Me">
              <Textarea rows={3} value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="Share a little about yourself…" />
            </Field>
            <Field label="Profile Photo URL">
              <Input value={form.profile_photo_url} onChange={e => setForm({ ...form, profile_photo_url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Ministry Roles (comma separated)">
              <Input value={form.ministry_roles} onChange={e => setForm({ ...form, ministry_roles: e.target.value })} placeholder="Worship, Usher, Youth Leader" />
            </Field>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact Information</p>
            <Field label="Phone"><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 000-0000" /></Field>
            <Field label="Address"><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="City, State" /></Field>
            <Field label="Birthday"><Input type="date" value={form.birthday} onChange={e => setForm({ ...form, birthday: e.target.value })} /></Field>
          </div>

          {/* Privacy */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> Privacy Settings
            </p>
            {[
              { label: 'Who can see my email', key: 'privacy_email' },
              { label: 'Who can see my phone', key: 'privacy_phone' },
              { label: 'Who can see my address', key: 'privacy_address' },
              { label: 'Who can see my birthday', key: 'privacy_birthday' },
            ].map(({ label, key }) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <Label className="text-xs text-muted-foreground flex-1">{label}</Label>
                <Select value={form[key]} onValueChange={v => setForm({ ...form, [key]: v })}>
                  <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIVACY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {/* Directory & Prayer */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.show_in_directory} onChange={e => setForm({ ...form, show_in_directory: e.target.checked })} />
              Show me in the member directory
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.prayer_partner} onChange={e => setForm({ ...form, prayer_partner: e.target.checked })} />
              I'm available as a prayer partner
            </label>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save Profile'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}