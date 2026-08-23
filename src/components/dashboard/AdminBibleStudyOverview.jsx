import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminBibleStudyOverview({ churchId }) {
  const { data: studies = [] } = useQuery({
    queryKey: ['studies-dashboard', churchId],
    queryFn: () => base44.entities.BibleStudy.filter({ church_id: churchId }, '-date', 50),
    enabled: !!churchId,
  });

  const totalAttendees = studies.reduce((s, st) => s + (st.attendee_count || 0), 0);
  const avgAttendees = studies.length > 0 ? Math.round(totalAttendees / studies.length) : 0;
  const recent = studies.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Bible Study Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold">{studies.length}</p>
            <p className="text-xs text-muted-foreground">Total Studies</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold">{totalAttendees}</p>
            <p className="text-xs text-muted-foreground">Total Attended</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xl font-bold">{avgAttendees}</p>
            <p className="text-xs text-muted-foreground">Avg / Study</p>
          </div>
        </div>
        {recent.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Studies</p>
            {recent.map(s => (
              <div key={s.id} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.title}</p>
                  {s.topic && <p className="text-xs text-muted-foreground truncate">{s.topic}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-muted-foreground">{s.date ? format(new Date(s.date + 'T00:00:00'), 'MMM d') : ''}</p>
                  {s.attendee_count > 0 && <p className="text-xs font-medium text-primary">{s.attendee_count} attended</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}