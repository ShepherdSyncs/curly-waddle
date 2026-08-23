import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ClipboardList, User, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

export default function FollowUpTasksPanel({ churchId, isAdmin }) {
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');

  const { data: tasks = [] } = useQuery({
    queryKey: ['followup-tasks', churchId],
    queryFn: () => base44.entities.FollowUpTask.filter({ church_id: churchId }, '-created_date', 100),
    enabled: !!churchId,
  });

  // Load Deacon + Ministry Staff groups then their members
  const { data: ministryGroups = [] } = useQuery({
    queryKey: ['ministry-groups-deacon', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId }),
    enabled: !!churchId && isAdmin,
  });

  const deaconGroupIds = ministryGroups
    .filter(g => g.name?.toLowerCase().includes('deacon') || g.name?.toLowerCase().includes('ministry staff') || g.name?.toLowerCase().includes('pastoral'))
    .map(g => g.id);

  const { data: allGroupMembers = [] } = useQuery({
    queryKey: ['ministry-group-members-deacon', churchId],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ church_id: churchId }),
    enabled: !!churchId && isAdmin && ministryGroups.length > 0,
  });

  const leaderOptions = allGroupMembers
    .filter(m => deaconGroupIds.includes(m.group_id) && m.member_email)
    .reduce((acc, m) => {
      if (!acc.find(x => x.member_email === m.member_email)) acc.push(m);
      return acc;
    }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.FollowUpTask.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followup-tasks'] });
      setAssigning(null);
      setSelectedMemberId('');
      toast.success('Task updated');
    },
  });

  const handleAssign = async (task) => {
    const member = leaderOptions.find(m => m.id === selectedMemberId);
    if (!member) { toast.error('Please select a leader'); return; }

    updateMutation.mutate({
      id: task.id,
      data: {
        assigned_to_email: member.member_email,
        assigned_to_name: member.member_name,
        status: 'in_progress',
      },
    });

    // Send assignment email
    base44.functions.invoke('sendFollowUpAssignmentEmail', {
      assignee_name: member.member_name,
      assignee_email: member.member_email,
      visitor_name: task.visitor_name,
      church_id: churchId,
    }).catch(() => {});
  };

  const pendingTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  if (tasks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          Visitor Follow-Up Tasks
          {pendingTasks.length > 0 && <Badge className="bg-yellow-100 text-yellow-700">{pendingTasks.length} pending</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pendingTasks.map(task => (
          <div key={task.id} className="p-3 rounded-lg border bg-muted/30 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{task.visitor_name}</p>
                {task.visitor_email && <p className="text-xs text-muted-foreground">{task.visitor_email}</p>}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Added {task.date_added ? format(new Date(task.date_added + 'T00:00:00'), 'MMM d, yyyy') : '—'} by {task.added_by_name || 'Staff'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={STATUS_COLORS[task.status]}>{task.status.replace('_', ' ')}</Badge>
                <Button size="sm" variant="ghost" className="h-7 text-green-600 text-xs" onClick={() => updateMutation.mutate({ id: task.id, data: { status: 'completed' } })}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Done
                </Button>
              </div>
            </div>

            {task.assigned_to_name && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" /> Assigned to: {task.assigned_to_name} ({task.assigned_to_email})
              </p>
            )}

            {isAdmin && (
              <>
                {assigning === task.id ? (
                  <div className="flex gap-2 items-center flex-wrap">
                    <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                      <SelectTrigger className="h-7 text-xs flex-1 min-w-[180px]">
                        <SelectValue placeholder="Select a leader..." />
                      </SelectTrigger>
                      <SelectContent>
                        {leaderOptions.length === 0 ? (
                          <SelectItem value="_none" disabled>No Deacon/Staff members found</SelectItem>
                        ) : (
                          leaderOptions.map(m => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.member_name} — {m.member_email}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button size="sm" className="h-7 text-xs" onClick={() => handleAssign(task)} disabled={updateMutation.isPending}>Assign</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAssigning(null); setSelectedMemberId(''); }}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAssigning(task.id); setSelectedMemberId(''); }}>
                    {task.assigned_to_email ? 'Reassign' : 'Assign to Leader'}
                  </Button>
                )}
              </>
            )}
          </div>
        ))}

        {completedTasks.length > 0 && (
          <details className="text-xs text-muted-foreground cursor-pointer">
            <summary className="py-1">{completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}</summary>
            <div className="space-y-1 mt-2">
              {completedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span>{t.visitor_name}</span>
                  {t.assigned_to_name && <span className="text-muted-foreground">→ {t.assigned_to_name}</span>}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}