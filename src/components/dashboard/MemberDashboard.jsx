import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, BookOpen, Clock } from 'lucide-react';
import { format, isAfter, startOfDay } from 'date-fns';

export default function MemberDashboard({ churchId, user }) {
  const today = startOfDay(new Date()).toISOString().split('T')[0];

  const { data: events = [] } = useQuery({
    queryKey: ['events-member', churchId],
    queryFn: () => base44.entities.ChurchEvent.filter({ church_id: churchId, is_published: true }),
    enabled: !!churchId,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ['schedules-member', churchId, user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      // Find groups this user is a member of
      const groupMembers = await base44.entities.MinistryGroupMember.filter({ church_id: churchId, member_email: user.email });
      if (groupMembers.length === 0) return [];
      const groupIds = groupMembers.map(gm => gm.group_id);
      // Fetch upcoming schedules for those groups
      const allSchedules = await Promise.all(
        groupIds.map(gid => base44.entities.MinistrySchedule.filter({ group_id: gid }, 'date', 20))
      );
      return allSchedules.flat().filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    },
    enabled: !!churchId && !!user?.email,
  });

  const { data: studies = [] } = useQuery({
    queryKey: ['studies-member', churchId, user?.email],
    queryFn: () => base44.entities.BibleStudy.filter({ church_id: churchId }, '-date', 100),
    enabled: !!churchId,
  });

  const upcomingEvents = events
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const upcomingSchedules = schedules.slice(0, 5);

  // Studies led by this user (by leader_name matching full_name)
  const myStudies = studies.filter(s =>
    s.leader_name && user?.full_name &&
    s.leader_name.toLowerCase().includes(user.full_name.split(' ')[0]?.toLowerCase())
  );

  const categoryColors = {
    service: 'bg-blue-100 text-blue-700',
    bible_study: 'bg-green-100 text-green-700',
    youth: 'bg-purple-100 text-purple-700',
    outreach: 'bg-orange-100 text-orange-700',
    fellowship: 'bg-pink-100 text-pink-700',
    conference: 'bg-indigo-100 text-indigo-700',
    other: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="grid md:grid-cols-3 gap-4">
      {/* Upcoming Events */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Upcoming Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming events</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map(e => (
                <div key={e.id} className="space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-tight">{e.title}</p>
                    <Badge variant="secondary" className={`text-xs flex-shrink-0 ${categoryColors[e.category] || categoryColors.other}`}>
                      {e.category?.replace('_', ' ') || 'other'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(e.date + 'T00:00:00'), 'EEE, MMM d')}
                    {e.time && ` · ${e.time}`}
                    {e.location && ` · ${e.location}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Upcoming Schedules */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            My Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingSchedules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No upcoming assignments</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingSchedules.map(s => (
                <div key={s.id} className="space-y-0.5">
                  <p className="text-sm font-medium leading-tight">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.date + 'T00:00:00'), 'EEE, MMM d')}
                    {s.time && ` · ${s.time}`}
                  </p>
                  {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bible Studies Given */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            Bible Studies Given
            <Badge variant="secondary" className="ml-auto text-xs">{myStudies.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myStudies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No studies recorded yet</p>
          ) : (
            <div className="space-y-2.5">
              {myStudies.slice(0, 5).map(s => (
                <div key={s.id} className="space-y-0.5">
                  <p className="text-sm font-medium leading-tight">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.date ? format(new Date(s.date + 'T00:00:00'), 'MMM d, yyyy') : ''}
                    {s.attendee_count > 0 && ` · ${s.attendee_count} attended`}
                  </p>
                </div>
              ))}
              {myStudies.length > 5 && (
                <p className="text-xs text-muted-foreground text-center">+{myStudies.length - 5} more</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}