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
import { CheckCircle2, XCircle, User, Mail, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function VerifyMembers() {
  const { user, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();
  const [verifyingId, setVerifyingId] = useState(null);
  const [notes, setNotes] = useState('');
  const [selectedChurchId, setSelectedChurchId] = useState(churchId || null);

  const { data: churches = [] } = useQuery({
    queryKey: ['churches-for-verification'],
    queryFn: () => isGlobalAdmin ? base44.entities.Church.list() : [],
    enabled: isGlobalAdmin,
  });

  const { data: pendingMembers = [] } = useQuery({
    queryKey: ['pending-members', selectedChurchId],
    queryFn: () => {
      const target = isGlobalAdmin ? selectedChurchId : churchId;
      return target
        ? base44.entities.ChurchInvitation.filter({ church_id: target, status: 'pending' }, '-created_date', 100)
        : [];
    },
    enabled: !!(isChurchAdmin || isGlobalAdmin) && !!(isGlobalAdmin ? selectedChurchId : churchId),
  });

  const { data: ministryGroups = [] } = useQuery({
    queryKey: ['ministry-groups', selectedChurchId || churchId],
    queryFn: () => {
      const target = isGlobalAdmin ? selectedChurchId : churchId;
      return target
        ? base44.entities.MinistryGroup.filter({ church_id: target, is_active: true })
        : [];
    },
    enabled: !!(isChurchAdmin || isGlobalAdmin) && !!(isGlobalAdmin ? selectedChurchId : churchId),
  });

  const verifyMutation = useMutation({
    mutationFn: async ({ invitationId, groupIds, member }) => {
      const targetChurchId = isGlobalAdmin ? selectedChurchId : churchId;
      await base44.entities.ChurchInvitation.update(invitationId, {
        status: 'verified',
        verified_by: user.email,
        verified_at: new Date().toISOString(),
        notes,
        assigned_groups: groupIds.map(id => {
          const group = ministryGroups.find(g => g.id === id);
          return { group_id: id, group_name: group?.name };
        }),
      });

      // Auto-create MemberProfile so they appear in the directory
      const existing = await base44.entities.MemberProfile.filter({ user_email: member.user_email });
      if (existing.length === 0) {
        await base44.entities.MemberProfile.create({
          church_id: targetChurchId,
          user_email: member.user_email,
          display_name: member.user_name,
          show_in_directory: true,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-members'] });
      toast.success('Member verified and added to directory');
      setVerifyingId(null);
      setNotes('');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (invitationId) => {
      await base44.entities.ChurchInvitation.update(invitationId, {
        status: 'rejected',
        verified_by: user.email,
        verified_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-members'] });
      toast.success('Member rejected');
    },
  });

  if (!isChurchAdmin && !isGlobalAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Access restricted</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold">Verify Members</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isGlobalAdmin ? 'Review and approve members across all churches' : `${pendingMembers.length} pending member${pendingMembers.length !== 1 ? 's' : ''} awaiting verification`}
        </p>
      </div>

      {isGlobalAdmin && (
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-sm">Select Church</Label>
            <select
              value={selectedChurchId || ''}
              onChange={e => setSelectedChurchId(e.target.value || null)}
              className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-transparent text-sm"
            >
              <option value="">All Churches</option>
              {churches.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {pendingMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p>No pending members to verify</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingMembers.map(member => (
            <Card key={member.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-fit space-y-1">
                    <p className="font-semibold flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      {member.user_name}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5" />
                      {member.user_email}
                    </p>
                  </div>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button onClick={() => setVerifyingId(member.id)} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Verify
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Verify {member.user_name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 mt-4">
                        <div>
                          <Label>Assign to Groups (optional)</Label>
                          <p className="text-xs text-muted-foreground mt-1 mb-2">Select groups to add this member to</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {ministryGroups.map(group => (
                              <label key={group.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                                <input
                                  type="checkbox"
                                  defaultChecked={false}
                                  className="rounded"
                                  onChange={(e) => {
                                    // Handle group selection in parent state
                                  }}
                                />
                                <span className="text-sm">{group.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label>Notes (optional)</Label>
                          <Input
                            placeholder="e.g. Interested in worship team"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <Button
                          onClick={() => verifyMutation.mutate({ invitationId: member.id, groupIds: [], member })}
                          disabled={verifyMutation.isPending}
                          className="w-full"
                        >
                          {verifyMutation.isPending ? 'Verifying...' : 'Verify Member'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    className="gap-2 text-destructive"
                    onClick={() => {
                      if (window.confirm('Reject this member?')) {
                        rejectMutation.mutate(member.id);
                      }
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}