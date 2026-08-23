import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { User, Droplets, Flame, Heart } from 'lucide-react';

export default function ProfileTab({ user }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: memberRecords = [] } = useQuery({
    queryKey: ['my-member-record-profile', user?.email],
    queryFn: () => base44.entities.ChurchMember.filter({ email: user?.email }),
    enabled: !!user?.email,
  });
  const member = memberRecords[0];

  useEffect(() => {
    if (!form && (member || user)) {
      const fullName = member ? `${member.first_name} ${member.last_name}` : user?.full_name || '';
      const parts = fullName.split(' ');
      setForm({
        first_name: member?.first_name || parts[0] || '',
        last_name: member?.last_name || parts.slice(1).join(' ') || '',
        phone: member?.phone || '',
        address: member?.address || '',
        date_of_birth: member?.date_of_birth || '',
        wedding_anniversary: member?.wedding_anniversary || '',
        baptism_date: member?.baptism_date || '',
        holy_ghost_date: member?.holy_ghost_date || '',
      });
    }
  }, [member, user, form]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fullName = `${form.first_name} ${form.last_name}`.trim();
      if (member) {
        await base44.entities.ChurchMember.update(member.id, form);
      } else if (user?.church_id) {
        await base44.entities.ChurchMember.create({
          ...form, email: user.email, church_id: user.church_id, status: 'active',
        });
      } else {
        toast.error('No church assigned to your account');
        setSaving(false);
        return;
      }
      if (fullName && fullName !== user?.full_name) {
        await base44.auth.updateMe({ full_name: fullName });
      }
      queryClient.invalidateQueries({ queryKey: ['my-member-record-profile'] });
      toast.success('Profile updated');
    } catch (e) {
      toast.error('Failed to update profile');
    }
    setSaving(false);
  };

  if (!form) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> My Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>First Name</Label>
            <Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user?.email || ''} disabled className="bg-muted/40" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 000-0000" />
          </div>
          <div className="sm:col-span-2">
            <Label>Address</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, State" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <Label>Date of Birth</Label>
            <Input type="date" value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5 text-pink-500" /> Wedding Anniversary</Label>
            <Input type="date" value={form.wedding_anniversary} onChange={e => setForm({ ...form, wedding_anniversary: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5 text-blue-500" /> Baptism Date</Label>
            <Input type="date" value={form.baptism_date} onChange={e => setForm({ ...form, baptism_date: e.target.value })} />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-500" /> Holy Ghost Date</Label>
            <Input type="date" value={form.holy_ghost_date} onChange={e => setForm({ ...form, holy_ghost_date: e.target.value })} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Profile'}
        </Button>
      </CardContent>
    </Card>
  );
}