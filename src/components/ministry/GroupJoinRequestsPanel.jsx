import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, X, Users } from 'lucide-react';
import { toast } from 'sonner';

export default function GroupJoinRequestsPanel({ churchId, groups, user, isAdmin }) {
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['group-join-requests', churchId],
    queryFn: () => base44.entities.GroupJoinRequest.filter({ church_id: churchId, status: 'pending' }),
    enabled: !!churchId,
  });

  const groupIds = new Set(groups.map(g => g.id));
  const myRequests = isAdmin ? requests : requests.filter(r => groupIds.has(r.group_id));

  const approveMutation = useMutation({
    mutationFn: async (req) => {
      await base44.entities.GroupJoinRequest.update(req.id, {
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      });
      await base44.entities.MinistryGroupMember.create({
        church_id: churchId,
        group_id: req.group_id,
        member_email: req.user_email,
        member_name: req.user_name,
        available: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-join-requests'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-members'] });
      queryClient.invalidateQueries({ queryKey: ['ministry-member-counts'] });
      toast.success('Request approved — member added to group');
    },
    onError: (err) => toast.error(err?.message || 'Failed to approve'),
  });

  const denyMutation = useMutation({
    mutationFn: (req) => base44.entities.GroupJoinRequest.update(req.id, {
      status: 'denied',
      reviewed_by: user.email,
      reviewed_at: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-join-requests'] });
      toast.success('Request denied');
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (myRequests.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        <Users className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p>No pending join requests.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-2">
      {myRequests.map(req => {
        const group = groups.find(g => g.id === req.group_id);
        return (
          <Card key={req.id}>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                {req.user_name?.[0] || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{req.user_name}</p>
                <p className="text-xs text-muted-foreground truncate">{req.user_email}</p>
                {group && (
                  <Badge variant="secondary" className="text-xs mt-1" style={{ backgroundColor: group.color + '22', color: group.color }}>
                    {group.name}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <Button size="sm" className="gap-1 h-8" onClick={() => approveMutation.mutate(req)} disabled={approveMutation.isPending}>
                  <Check className="w-3.5 h-3.5" /> Approve
                </Button>
                <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => denyMutation.mutate(req)} disabled={denyMutation.isPending}>
                  <X className="w-3.5 h-3.5" /> Deny
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}