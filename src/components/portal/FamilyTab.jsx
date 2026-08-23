import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Plus, X, Crown, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

const RELATIONSHIPS = ['spouse', 'child', 'grandchild', 'niece', 'nephew', 'grandparent', 'other'];

const relBadge = {
  spouse: 'bg-pink-100 text-pink-700', child: 'bg-blue-100 text-blue-700',
  grandchild: 'bg-indigo-100 text-indigo-700', niece: 'bg-purple-100 text-purple-700',
  nephew: 'bg-violet-100 text-violet-700', grandparent: 'bg-amber-100 text-amber-700',
  other: 'bg-gray-100 text-gray-600',
};

export default function FamilyTab({ user }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [familyName, setFamilyName] = useState('');
  const [addForm, setAddForm] = useState({ member_id: '', relationship: 'spouse' });
  const [transferTarget, setTransferTarget] = useState('');

  const { data: memberRecords = [] } = useQuery({
    queryKey: ['my-member-family', user?.email],
    queryFn: () => base44.entities.ChurchMember.filter({ email: user?.email }),
    enabled: !!user?.email,
  });
  const myMember = memberRecords[0];

  const { data: allGroups = [] } = useQuery({
    queryKey: ['my-family-groups', user?.email],
    queryFn: () => base44.entities.FamilyGroup.list(),
    enabled: !!user?.email,
  });

  const myGroup = allGroups.find(g =>
    g.head_of_household_email === user?.email ||
    (g.member_emails || []).includes(user?.email) ||
    (myMember && g.head_of_household_id === myMember.id)
  );

  const isHOH = myGroup && (
    myGroup.head_of_household_email === user?.email ||
    (myMember && myGroup.head_of_household_id === myMember.id)
  );

  const { data: churchMembers = [] } = useQuery({
    queryKey: ['church-members-family', user?.church_id],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: user?.church_id }),
    enabled: !!user?.church_id && !!isHOH,
  });

  const handleCreate = async () => {
    if (!familyName.trim() || !myMember) return;
    try {
      await base44.entities.FamilyGroup.create({
        church_id: user.church_id, family_name: familyName.trim(),
        head_of_household_id: myMember.id,
        head_of_household_name: `${myMember.first_name} ${myMember.last_name}`,
        head_of_household_email: user.email,
        members: [], member_emails: [user.email],
      });
      queryClient.invalidateQueries({ queryKey: ['my-family-groups'] });
      setShowCreate(false); setFamilyName('');
      toast.success('Family group created — you are Head of Household');
    } catch (e) { toast.error('Failed to create family group'); }
  };

  const addMember = async () => {
    if (!addForm.member_id || !myGroup) return;
    const m = churchMembers.find(cm => cm.id === addForm.member_id);
    if (!m) return;
    const newMember = {
      member_id: m.id, member_name: `${m.first_name} ${m.last_name}`,
      member_email: m.email || '', relationship: addForm.relationship,
    };
    const updatedMembers = [...(myGroup.members || []), newMember];
    const updatedEmails = [...(myGroup.member_emails || []), m.email].filter(Boolean);
    await base44.entities.FamilyGroup.update(myGroup.id, { members: updatedMembers, member_emails: updatedEmails });
    queryClient.invalidateQueries({ queryKey: ['my-family-groups'] });
    setAddForm({ member_id: '', relationship: 'spouse' });
    toast.success('Member added to family');
  };

  const removeMember = async (memberId) => {
    if (!myGroup) return;
    const removed = (myGroup.members || []).find(m => m.member_id === memberId);
    const updatedMembers = (myGroup.members || []).filter(m => m.member_id !== memberId);
    const updatedEmails = removed
      ? (myGroup.member_emails || []).filter(e => e !== removed.member_email)
      : myGroup.member_emails;
    await base44.entities.FamilyGroup.update(myGroup.id, { members: updatedMembers, member_emails: updatedEmails });
    queryClient.invalidateQueries({ queryKey: ['my-family-groups'] });
    toast.success('Member removed');
  };

  const transferHOH = async () => {
    if (!transferTarget || !myGroup) return;
    const target = (myGroup.members || []).find(m => m.member_id === transferTarget);
    if (!target) return;
    const oldHOH = {
      member_id: myGroup.head_of_household_id, member_name: myGroup.head_of_household_name,
      member_email: myGroup.head_of_household_email, relationship: 'other',
    };
    const others = (myGroup.members || []).filter(m => m.member_id !== transferTarget);
    const updatedEmails = [...(myGroup.member_emails || []), myGroup.head_of_household_email].filter(Boolean);
    await base44.entities.FamilyGroup.update(myGroup.id, {
      head_of_household_id: target.member_id, head_of_household_name: target.member_name,
      head_of_household_email: target.member_email,
      members: [oldHOH, ...others], member_emails: updatedEmails,
    });
    queryClient.invalidateQueries({ queryKey: ['my-family-groups'] });
    setTransferTarget('');
    toast.success('Head of Household transferred');
  };

  const available = myGroup
    ? churchMembers.filter(m =>
        m.id !== myGroup.head_of_household_id &&
        !(myGroup.members || []).some(fm => fm.member_id === m.id))
    : [];

  if (!myGroup && !showCreate) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground mb-4">You don't have a family group yet.</p>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Create Family Group
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showCreate) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Create Family Group</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Family Name</Label>
            <Input value={familyName} onChange={e => setFamilyName(e.target.value)} placeholder="e.g. The Johnson Family" />
          </div>
          <p className="text-sm text-muted-foreground">You will be marked as Head of Household.</p>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!familyName.trim() || !myMember}>Create Family</Button>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
          {!myMember && <p className="text-sm text-destructive">You need a church member record first. Ask your admin to add you.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" /> {myGroup.family_name}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          <Crown className="w-3 h-3 text-amber-500" />
          Head of Household: <span className="font-medium text-foreground">{myGroup.head_of_household_name}</span>
          {isHOH && <Badge className="ml-1 text-xs bg-amber-100 text-amber-700">You</Badge>}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {(myGroup.members || []).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {(myGroup.members || []).map(fm => (
              <div key={fm.member_id} className="flex items-center gap-1.5 bg-muted/50 rounded-full pl-3 pr-1 py-1">
                <span className="text-sm font-medium">{fm.member_name}</span>
                <Badge className={`text-xs ${relBadge[fm.relationship] || relBadge.other}`}>{fm.relationship}</Badge>
                {isHOH && (
                  <button className="text-muted-foreground hover:text-destructive ml-0.5" onClick={() => removeMember(fm.member_id)}>
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {isHOH && available.length > 0 && (
          <div className="flex gap-2 items-end flex-wrap pt-2 border-t">
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs">Add Member</Label>
              <Select value={addForm.member_id} onValueChange={v => setAddForm(f => ({ ...f, member_id: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select member…" /></SelectTrigger>
                <SelectContent>
                  {available.map(m => <SelectItem key={m.id} value={m.id} className="text-xs">{m.first_name} {m.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[120px]">
              <Label className="text-xs">Relationship</Label>
              <Select value={addForm.relationship} onValueChange={v => setAddForm(f => ({ ...f, relationship: v }))}>
                <SelectTrigger className="h-8 text-xs capitalize"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIPS.map(r => <SelectItem key={r} value={r} className="text-xs capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={addMember} disabled={!addForm.member_id}>
              <UserPlus className="w-3.5 h-3.5" /> Add
            </Button>
          </div>
        )}

        {isHOH && (myGroup.members || []).length > 0 && (
          <div className="flex gap-2 items-end flex-wrap pt-2 border-t">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Transfer Head of Household</Label>
              <Select value={transferTarget} onValueChange={setTransferTarget}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select family member…" /></SelectTrigger>
                <SelectContent>
                  {(myGroup.members || []).map(m => <SelectItem key={m.member_id} value={m.member_id} className="text-xs">{m.member_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={transferHOH} disabled={!transferTarget}>Transfer HOH</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}