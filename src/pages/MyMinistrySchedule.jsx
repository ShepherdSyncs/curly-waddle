import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, Clock, MapPin, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function MyMinistrySchedule() {
  const { user } = useAppUser();
  const churchId = user?.church_id;

  const { data: groups = [] } = useQuery({
    queryKey: ['ministry-groups', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter(churchId ? { church_id: churchId, is_active: true } : { is_active: true }),
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ['my-ministry-memberships', user?.email, churchId],
    queryFn: () => base44.entities.MinistryGroupMember.filter(churchId ? { church_id: churchId, member_email: user.email } : { member_email: user.email }),
    enabled: !!user?.email,
  });

  const myGroupIds = new Set(myMemberships.map(m => m.group_id));
  const myGroups = groups.filter(g => myGroupIds.has(g.id));

  const { data: schedules = [] } = useQuery({
    queryKey: ['my-ministry-schedules', churchId, user?.email],
    queryFn: () => base44.entities.MinistrySchedule.filter(churchId ? { church_id: churchId } : {}, 'date', 300),
  });

  const today = format(new Date(), 'yyyy-MM-dd');

  // Only schedules where I'm an assignee
  const mySchedules = schedules.filter(s =>
    myGroupIds.has(s.group_id) &&
    (s.assignees || []).some(a => a.member_email === user?.email || a.member_name === user?.full_name)
  );

  const upcoming = mySchedules.filter(s => s.date >= today);
  const past = mySchedules.filter(s => s.date < today);

  const groupById = Object.fromEntries(groups.map(g => [g.id, g]));

  const getMembership = (groupId) => myMemberships.find(m => m.group_id === groupId);

  if (myGroups.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Not assigned to any ministry group yet.</p>
        <p className="text-sm mt-1">Ask your group leader to add you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* My groups */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" /> My Ministry Roles
        </h3>
        <div className="flex flex-wrap gap-2">
          {myGroups.map(g => {
            const mem = getMembership(g.id);
            return (
              <div key={g.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-card">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: g.color || '#6366f1' }}>{g.name[0]}</div>
                <span className="text-sm font-medium">{g.name}</span>
                {mem?.role_in_group && <Badge variant="secondary" className="text-xs">{mem.role_in_group}</Badge>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming schedule */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Upcoming Assignments
        </h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">No upcoming assignments scheduled.</p>
        ) : (
          <div className="space-y-3">
            {upcoming.map(s => {
              const grp = groupById[s.group_id];
              const myRole = (s.assignees || []).find(a => a.member_email === user?.email || a.member_name === user?.full_name);
              return (
                <Card key={s.id} className="border-l-4" style={{ borderLeftColor: grp?.color || '#6366f1' }}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{s.title}</p>
                          {grp && <Badge variant="secondary" className="text-xs" style={{ backgroundColor: (grp.color || '#6366f1') + '22', color: grp.color || '#6366f1' }}>{grp.name}</Badge>}
                          {myRole?.role && <Badge className="text-xs bg-primary/10 text-primary border-0">{myRole.role}</Badge>}
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(s.date + 'T00:00:00'), 'EEEE, MMMM d, yyyy')}
                          </span>
                          {s.time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{s.time}{s.end_time ? ` – ${s.end_time}` : ''}</span>}
                          {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.location}</span>}
                        </div>
                        {s.notes && <p className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">{s.notes}</p>}
                      </div>
                      <div className="text-center flex-shrink-0">
                        <p className="text-2xl font-bold leading-none">{format(new Date(s.date + 'T00:00:00'), 'd')}</p>
                        <p className="text-xs text-muted-foreground uppercase">{format(new Date(s.date + 'T00:00:00'), 'MMM')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past */}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Past Assignments</h3>
          <div className="space-y-2 opacity-60">
            {past.slice(-8).reverse().map(s => {
              const grp = groupById[s.group_id];
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <p className="text-sm text-muted-foreground w-28 flex-shrink-0">{format(new Date(s.date + 'T00:00:00'), 'MMM d, yyyy')}</p>
                  <p className="text-sm flex-1 truncate">{s.title}</p>
                  {grp && <Badge variant="secondary" className="text-xs">{grp.name}</Badge>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}