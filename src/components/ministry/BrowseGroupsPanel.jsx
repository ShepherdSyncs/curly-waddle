import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserPlus, Check, Clock, X } from 'lucide-react';
import { toast } from 'sonner';

export default function BrowseGroupsPanel({ churchId, user, groups, myMemberships }) {
  const queryClient = useQueryClient();

  const { data: myRequests = [] } = useQuery({
    queryKey: ['my-join-requests', user?.email, churchId],
    queryFn: () => base44.entities.GroupJoinRequest.filter({ church_id: churchId, user_email: user.email }),
    enabled: !!user?.email && !!churchId,
  });

  const myGroupIds = new Set(myMemberships.map(m => m.group_id));

  const requestMutation = useMutation({
    mutationFn: (group) => base44.entities.GroupJoinRequest.create({
      church_id: churchId,
      group_id: group.id,
      group_name: group.name,
      user_email: user.email,
      user_name: user.full_name || user.email,
      status: 'pending',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-join-requests'] });
      toast.success('Join request sent! The group leader will review it.');
    },
    onError: (err) => toast.error(err?.message || 'Failed to send request'),
  });

  const getRequestStatus = (groupId) => {
    const req = myRequests.find(r => r.group_id === groupId);
    return req?.status || null;
  };

  if (groups.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p>No ministry groups available yet.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map(group => {
        const isMember = myGroupIds.has(group.id);
        const requestStatus = getRequestStatus(group.id);
        return (
          <Card key={group.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: group.color || '#6366f1' }}>
                  {group.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{group.name}</p>
                  {group.leader_name && <p className="text-xs text-muted-foreground">Led by {group.leader_name}</p>}
                </div>
              </div>
              {group.description && <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{group.description}</p>}
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-xs capitalize">{group.category}</Badge>
                {isMember ? (
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200 gap-1">
                    <Check className="w-3 h-3" /> Member
                  </Badge>
                ) : requestStatus === 'pending' ? (
                  <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200 gap-1">
                    <Clock className="w-3 h-3" /> Pending
                  </Badge>
                ) : requestStatus === 'denied' ? (
                  <Badge className="text-xs bg-red-100 text-red-700 border-red-200 gap-1">
                    <X className="w-3 h-3" /> Denied
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => requestMutation.mutate(group)} disabled={requestMutation.isPending}>
                    <UserPlus className="w-3.5 h-3.5" /> Request to Join
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}