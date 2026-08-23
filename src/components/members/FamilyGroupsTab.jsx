import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Plus, Pencil, Trash2, UserPlus, X, Crown } from 'lucide-react';
import { toast } from 'sonner';
import FamilyPrintView from '@/components/members/FamilyPrintView';

const RELATIONSHIPS = ['spouse', 'child', 'grandchild', 'niece', 'nephew', 'grandparent', 'other'];

const relBadge = {
  spouse: 'bg-pink-100 text-pink-700',
  child: 'bg-blue-100 text-blue-700',
  grandchild: 'bg-indigo-100 text-indigo-700',
  niece: 'bg-purple-100 text-purple-700',
  nephew: 'bg-violet-100 text-violet-700',
  grandparent: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-600',
};

const emptyForm = { family_name: '', head_of_household_id: '', notes: '' };

export default function FamilyGroupsTab({ churchId, members, canEdit = true }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [addMemberForm, setAddMemberForm] = useState({ member_id: '', relationship: 'spouse' });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['family-groups', churchId],
    queryFn: () => base44.entities.FamilyGroup.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) return base44.entities.FamilyGroup.update(id, data);
      return base44.entities.FamilyGroup.create({ ...data, church_id: churchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-groups'] });
      setDialogOpen(false);
      setEditingGroup(null);
      setForm(emptyForm);
      toast.success(editingGroup ? 'Family group updated' : 'Family group created');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FamilyGroup.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['family-groups'] });
      toast.success('Family group deleted');
    },
  });

  const memberMap = Object.fromEntries(members.map(m => [m.id, m]));

  const openCreate = () => {
    setEditingGroup(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setForm({
      family_name: group.family_name || '',
      head_of_household_id: group.head_of_household_id || '',
      notes: group.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const head = members.find(m => m.id === form.head_of_household_id);
    const allEmails = [
      head?.email,
      ...(editingGroup?.members || []).map(m => m.member_email || '')
    ].filter(Boolean);
    const data = {
      ...form,
      head_of_household_name: head ? `${head.first_name} ${head.last_name}` : '',
      head_of_household_email: head?.email || '',
      members: editingGroup?.members || [],
      member_emails: allEmails,
    };
    saveMutation.mutate({ id: editingGroup?.id, data });
  };

  const addFamilyMember = async (group) => {
    if (!addMemberForm.member_id) return;
    const m = memberMap[addMemberForm.member_id];
    if (!m) return;
    const updatedMembers = [
      ...(group.members || []),
      { member_id: m.id, member_name: `${m.first_name} ${m.last_name}`, member_email: m.email || '', relationship: addMemberForm.relationship },
    ];
    await base44.entities.FamilyGroup.update(group.id, { members: updatedMembers });
    queryClient.invalidateQueries({ queryKey: ['family-groups'] });
    setAddMemberForm({ member_id: '', relationship: 'spouse' });
    toast.success('Member added to family');
  };

  const removeFamilyMember = async (group, memberId) => {
    const updatedMembers = (group.members || []).filter(m => m.member_id !== memberId);
    await base44.entities.FamilyGroup.update(group.id, { members: updatedMembers });
    queryClient.invalidateQueries({ queryKey: ['family-groups'] });
    toast.success('Member removed');
  };

  const makeHOH = async (group, memberId) => {
    const newHead = memberMap[memberId];
    if (!newHead) return;
    const currentHead = memberMap[group.head_of_household_id];
    const oldHOH = currentHead ? {
      member_id: currentHead.id,
      member_name: `${currentHead.first_name} ${currentHead.last_name}`,
      member_email: currentHead.email || '',
      relationship: 'other',
    } : null;
    const otherMembers = (group.members || []).filter(m => m.member_id !== memberId);
    const updatedMembers = oldHOH ? [oldHOH, ...otherMembers] : otherMembers;
    const updatedEmails = [
      newHead.email,
      ...updatedMembers.map(m => m.member_email || ''),
    ].filter(Boolean);
    await base44.entities.FamilyGroup.update(group.id, {
      head_of_household_id: newHead.id,
      head_of_household_name: `${newHead.first_name} ${newHead.last_name}`,
      head_of_household_email: newHead.email || '',
      members: updatedMembers,
      member_emails: updatedEmails,
    });
    queryClient.invalidateQueries({ queryKey: ['family-groups'] });
    toast.success(`${newHead.first_name} ${newHead.last_name} is now Head of Household`);
  };

  // Members not yet in this group (excluding head)
  const availableFor = (group) => {
    const taken = new Set((group.members || []).map(m => m.member_id));
    taken.add(group.head_of_household_id);
    return members.filter(m => !taken.has(m.id));
  };

  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{groups.length} family group{groups.length !== 1 ? 's' : ''}</p>
        <div className="flex gap-2">
          <FamilyPrintView groups={groups} memberMap={memberMap} />
          {canEdit && (
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="w-4 h-4" /> New Family Group
            </Button>
          )}
        </div>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>No family groups yet. Create one to track households.</p>
          </CardContent>
        </Card>
      )}

      {groups.map(group => {
        const head = memberMap[group.head_of_household_id];
        const available = availableFor(group);
        return (
          <Card key={group.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    {group.family_name}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Head of Household: <span className="font-medium text-foreground">
                      {head ? `${head.first_name} ${head.last_name}` : group.head_of_household_name || '—'}
                    </span>
                  </p>
                </div>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(group)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="w-7 h-7 text-destructive"
                      onClick={() => window.confirm('Delete this family group?') && deleteMutation.mutate(group.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Family members list */}
              {(group.members || []).length > 0 && (
                <div className="space-y-2">
                  {group.members.map(fm => (
                    <div key={fm.member_id} className="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm font-medium truncate">{fm.member_name}</span>
                        <Badge className={`text-xs flex-shrink-0 ${relBadge[fm.relationship] || relBadge.other}`}>{fm.relationship}</Badge>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => makeHOH(group, fm.member_id)}
                          >
                            <Crown className="w-3.5 h-3.5" /> Set as HOH
                          </Button>
                        )}
                        <button
                          className="text-muted-foreground hover:text-destructive p-1"
                          onClick={() => removeFamilyMember(group, fm.member_id)}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add member inline — admin/edit only */}
              {canEdit && available.length > 0 && (
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[160px]">
                    <Label className="text-xs">Add Member</Label>
                    <Select
                      value={addMemberForm.member_id}
                      onValueChange={v => setAddMemberForm(f => ({ ...f, member_id: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select member…" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map(m => (
                          <SelectItem key={m.id} value={m.id} className="text-xs">
                            {m.first_name} {m.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[120px]">
                    <Label className="text-xs">Relationship</Label>
                    <Select
                      value={addMemberForm.relationship}
                      onValueChange={v => setAddMemberForm(f => ({ ...f, relationship: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIPS.map(r => (
                          <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => addFamilyMember(group)}
                    disabled={!addMemberForm.member_id}
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGroup ? 'Edit Family Group' : 'New Family Group'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Family Name *</Label>
              <Input
                value={form.family_name}
                onChange={e => setForm(f => ({ ...f, family_name: e.target.value }))}
                placeholder="e.g. The Johnson Family"
              />
            </div>
            <div>
              <Label>Head of Household *</Label>
              <Select
                value={form.head_of_household_id}
                onValueChange={v => setForm(f => ({ ...f, head_of_household_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select member…" />
                </SelectTrigger>
                <SelectContent>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id} className="text-sm">
                      {m.first_name} {m.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleSave}
              disabled={!form.family_name || !form.head_of_household_id || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}