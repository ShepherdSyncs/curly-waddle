import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Crown } from 'lucide-react';
import { toast } from 'sonner';

export default function MemberEditDialog({ open, onOpenChange, member, onSave, isPending, canEditSpiritual = true, churchId, canEditHOH = false }) {
  const [form, setForm] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (member) {
      setForm({
        first_name: member.first_name || '',
        last_name: member.last_name || '',
        email: member.email || '',
        phone: member.phone || '',
        address: member.address || '',
        join_date: member.join_date || '',
        status: member.status || 'active',
        date_of_birth: member.date_of_birth || '',
        date_of_death: member.date_of_death || '',
        baptism_date: member.baptism_date || '',
        holy_ghost_date: member.holy_ghost_date || '',
        wedding_anniversary: member.wedding_anniversary || '',
      });
    }
  }, [member]);

  const { data: familyGroups = [] } = useQuery({
    queryKey: ['family-groups', churchId],
    queryFn: () => base44.entities.FamilyGroup.filter({ church_id: churchId }),
    enabled: !!churchId && open && canEditHOH,
  });

  const myFamilyGroup = familyGroups.find(g => g.head_of_household_id === member?.id);
  const isHOH = !!myFamilyGroup;

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleHOHToggle = async (checked) => {
    if (!member || !churchId) return;
    if (checked) {
      const familyName = `The ${form.last_name || member.last_name} Family`;
      try {
        await base44.entities.FamilyGroup.create({
          church_id: churchId,
          family_name: familyName,
          head_of_household_id: member.id,
          head_of_household_name: `${member.first_name} ${member.last_name}`,
          head_of_household_email: member.email || '',
          members: [],
          member_emails: [member.email].filter(Boolean),
        });
        queryClient.invalidateQueries({ queryKey: ['family-groups'] });
        toast.success(`${member.first_name} is now Head of Household — ${familyName} created`);
      } catch (e) {
        toast.error('Failed to create family group');
      }
    } else {
      if (myFamilyGroup && (myFamilyGroup.members || []).length === 0) {
        try {
          await base44.entities.FamilyGroup.delete(myFamilyGroup.id);
          queryClient.invalidateQueries({ queryKey: ['family-groups'] });
          toast.success('Family group removed');
        } catch (e) {
          toast.error('Failed to remove family group');
        }
      } else {
        toast.message('Use the Family Groups tab to reassign HOH for families with members');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Member — {member?.first_name} {member?.last_name}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="info" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="info" className="flex-1">Contact Info</TabsTrigger>
            {canEditSpiritual && <TabsTrigger value="spiritual" className="flex-1">Spiritual & Dates</TabsTrigger>}
          </TabsList>

          <TabsContent value="info" className="space-y-3 mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input value={form.first_name || ''} onChange={e => set('first_name', e.target.value)} /></div>
              <div><Label>Last Name *</Label><Input value={form.last_name || ''} onChange={e => set('last_name', e.target.value)} /></div>
            </div>
            <div><Label>Email</Label><Input value={form.email || ''} onChange={e => set('email', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={form.phone || ''} onChange={e => set('phone', e.target.value)} /></div>
            <div><Label>Address</Label><Input value={form.address || ''} onChange={e => set('address', e.target.value)} /></div>
            <div><Label>Join Date</Label><Input type="date" value={form.join_date || ''} onChange={e => set('join_date', e.target.value)} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status || 'active'} onValueChange={v => set('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="visitor">Visitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {canEditHOH && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <div>
                    <Label className="cursor-pointer">Head of Household</Label>
                    <p className="text-xs text-muted-foreground">
                      {isHOH ? `HOH of ${myFamilyGroup.family_name}` : 'Create a family group with this member as HOH'}
                    </p>
                  </div>
                </div>
                <Switch checked={isHOH} onCheckedChange={handleHOHToggle} />
              </div>
            )}
          </TabsContent>

          {canEditSpiritual && (
            <TabsContent value="spiritual" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth || ''} onChange={e => set('date_of_birth', e.target.value)} />
                </div>
                <div>
                  <Label>Date of Passing</Label>
                  <Input type="date" value={form.date_of_death || ''} onChange={e => set('date_of_death', e.target.value)} />
                </div>
                <div>
                  <Label>Baptism Date</Label>
                  <Input type="date" value={form.baptism_date || ''} onChange={e => set('baptism_date', e.target.value)} />
                </div>
                <div>
                  <Label>Holy Ghost Date</Label>
                  <Input type="date" value={form.holy_ghost_date || ''} onChange={e => set('holy_ghost_date', e.target.value)} />
                </div>
                <div>
                  <Label>Wedding Anniversary</Label>
                  <Input type="date" value={form.wedding_anniversary || ''} onChange={e => set('wedding_anniversary', e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">These dates are visible to church admins and ministry staff only.</p>
            </TabsContent>
          )}
        </Tabs>
        <Button
          className="w-full mt-2"
          onClick={() => onSave(form)}
          disabled={!form.first_name || !form.last_name || isPending}
        >
          {isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}