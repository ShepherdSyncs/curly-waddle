import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarClock, Plus, Trash2, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, isValid } from 'date-fns';
import ScheduleDialog from '@/components/ministry/ScheduleDialog';
import GroupJoinRequestsPanel from '@/components/ministry/GroupJoinRequestsPanel';
import BrowseGroupsPanel from '@/components/ministry/BrowseGroupsPanel';

// Safely parse a date string that may be date-only ("2026-08-09") or a full ISO datetime.
// Rejects malformed years (e.g. a stray extra digit) instead of producing a wild/invalid date.
const parseDate = (d) => {
  if (!d) return new Date(NaN);
  const s = String(d);
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(NaN);
  const parsed = (s.includes('T') || s.includes(' ')) ? parseISO(s) : parseISO(s.slice(0, 10) + 'T00:00:00');
  return isValid(parsed) ? parsed : new Date(NaN);
};

// Never let a bad date crash the whole page — fall back to a dash.
const safeFormat = (d, fmtStr) => {
  const parsed = parseDate(d);
  return isValid(parsed) ? format(parsed, fmtStr) : '—';
};

export default function ServiceSchedule() {
  const { user, isStaff, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const isAdmin = isChurchAdmin || isGlobalAdmin;
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [scheduleGroup, setScheduleGroup] = useState(null);
  const [editSchedule, setEditSchedule] = useState(null);
  const [newGroupId, setNewGroupId] = useState('');

  const { data: groups = [] } = useQuery({
    queryKey: ['ministry-groups', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId, is_active: true }, 'name', 100),
    enabled: !!churchId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['ministry-schedules', churchId],
    queryFn: () => base44.entities.MinistrySchedule.filter({ church_id: churchId }, 'date', 200),
    enabled: !!churchId,
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my-group-memberships', user?.email, churchId],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ church_id: churchId, member_email: user.email }),
    enabled: !!user?.email && !!churchId,
  });

  const myGroupIds = new Set(myMemberships.map(m => m.group_id));
  const myLeaderGroups = groups.filter(g => g.leader_email === user?.email);
  const myManagedGroups = isAdmin ? groups : [...myLeaderGroups, ...groups.filter(g => myGroupIds.has(g.id) && !myLeaderGroups.includes(g))];
  const myManagedGroupIds = new Set(myManagedGroups.map(g => g.id));

  const managedSchedules = isAdmin ? schedules : schedules.filter(s => myManagedGroupIds.has(s.group_id));
  const today = format(new Date(), 'yyyy-MM-dd');
  const upcoming = managedSchedules.filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = managedSchedules.filter(s => s.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const groupById = Object.fromEntries(groups.map(g => [g.id, g]));

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MinistrySchedule.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ministry-schedules'] }); toast.success('Schedule deleted'); },
  });

  const canEditSchedule = (s) => {
    const grp = groupById[s.group_id];
    return isAdmin || (grp && grp.leader_email === user?.email);
  };

  const myUpcomingSchedules = schedules.filter(s =>
    s.date >= today &&
    s.assignees?.some(a => a.member_email === user?.email || a.member_name === user?.full_name)
  );

  const handleNewService = () => {
    const group = myManagedGroups.find(g => g.id === newGroupId) || myManagedGroups[0];
    if (group) { setScheduleGroup(group); setEditSchedule(null); }
  };

  if (!churchId) {
    return <div className="text-center py-12 text-muted-foreground">No church assigned</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
            <CalendarClock className="w-6 h-6 text-primary" /> Schedule
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStaff ? 'Manage service schedules and worker assignments' : 'Browse ministry groups and view your schedule'}
          </p>
        </div>
        {isStaff && myManagedGroups.length > 0 && (
          <div className="flex gap-2 items-center">
            {myManagedGroups.length > 1 && (
              <Select value={newGroupId} onValueChange={setNewGroupId}>
                <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Select group…" /></SelectTrigger>
                <SelectContent>
                  {myManagedGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleNewService} className="gap-2">
              <Plus className="w-4 h-4" /> New Service
            </Button>
          </div>
        )}
      </div>

      {isStaff ? (
        <Tabs defaultValue="schedules">
          <TabsList>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="schedules" className="mt-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h3>
              {upcoming.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">
                  <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  <p>No upcoming services scheduled.</p>
                  {myManagedGroups.length > 0 && <Button className="mt-4" onClick={handleNewService}><Plus className="w-4 h-4 mr-2" />Create a Service</Button>}
                </CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {upcoming.map(s => {
                    const grp = groupById[s.group_id];
                    return (
                      <Card key={s.id}>
                        <CardContent className="p-4 flex items-start gap-4">
                          <div className="text-center min-w-[48px]">
                            <p className="text-xs text-muted-foreground uppercase">{safeFormat(s.date, 'MMM')}</p>
                            <p className="text-2xl font-bold leading-tight">{safeFormat(s.date, 'd')}</p>
                            <p className="text-xs text-muted-foreground">{safeFormat(s.date, 'EEE')}</p>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold">{s.title}</p>
                              {grp && <Badge variant="secondary" className="text-xs" style={{ backgroundColor: grp.color + '22', color: grp.color }}>{grp.name}</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                              {s.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.time}{s.end_time ? ` – ${s.end_time}` : ''}</span>}
                              {s.location && <span>{s.location}</span>}
                            </div>
                            {s.assignees?.length > 0 && (
                              <div className="flex gap-1 mt-2 flex-wrap">
                                {s.assignees.map(a => <Badge key={a.member_name} variant="outline" className="text-xs">{a.member_name}{a.role ? ` · ${a.role}` : ''}</Badge>)}
                              </div>
                            )}
                            {s.notes && <p className="text-xs text-muted-foreground mt-1">{s.notes}</p>}
                          </div>
                          {canEditSchedule(s) && (
                            <div className="flex gap-1 flex-shrink-0">
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setScheduleGroup(grp); setEditSchedule(s); }}>Edit</Button>
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => { if (window.confirm('Delete this schedule?')) deleteMutation.mutate(s.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>

            {past.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past</h3>
                <div className="space-y-2">
                  {past.slice(0, 10).map(s => {
                    const grp = groupById[s.group_id];
                    return (
                      <Card key={s.id} className="opacity-70">
                        <CardContent className="p-3 flex items-center gap-3">
                          <p className="text-sm text-muted-foreground w-24 flex-shrink-0">{safeFormat(s.date, 'MMM d, yyyy')}</p>
                          <p className="text-sm flex-1 truncate">{s.title}</p>
                          {grp && <Badge variant="secondary" className="text-xs">{grp.name}</Badge>}
                          {isAdmin && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="w-7 h-7 text-destructive flex-shrink-0"
                              onClick={() => { if (window.confirm('Delete this past service? This cannot be undone.')) deleteMutation.mutate(s.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <GroupJoinRequestsPanel churchId={churchId} groups={myManagedGroups} user={user} isAdmin={isAdmin} />
          </TabsContent>
        </Tabs>
      ) : (
        <Tabs defaultValue="groups">
          <TabsList>
            <TabsTrigger value="groups">Browse Groups</TabsTrigger>
            <TabsTrigger value="myschedule">My Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="mt-4">
            <BrowseGroupsPanel churchId={churchId} user={user} groups={groups} myMemberships={myMemberships} />
          </TabsContent>

          <TabsContent value="myschedule" className="mt-4">
            {myUpcomingSchedules.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-muted-foreground">
                <CalendarClock className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>You have no upcoming service assignments.</p>
              </CardContent></Card>
            ) : (
              <div className="space-y-2">
                {myUpcomingSchedules.map(s => {
                  const grp = groupById[s.group_id];
                  const myAssignment = s.assignees?.find(a => a.member_email === user?.email || a.member_name === user?.full_name);
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="text-center min-w-[48px]">
                          <p className="text-xs text-muted-foreground uppercase">{safeFormat(s.date, 'MMM')}</p>
                          <p className="text-2xl font-bold leading-tight">{safeFormat(s.date, 'd')}</p>
                          <p className="text-xs text-muted-foreground">{safeFormat(s.date, 'EEE')}</p>
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{s.title}</p>
                          {grp && <Badge variant="secondary" className="text-xs mt-1" style={{ backgroundColor: grp.color + '22', color: grp.color }}>{grp.name}</Badge>}
                          {s.time && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" />{s.time}{s.end_time ? ` – ${s.end_time}` : ''}</p>}
                          {myAssignment?.role && <Badge variant="outline" className="text-xs mt-2">Your role: {myAssignment.role}</Badge>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {scheduleGroup && (
        <ScheduleDialog
          group={scheduleGroup}
          editSchedule={editSchedule}
          user={user}
          onClose={() => { setScheduleGroup(null); setEditSchedule(null); }}
        />
      )}
    </div>
  );
}