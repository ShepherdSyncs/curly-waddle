import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CalendarCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subDays, startOfWeek } from 'date-fns';

export default function AdminAttendanceOverview({ churchId }) {
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-dashboard', churchId],
    queryFn: () => base44.entities.AttendanceRecord.filter({ church_id: churchId }, '-date', 200),
    enabled: !!churchId,
  });

  const last8Weeks = Array.from({ length: 8 }, (_, i) => {
    const weekStart = startOfWeek(subDays(new Date(), i * 7));
    const label = format(weekStart, 'MMM d');
    const count = attendance.filter(a => {
      const ws = startOfWeek(new Date(a.date));
      return ws.toDateString() === weekStart.toDateString() && a.present;
    }).length;
    return { week: label, count };
  }).reverse();

  const recentTwo = last8Weeks.slice(-2);
  const trend = recentTwo.length === 2 ? recentTwo[1].count - recentTwo[0].count : 0;
  const thisWeek = last8Weeks[last8Weeks.length - 1]?.count || 0;
  const avgLast8 = Math.round(last8Weeks.reduce((s, w) => s + w.count, 0) / (last8Weeks.filter(w => w.count > 0).length || 1));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-primary" />
          Attendance Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">This Week</p>
            <div className="flex items-center gap-1.5">
              <p className="text-xl font-bold">{thisWeek}</p>
              {trend !== 0 && (
                trend > 0
                  ? <TrendingUp className="w-4 h-4 text-green-500" />
                  : <TrendingDown className="w-4 h-4 text-red-400" />
              )}
            </div>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">8-Week Avg</p>
            <p className="text-xl font-bold">{avgLast8}</p>
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={last8Weeks} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="week" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}