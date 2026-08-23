import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Users, Megaphone, Calendar, Clock, Trash2, ClipboardCheck, BarChart2, MessageSquare, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import GroupCard from '@/components/ministry/GroupCard';
import ManageGroupDialog from '@/components/ministry/ManageGroupDialog';
import AnnounceDialog from '@/components/ministry/AnnounceDialog';
import ScheduleDialog from '@/components/ministry/ScheduleDialog';
import TakeAttendanceDialog from '@/components/ministry/TakeAttendanceDialog';
import MinistryAttendanceAnalytics from '@/components/ministry/MinistryAttendanceAnalytics';
import GroupMessageFeed from '@/components/ministry/GroupMessageFeed';
import VolunteerRolesPanel from '@/components/ministry/VolunteerRolesPanel';

export default function MinistryGroups() {
  const { user, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const isAdmin = isChurchAdmin || isGlobalAdmin;
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [manageGroup, setManageGroup] = useState(null);
  const [announceGroup, setAnnounceGroup] = useState(null);
  const [scheduleGroup, setScheduleGroup] = useState(null);
  const [editSchedule, setEditSchedule] = useState(null);
  const [viewAnnouncementsGroup, setViewAnnouncementsGroup] = useState(null);
  const [messagingGroup, setMessagingGroup] = useState(null);
  const [attendanceTarget, setAttendanceTarget] = useState(null); // { schedule, group }

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['ministry-groups', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId, is_active: true }, 'name', 100),
    enabled: !!churchId,
  });

  const { data: memberCounts = {} } = useQuery({
    queryKey: ['ministry-member-counts', churchId],
    queryFn: async () => {
      const all = await base44.entities.MinistryGroupMember.filter({ church_id: churchId });
      const counts = {};
      all.forEach(m => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
      return counts;
    },
    enabled: !!churchId,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['ministry-announcements', viewAnnouncementsGroup?.id],
    queryFn: () => base44.entities.MinistryAnnouncement.filter({ group_id: viewAnnouncementsGroup.id }, '-created_date', 50),
    enabled: !!viewAnnouncementsGroup?.id,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['ministry-schedules', churchId],
    queryFn: () => base44.entities.MinistrySchedule.filter({ church_id: churchId }, 'date', 200),
    enabled: !!churchId,
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: (id) => base44.entities.MinistrySchedule.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ministry-schedules'] }); toast.success('Deleted'); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (id) => base44.entities.MinistryGroup.update(id, { is_active: false }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['ministry-groups'] }); toast.success('Group removed'); },
  });

  // Which groups is this user a leader of or member of?
  const { data: myGroupMemberships = [] } = useQuery({
    queryKey: ['my-group-memberships', user?.email, churchId],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ church_id: churchId, member_email: user.email }),
    enabled: !!user?.email && !!churchId,
  });
  const myGroupIds = new Set(myGroupMemberships.map(m => m.group_id));
  const myGroups = isAdmin ? groups : groups.filter(g => myGroupIds.has(g.id) || g.leader_email === user?.email);

  const myLeaderGroups = groups.filter(g => g.leader_email === user?.email);
  const isLeaderOfGroup = (g) => g.leader_email === user?.email;
  // Attendance leaders can take attendance but cannot edit group/schedule
  const isAttendanceLeaderOfGroup = (g) => g?.attendance_leader_email === user?.email;
  const canTakeAttendance = (g) => isAdmin || isLeaderOfGroup(g) || isAttendanceLeaderOfGroup(g);

  // Upcoming schedules across all groups this user manages
  const today = format(new Date(), 'yyyy-MM-dd');
  const upcomingSchedules = schedules.filter(s => s.date >= today);
  const pastSchedules = schedules.filter(s => s.date < today);

  const groupById = Object.fromEntries(groups.map(g => [g.id, g]));

  const TYPE_ICON = { announcement: '📢', message: '💬', reminder: '🔔' };
  const STATUS_COLOR = { sent: 'bg-green-100 text-green-700', scheduled: 'bg-blue-100 text-blue-700', draft: 'bg-gray-100 text-gray-600' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
            <Users className="w-6 h-6 text-primary" /> Ministry Groups
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {groups.length} active group{groups.length !== 1 ? 's' : ''}
            {myLeaderGroups.length > 0 && ` · You lead ${myLeaderGroups.length}`}
          </p>
        </div>
        {isChurchAdmin && (
          <Button onClick={() => setManageGroup({})} className="gap-2">
            <Plus className="w-4 h-4" /> New Group
          </Button>
        )}
      </div>

      <Tabs defaultValue="groups">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="schedules">Schedules</TabsTrigger>
          {myGroups.length > 0 && (
            <TabsTrigger value="messages"><MessageSquare className="w-3.5 h-3.5 mr-1" />Messages</TabsTrigger>
          )}
          {(isChurchAdmin || myLeaderGroups.length > 0) && (
            <TabsTrigger value="comms">Announcements</TabsTrigger>
          )}
          {isChurchAdmin && <TabsTrigger value="volunteers"><UserCheck className="w-3.5 h-3.5 mr-1" />Volunteers</TabsTrigger>}
          {isChurchAdmin && <TabsTrigger value="analytics"><BarChart2 className="w-3.5 h-3.5 mr-1" />Analytics</TabsTrigger>}
        </TabsList>

        {/* GROUPS TAB */}
        <TabsContent value="groups" className="mt-4">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No ministry groups yet.</p>
              {isChurchAdmin && <Button className="mt-4" onClick={() => setManageGroup({})}>Create First Group</Button>}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(group => (
                <GroupCard
                  key={group.id}
                  group={group}
                  memberCount={memberCounts[group.id] || 0}
                  isLeader={isLeaderOfGroup(group)}
                  isAdmin={isChurchAdmin}
                  onManage={() => setManageGroup(group)}
                  onAnnounce={() => setAnnounceGroup(group)}
                  onSchedule={() => { setScheduleGroup(group); setEditSchedule(null); }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* SCHEDULES TAB */}
        <TabsContent value="schedules" className="mt-4 space-y-6">
          {/* Upcoming */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Upcoming</h3>
            {upcomingSchedules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming schedules.</p>
            ) : (
              <div className="space-y-2">
                {upcomingSchedules.map(s => {
                  const grp = groupById[s.group_id];
                  const canEdit = isChurchAdmin || isLeaderOfGroup(grp);
                  const canAttend = grp && canTakeAttendance(grp);
                  return (
                    <Card key={s.id}>
                      <CardContent className="p-4 flex items-start gap-4">
                        <div className="text-center min-w-[48px]">
                          <p className="text-xs text-muted-foreground uppercase">{format(new Date(s.date + 'T00:00:00'), 'MMM')}</p>
                          <p className="text-2xl font-bold leading-tight">{format(new Date(s.date + 'T00:00:00'), 'd')}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(s.date + 'T00:00:00'), 'EEE')}</p>
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
                        <div className="flex gap-1 flex-shrink-0 flex-wrap">
                          {canAttend && (
                            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => setAttendanceTarget({ schedule: s, group: grp })}>
                              <ClipboardCheck className="w-3 h-3" /> Attendance
                            </Button>
                          )}
                          {canEdit && (
                            <>
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setScheduleGroup(grp); setEditSchedule(s); }}>Edit</Button>
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteScheduleMutation.mutate(s.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past */}
          {pastSchedules.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past</h3>
              <div className="space-y-2">
                {pastSchedules.slice(-10).reverse().map(s => {
                  const grp = groupById[s.group_id];
                  const canAttendPast = grp && canTakeAttendance(grp);
                  return (
                    <Card key={s.id} className="opacity-70">
                      <CardContent className="p-3 flex items-center gap-3">
                        <p className="text-sm text-muted-foreground w-24 flex-shrink-0">{format(new Date(s.date + 'T00:00:00'), 'MMM d, yyyy')}</p>
                        <p className="text-sm flex-1 truncate">{s.title}</p>
                        {grp && <Badge variant="secondary" className="text-xs">{grp.name}</Badge>}
                        {canAttendPast && (
                          <Button size="sm" variant="outline" className="text-xs h-7 gap-1 flex-shrink-0" onClick={() => setAttendanceTarget({ schedule: s, group: grp })}>
                            <ClipboardCheck className="w-3 h-3" /> Attendance
                          </Button>
                        )}
                        {isChurchAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-7 h-7 text-destructive flex-shrink-0"
                            onClick={() => { if (window.confirm('Delete this past service? This cannot be undone.')) deleteScheduleMutation.mutate(s.id); }}
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

        {/* MESSAGES TAB */}
        {myGroups.length > 0 && (
          <TabsContent value="messages" className="mt-4">
            <div className="grid sm:grid-cols-3 gap-4">
              {/* Group selector */}
              <div className="sm:col-span-1 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Your Groups</p>
                {myGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setMessagingGroup(g)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:shadow-sm
                      ${messagingGroup?.id === g.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card hover:bg-muted/30'}`}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: g.color || '#6366f1' }}>{g.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{g.name}</p>
                      <p className="text-xs text-muted-foreground">{memberCounts[g.id] || 0} members</p>
                    </div>
                  </button>
                ))}
              </div>
              {/* Feed */}
              <div className="sm:col-span-2">
                {messagingGroup ? (
                  <div className="border rounded-xl p-4 bg-card">
                    <GroupMessageFeed
                      group={messagingGroup}
                      user={user}
                      isAdmin={isChurchAdmin || messagingGroup.leader_email === user?.email}
                      memberCount={memberCounts[messagingGroup.id] || 0}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border rounded-xl bg-muted/20">
                    <MessageSquare className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm">Select a group to view messages</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        )}

        {/* COMMUNICATIONS TAB */}
        {(isChurchAdmin || myLeaderGroups.length > 0) && (
          <TabsContent value="comms" className="mt-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(isChurchAdmin ? groups : myLeaderGroups).map(group => (
                <Card key={group.id} className={`cursor-pointer hover:shadow-md transition-shadow ${viewAnnouncementsGroup?.id === group.id ? 'ring-2 ring-primary' : ''}`}
                  onClick={() => setViewAnnouncementsGroup(group)}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                      style={{ backgroundColor: group.color || '#6366f1' }}>{group.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">{memberCounts[group.id] || 0} members</p>
                    </div>
                    <Button size="sm" variant="outline" className="text-xs gap-1 flex-shrink-0" onClick={e => { e.stopPropagation(); setAnnounceGroup(group); }}>
                      <Megaphone className="w-3 h-3" /> Send
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {viewAnnouncementsGroup && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{viewAnnouncementsGroup.name} — Recent Messages</h3>
                  <Button size="sm" className="gap-1.5" onClick={() => setAnnounceGroup(viewAnnouncementsGroup)}>
                    <Plus className="w-3.5 h-3.5" /> New Message
                  </Button>
                </div>
                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No messages sent yet.</p>
                ) : announcements.map(a => (
                  <Card key={a.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{TYPE_ICON[a.type] || '📢'}</span>
                          <p className="font-medium text-sm">{a.title}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Badge className={`text-xs ${STATUS_COLOR[a.status]}`}>{a.status}</Badge>
                          {a.scheduled_for && <span className="text-xs text-muted-foreground">{format(new Date(a.scheduled_for), 'MMM d, h:mm a')}</span>}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-3">{a.body}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>By {a.sender_name} · {format(new Date(a.created_date), 'MMM d, yyyy')}</span>
                        {a.send_email && <span className="flex items-center gap-1">{a.email_sent ? '✅ Emails sent' : '📧 Email pending'}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        {/* VOLUNTEERS TAB */}
        {isChurchAdmin && (
          <TabsContent value="volunteers" className="mt-4">
            <VolunteerRolesPanel groups={groups} churchId={churchId} isAdmin={isChurchAdmin} />
          </TabsContent>
        )}

        {/* ANALYTICS TAB */}
        {isChurchAdmin && (
          <TabsContent value="analytics" className="mt-4">
            <MinistryAttendanceAnalytics groups={groups} churchId={churchId} />
          </TabsContent>
        )}
      </Tabs>

      {/* Dialogs */}
      {manageGroup !== null && (
        <ManageGroupDialog
          group={manageGroup?.id ? manageGroup : null}
          isAdmin={isChurchAdmin}
          user={user}
          onClose={() => setManageGroup(null)}
          onSaved={() => { queryClient.invalidateQueries({ queryKey: ['ministry-groups'] }); }}
        />
      )}
      {announceGroup && <AnnounceDialog group={announceGroup} user={user} onClose={() => setAnnounceGroup(null)} />}
      {scheduleGroup && (
        <ScheduleDialog
          group={scheduleGroup}
          editSchedule={editSchedule}
          user={user}
          onClose={() => { setScheduleGroup(null); setEditSchedule(null); }}
        />
      )}
      {attendanceTarget && (
        <TakeAttendanceDialog
          schedule={attendanceTarget.schedule}
          group={attendanceTarget.group}
          onClose={() => setAttendanceTarget(null)}
        />
      )}
    </div>
  );
}