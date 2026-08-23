import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { UserPlus, Trash2, Search, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

export default function ManageGroupDialog({ group, isAdmin, user, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: group?.name || '',
    description: group?.description || '',
    category: group?.category || 'other',
    leader_email: group?.leader_email || '',
    leader_name: group?.leader_name || '',
    attendance_leader_email: group?.attendance_leader_email || '',
    attendance_leader_name: group?.attendance_leader_name || '',
    color: group?.color || '#6366f1',
  });
  const [search, setSearch] = useState('');
  const [newMember, setNewMember] = useState({ member_name: '', member_email: '', role_in_group: '' });

  const { data: members = [] } = useQuery({
    queryKey: ['ministry-members', group?.id],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ group_id: group.id }),
    enabled: !!group?.id,
  });

  const { data: directoryProfiles = [] } = useQuery({
    queryKey: ['member-profiles', user?.church_id],
    queryFn: () => base44.entities.MemberProfile.filter({ church_id: user.church_id, show_in_directory: true }, 'display_name', 200),
    enabled: !!user?.church_id,
  });

  const saveGroupMutation = useMutation({
    mutationFn: (data) => group?.id
      ? base44.entities.MinistryGroup.update(group.id, data)
      : base44.entities.MinistryGroup.create({ ...data, church_id: user.church_id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-groups'] });
      toast.success(group?.id ? 'Group updated' : 'Group created');
      onSaved?.();
      if (!group?.id) onClose();
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (data) => base44.entities.MinistryGroupMember.create({
      ...data,
      group_id: group.id,
      church_id: user.church_id,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-members', group?.id] });
      setNewMember({ member_name: '', member_email: '', role_in_group: '' });
      toast.success('Member added');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (id) => base44.entities.MinistryGroupMember.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-members', group?.id] });
      toast.success('Member removed');
    },
  });

  const addFromDirectory = (profile) => {
    const alreadyAdded = members.some(m => m.member_email === profile.user_email);
    if (alreadyAdded) { toast.error('Already in group'); return; }
    addMemberMutation.mutate({
      member_name: profile.display_name || profile.user_email,
      member_email: profile.user_email,
      role_in_group: '',
      in_directory: true,
    });
  };

  const filteredDirectory = directoryProfiles.filter(p => {
    if (!search) return true;
    return (p.display_name || '').toLowerCase().includes(search.toLowerCase());
  });

  const CATEGORIES = ['worship', 'youth', 'greeters', 'pastoral', 'janitorial', 'outreach', 'prayer', 'media', 'hospitality', 'other'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{group?.id ? `Manage: ${group.name}` : 'Create Ministry Group'}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={group?.id ? 'members' : 'details'}>
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="details">Group Details</TabsTrigger>
            {group?.id && <TabsTrigger value="members">Members ({members.length})</TabsTrigger>}
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Group Name *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Worship Team" />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Color</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              {isAdmin && (
                <>
                  <div>
                    <Label>Leader Email</Label>
                    <Input value={form.leader_email} onChange={e => setForm({ ...form, leader_email: e.target.value })} placeholder="leader@church.org" type="email" />
                  </div>
                  <div>
                    <Label>Leader Name</Label>
                    <Input value={form.leader_name} onChange={e => setForm({ ...form, leader_name: e.target.value })} placeholder="Full name" />
                  </div>
                  <div>
                    <Label>Attendance Leader Email</Label>
                    <Input value={form.attendance_leader_email} onChange={e => setForm({ ...form, attendance_leader_email: e.target.value })} placeholder="attendance@church.org" type="email" />
                    <p className="text-xs text-muted-foreground mt-1">Can take attendance only — cannot edit group or schedule.</p>
                  </div>
                  <div>
                    <Label>Attendance Leader Name</Label>
                    <Input value={form.attendance_leader_name} onChange={e => setForm({ ...form, attendance_leader_name: e.target.value })} placeholder="Full name" />
                  </div>
                </>
              )}
            </div>
            <Button className="w-full" onClick={() => saveGroupMutation.mutate(form)} disabled={!form.name || saveGroupMutation.isPending}>
              {saveGroupMutation.isPending ? 'Saving…' : group?.id ? 'Save Changes' : 'Create Group'}
            </Button>
          </TabsContent>

          {group?.id && (
            <TabsContent value="members" className="space-y-4 mt-4">
              {/* Current members */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Current Members</p>
                {members.length === 0 && <p className="text-sm text-muted-foreground">No members yet.</p>}
                {members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-lg border bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                      {m.member_name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.member_name}</p>
                      {m.role_in_group && <p className="text-xs text-muted-foreground">{m.role_in_group}</p>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {m.in_directory ? (
                        <Badge variant="outline" className="text-xs gap-1"><Eye className="w-3 h-3" /> Directory</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs gap-1 text-muted-foreground"><EyeOff className="w-3 h-3" /> Off-directory</Badge>
                      )}
                      <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => removeMemberMutation.mutate(m.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add from directory */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-semibold">Add from Directory</p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input className="pl-8 text-sm" placeholder="Search directory members…" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredDirectory.filter(p => !members.some(m => m.member_email === p.user_email)).map(p => (
                    <button key={p.id} type="button" onClick={() => addFromDirectory(p)}
                      className="w-full text-left flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {p.display_name?.[0] || '?'}
                      </div>
                      <span className="flex-1 truncate">{p.display_name}</span>
                      <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Add manually (off-directory) */}
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm font-semibold">Add Member Manually</p>
                <div className="grid grid-cols-3 gap-2">
                  <Input placeholder="Full name *" value={newMember.member_name} onChange={e => setNewMember({ ...newMember, member_name: e.target.value })} className="text-sm" />
                  <Input placeholder="Email (optional)" value={newMember.member_email} onChange={e => setNewMember({ ...newMember, member_email: e.target.value })} className="text-sm" />
                  <Input placeholder="Role (optional)" value={newMember.role_in_group} onChange={e => setNewMember({ ...newMember, role_in_group: e.target.value })} className="text-sm" />
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" disabled={!newMember.member_name || addMemberMutation.isPending}
                  onClick={() => addMemberMutation.mutate({ ...newMember, in_directory: false })}>
                  <UserPlus className="w-3.5 h-3.5" /> Add Member
                </Button>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}