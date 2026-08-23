import React, { useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';
import { TrendingUp, Users, HandCoins, Droplets } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildMonthlyData(items, dateField, valueField = null, year) {
  const buckets = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], value: 0 }));
  items.forEach(item => {
    const d = item[dateField];
    if (!d) return;
    const date = new Date(d);
    if (date.getFullYear() !== year) return;
    const m = date.getMonth();
    buckets[m].value += valueField ? (item[valueField] || 0) : 1;
  });
  return buckets;
}

export default function Analytics() {
  const { user, isChurchAdmin, isGlobalAdmin } = useAppUser();
  const [year, setYear] = useState(new Date().getFullYear());

  const churchId = user?.church_id;

  const { data: giving = [] } = useQuery({
    queryKey: ['giving', churchId],
    queryFn: () => churchId
      ? base44.entities.GivingRecord.filter({ church_id: churchId })
      : base44.entities.GivingRecord.list(),
    enabled: !!user && !isGlobalAdmin,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance', churchId],
    queryFn: () => churchId
      ? base44.entities.AttendanceRecord.filter({ church_id: churchId })
      : base44.entities.AttendanceRecord.list(),
    enabled: !!user,
  });

  const { data: spiritual = [] } = useQuery({
    queryKey: ['spiritual', churchId],
    queryFn: () => churchId
      ? base44.entities.SpiritualRecord.filter({ church_id: churchId })
      : base44.entities.SpiritualRecord.list(),
    enabled: !!user,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', churchId],
    queryFn: () => churchId
      ? base44.entities.ChurchMember.filter({ church_id: churchId })
      : base44.entities.ChurchMember.list(),
    enabled: !!user,
  });

  const givingData = useMemo(() => !isGlobalAdmin ? buildMonthlyData(giving, 'date', 'amount', year) : [], [giving, year, isGlobalAdmin]);
  const attendanceData = useMemo(() => {
    const sunday = attendance.filter(a => a.service_type === 'sunday_morning');
    return buildMonthlyData(sunday, 'date', null, year);
  }, [attendance, year]);

  const growthData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({
      month: MONTHS[i], baptisms: 0, salvations: 0, holy_ghost: 0
    }));
    spiritual.forEach(r => {
      if (!r.date) return;
      const date = new Date(r.date);
      if (date.getFullYear() !== year) return;
      const m = date.getMonth();
      if (r.type === 'baptism') buckets[m].baptisms++;
      else if (r.type === 'salvation') buckets[m].salvations++;
      else if (r.type === 'holy_ghost') buckets[m].holy_ghost++;
    });
    return buckets;
  }, [spiritual, year]);

  const memberGrowthData = useMemo(() => {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ month: MONTHS[i], new_members: 0 }));
    members.forEach(m => {
      const d = m.member_since || m.created_date;
      if (!d) return;
      const date = new Date(d);
      if (date.getFullYear() !== year) return;
      buckets[date.getMonth()].new_members++;
    });
    return buckets;
  }, [members, year]);

  const totalGiving = useMemo(() => !isGlobalAdmin ? givingData.reduce((s, d) => s + d.value, 0) : 0, [givingData, isGlobalAdmin]);
  const totalAttendance = useMemo(() => attendanceData.reduce((s, d) => s + d.value, 0), [attendanceData]);
  const totalBaptisms = useMemo(() => spiritual.filter(r => r.type === 'baptism' && new Date(r.date).getFullYear() === year).length, [spiritual, year]);
  const totalSalvations = useMemo(() => spiritual.filter(r => r.type === 'salvation' && new Date(r.date).getFullYear() === year).length, [spiritual, year]);

  const years = [2023, 2024, 2025, 2026];

  if (!isChurchAdmin && !isGlobalAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Access restricted to Church Admins</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Monthly trends and growth metrics</p>
        </div>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ...(isGlobalAdmin ? [] : [{ label: 'Total Giving', value: `$${totalGiving.toLocaleString()}`, icon: HandCoins, color: 'bg-green-500' }]),
          { label: 'Attendance Records', value: totalAttendance.toLocaleString(), icon: Users, color: 'bg-blue-500' },
          { label: 'Baptisms', value: totalBaptisms, icon: Droplets, color: 'bg-primary' },
          { label: 'Salvations', value: totalSalvations, icon: TrendingUp, color: 'bg-amber-500' },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-4.5 h-4.5 text-white" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Giving Chart */}
      {!isGlobalAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Giving — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={givingData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="givingGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                <Tooltip formatter={v => [`$${v.toLocaleString()}`, 'Giving']} />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--chart-3))" fill="url(#givingGrad)" strokeWidth={2} name="Giving" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Attendance Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sunday Morning Attendance — {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={attendanceData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={v => [v, 'Attendance']} />
              <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Attendance" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Spiritual Growth Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Spiritual Milestones — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={growthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend iconType="circle" iconSize={8} />
                <Bar dataKey="baptisms" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} name="Baptisms" />
                <Bar dataKey="salvations" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} name="Salvations" />
                <Bar dataKey="holy_ghost" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} name="Holy Ghost" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Member Growth Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New Members — {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={memberGrowthData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={v => [v, 'New Members']} />
                <Line type="monotone" dataKey="new_members" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{ r: 4 }} name="New Members" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}