import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Paperclip, Pencil, Trash2, ShieldAlert, RotateCcw, UserMinus, Crown, AlertCircle } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { format } from 'date-fns';
import DocumentAttachments from '@/components/DocumentAttachments';
import ImportMembersDialog from '@/components/members/ImportMembersDialog';
import PlanningCenterImport from '@/components/members/PlanningCenterImport';
import MemberEditDialog from '@/components/members/MemberEditDialog';
import FamilyGroupsTab from '@/components/members/FamilyGroupsTab';
import GuestsTab from '@/components/members/GuestsTab';
import DirectoryTab from '@/components/members/DirectoryTab';
import { getTierConfig } from '@/lib/tiers';
import { Link } from 'react-router-dom';

export default function Members() {
  const { user, isStaff, isChurchAdmin, isGlobalAdmin, activeChurch } = useAppUser();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  const [massDeleteMode, setMassDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [selectedMember, setSelectedMember] = useState(null);

  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', phone: '', status: 'active' });
  const queryClient = useQueryClient();

  const churchId = user?.church_id;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', churchId],
    queryFn: () => churchId
      ? base44.entities.ChurchMember.filter({ church_id: churchId })
      : isGlobalAdmin ? base44.entities.ChurchMember.list() : [],
    enabled: !!user,
  });

  const { data: pastoralStaffEmails = [] } = useQuery({
    queryKey: ['pastoral-staff-emails', churchId],
    queryFn: async () => {
      const groups = await base44.entities.MinistryGroup.filter({ church_id: churchId, name: 'Pastoral Staff' });
      if (groups.length === 0) return [];
      const groupMembers = await base44.entities.MinistryGroupMember.filter({ group_id: groups[0].id });
      return groupMembers.map(m => m.member_email).filter(Boolean);
    },
    enabled: !!churchId,
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Check member limit (visitors don't count)
      if (data.status !== 'visitor') {
        const tier = activeChurch?.subscription_tier || 'free';
        const tierConfig = getTierConfig(tier);
        if (tierConfig.memberLimit !== -1) {
          const nonVisitorCount = members.filter(m => m.status !== 'visitor').length;
          const hardLimit = tierConfig.memberLimit + tierConfig.memberBuffer;
          if (nonVisitorCount >= hardLimit) {
            throw new Error(`MEMBER_LIMIT_REACHED:${tierConfig.memberLimit}`);
          }
        }
      }
      const member = await base44.entities.ChurchMember.create({ ...data, church_id: churchId });
      // Auto-create MemberProfile if email is provided so they appear in directory
      if (data.email) {
        const existing = await base44.entities.MemberProfile.filter({ user_email: data.email });
        if (existing.length === 0) {
          await base44.entities.MemberProfile.create({
            church_id: churchId,
            user_email: data.email,
            display_name: `${data.first_name} ${data.last_name}`.trim(),
            show_in_directory: true,
          });
        }
      }
      return member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setOpen(false);
      setForm({ first_name: '', last_name: '', email: '', phone: '', status: 'active' });
      toast.success('Member added');
    },
    onError: (err) => {
      if (err?.message?.startsWith('MEMBER_LIMIT_REACHED:')) {
        const limit = err.message.split(':')[1];
        toast.error(`You've reached your member limit (${limit}). Please upgrade your plan to add more members.`);
        setOpen(false);
      }
    },
  });

  const updateDocsMutation = useMutation({
    mutationFn: ({ id, documents }) => base44.entities.ChurchMember.update(id, { documents }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Documents saved');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChurchMember.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setEditOpen(false);
      toast.success('Member updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ChurchMember.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member deleted');
    },
  });

  const handleEdit = (member) => {
    setSelectedMember(member);
    setEditOpen(true);
  };

  const handleDelete = (member) => {
    if (window.confirm(`Delete ${member.first_name} ${member.last_name}? This cannot be undone.`)) {
      deleteMutation.mutate(member.id);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === todayMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(todayMembers.map(m => m.id)));
    }
  };

  const handleMassDelete = async () => {
    if (selectedIds.size === 0) return;
    const code = window.prompt('Enter the Global Admin authorization code to confirm mass delete:');
    if (code !== 'SHEPHERD2024') {
      toast.error('Invalid authorization code. Mass delete cancelled.');
      return;
    }
    if (!window.confirm(`Permanently delete ${selectedIds.size} member record${selectedIds.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    await Promise.all([...selectedIds].map(id => base44.entities.ChurchMember.delete(id)));
    queryClient.invalidateQueries({ queryKey: ['members'] });
    toast.success(`${selectedIds.size} member${selectedIds.size !== 1 ? 's' : ''} deleted`);
    setSelectedIds(new Set());
    setMassDeleteMode(false);
  };

  const reactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.ChurchMember.update(id, { status: 'active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member reactivated');
    },
  });

  const handleDocsUpdate = (newDocs) => {
    updateDocsMutation.mutate({ id: selectedMember.id, documents: newDocs });
    setSelectedMember(prev => ({ ...prev, documents: newDocs }));
  };

  if (!isStaff) {
    return <div className="text-center py-12 text-muted-foreground">Access restricted</div>;
  }

  // Exclude visitors from main Members tab — they show in Guests tab
  const nonVisitors = members.filter(m => m.status !== 'visitor');

  // Tier-based member limits
  const churchTier = activeChurch?.subscription_tier || 'free';
  const tierConfig = getTierConfig(churchTier);
  const nonVisitorCount = nonVisitors.length;
  const atBaseLimit = !isGlobalAdmin && tierConfig.memberLimit !== -1 && nonVisitorCount >= tierConfig.memberLimit;
  const atHardLimit = !isGlobalAdmin && tierConfig.memberLimit !== -1 && nonVisitorCount >= tierConfig.memberLimit + tierConfig.memberBuffer;
  const filtered = nonVisitors.filter(m =>
    `${m.first_name} ${m.last_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())
  );

  // Mass delete is only available to Global Admins, and only before 11pm EST on May 8 2026
  const massDeleteCutoff = new Date('2026-05-09T03:00:00Z'); // 11pm EST = 03:00 UTC next day
  const massDeleteAvailable = isGlobalAdmin && new Date() < massDeleteCutoff;

  const todayMembers = filtered.filter(m => m.created_date && m.created_date.startsWith(today));

  const statusBadge = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    visitor: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">{members.filter(m => m.status !== 'visitor').length} total members</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="w-4 h-4 mr-2" /> Add Member</Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name *</Label><Input value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><Label>Last Name *</Label><Input value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Join Date</Label><Input type="date" value={form.join_date || ''} onChange={e => setForm({ ...form, join_date: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="visitor">Visitor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.first_name || !form.last_name || createMutation.isPending}>
                {createMutation.isPending ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
          <ImportMembersDialog churchId={churchId} onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['members'] })} />
          <PlanningCenterImport
            churchId={churchId}
            existingMembers={members}
            onDone={() => queryClient.invalidateQueries({ queryKey: ['members'] })}
          />
          {massDeleteAvailable && (
            <Button
              variant={massDeleteMode ? 'destructive' : 'outline'}
              size="sm"
              className="gap-2"
              onClick={() => { setMassDeleteMode(m => !m); setSelectedIds(new Set()); }}
            >
              <ShieldAlert className="w-4 h-4" />
              {massDeleteMode ? 'Cancel' : 'Mass Delete'}
            </Button>
          )}
          </div>
          </div>

      {/* Upgrade banners */}
      {atBaseLimit && !atHardLimit && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-yellow-300/40 bg-yellow-50 dark:bg-yellow-900/10">
          <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400 flex-1">
            You've reached your plan's member limit ({tierConfig.memberLimit}). Upgrade to add more members.
          </p>
          <Link to="/pricing"><Button size="sm" variant="outline" className="gap-1"><Crown className="w-3.5 h-3.5" /> Upgrade</Button></Link>
        </div>
      )}
      {atHardLimit && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-red-300/40 bg-red-50 dark:bg-red-900/10">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400 flex-1">
            Member limit reached ({tierConfig.memberLimit + tierConfig.memberBuffer}). You cannot add more members without upgrading.
          </p>
          <Link to="/pricing"><Button size="sm" variant="destructive" className="gap-1"><Crown className="w-3.5 h-3.5" /> Upgrade Now</Button></Link>
        </div>
      )}

      <Tabs defaultValue="members" className="space-y-4">
      <TabsList>
        <TabsTrigger value="members">Members</TabsTrigger>
        <TabsTrigger value="directory">Directory</TabsTrigger>
        {isStaff && <TabsTrigger value="guests">Guests</TabsTrigger>}
        {isStaff && <TabsTrigger value="families">Family Groups</TabsTrigger>}
      </TabsList>

      <TabsContent value="members" className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 max-w-sm" />
      </div>

      {massDeleteMode && massDeleteAvailable && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/40 bg-destructive/5">
          <ShieldAlert className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive flex-1">
            Mass delete is active — only records <strong>added today</strong> ({todayMembers.length}) can be selected.
          </p>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={handleMassDelete}
          >
            Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </Button>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {massDeleteMode && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todayMembers.length > 0 && selectedIds.size === todayMembers.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                )}
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Joined</TableHead>
                <TableHead>Docs</TableHead>
                {isChurchAdmin && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(member => {
                const isToday = member.created_date && member.created_date.startsWith(today);
                return (
                <TableRow key={member.id} className={selectedIds.has(member.id) ? 'bg-destructive/5' : ''}>
                  {massDeleteMode && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        disabled={!isToday}
                        onCheckedChange={() => isToday && toggleSelect(member.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{member.first_name} {member.last_name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{member.email || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{member.phone || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusBadge[member.status || 'active']}>
                      {member.status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {member.member_since ? format(new Date(member.member_since), 'MMM d, yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-xs"
                      onClick={() => { setSelectedMember(member); setDocsOpen(true); }}
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {(member.documents?.length || 0) > 0 && (
                        <span className="text-primary font-semibold">{member.documents.length}</span>
                      )}
                    </Button>
                    </TableCell>
                    {isChurchAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => handleEdit(member)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete(member)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    )}
                    </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={massDeleteMode ? 7 : 6} className="text-center text-muted-foreground py-8">No members found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Inactive Members Panel */}
      {isChurchAdmin && (() => {
        const inactiveList = members.filter(m => m.status === 'inactive' && !(m.email && pastoralStaffEmails.includes(m.email)));
        if (inactiveList.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <UserMinus className="w-4 h-4 text-muted-foreground" />
                Inactive Members
                <Badge variant="secondary" className="ml-1 text-xs">{inactiveList.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {inactiveList.map(m => (
                <div key={m.id} className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground flex-shrink-0">
                    {m.first_name?.[0]}{m.last_name?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                    {m.email && <p className="text-xs text-muted-foreground">{m.email}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs px-2 gap-1"
                    onClick={() => reactivateMutation.mutate(m.id)}
                    disabled={reactivateMutation.isPending}
                  >
                    <RotateCcw className="w-3 h-3" /> Reactivate
                  </Button>
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => handleEdit(m)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })()}

      </TabsContent>

      <TabsContent value="directory">
        <DirectoryTab />
      </TabsContent>

      {isStaff && (
        <TabsContent value="guests">
          <GuestsTab churchId={churchId} canPromote={isChurchAdmin} canDelete={isChurchAdmin} />
        </TabsContent>
      )}

      {isStaff && (
        <TabsContent value="families">
          <FamilyGroupsTab churchId={churchId} members={members} canEdit={isChurchAdmin} />
        </TabsContent>
      )}
      </Tabs>

      {/* Edit Member dialog */}
      <MemberEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        member={selectedMember}
        isPending={updateMutation.isPending}
        canEditSpiritual={isChurchAdmin || isStaff}
        churchId={churchId}
        canEditHOH={isChurchAdmin}
        onSave={(data) => updateMutation.mutate({ id: selectedMember.id, data })}
      />

      {/* Documents dialog */}
      <Dialog open={docsOpen} onOpenChange={setDocsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedMember ? `${selectedMember.first_name} ${selectedMember.last_name} — Documents` : 'Documents'}
            </DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <DocumentAttachments
              documents={selectedMember.documents || []}
              onUpdate={handleDocsUpdate}
              canEdit={isChurchAdmin}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}