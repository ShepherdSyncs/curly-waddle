import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Users, ExternalLink } from 'lucide-react';
import { format, parseISO, isFuture, isToday } from 'date-fns';
import { Link } from 'react-router-dom';

export default function EventSignupWidget({ churchId }) {
  const { data: events = [] } = useQuery({
    queryKey: ['signup-events', churchId],
    queryFn: () => base44.entities.ChurchEvent.filter({ church_id: churchId, enable_signup_form: true, is_published: true }),
    enabled: !!churchId,
  });

  const { data: allSignups = [] } = useQuery({
    queryKey: ['all-event-signups', churchId],
    queryFn: () => base44.entities.EventSignup.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  // Only show upcoming events with signup forms
  const upcomingWithSignups = events
    .filter(e => isFuture(parseISO(e.date)) || isToday(parseISO(e.date)))
    .map(e => {
      const signups = allSignups.filter(s => s.event_id === e.id);
      const totalAttendees = signups.reduce((sum, s) => sum + 1 + (s.guest_count || 0), 0);
      return { ...e, signups, totalAttendees };
    })
    .filter(e => e.signups.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcomingWithSignups.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          Event Signups
          <Badge className="bg-primary/10 text-primary ml-1">{upcomingWithSignups.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upcomingWithSignups.map(event => (
          <div key={event.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/30">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{event.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(parseISO(event.date), 'MMM d, yyyy')}
              </p>
              <p className="text-sm mt-1 font-medium text-primary flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {event.signups.length} signed up · {event.totalAttendees} total attendees
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
              <Link to={`/events?view_signups=${event.id}`}>
                <ExternalLink className="w-3.5 h-3.5" />
                View
              </Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}