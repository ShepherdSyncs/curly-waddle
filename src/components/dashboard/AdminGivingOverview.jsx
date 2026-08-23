import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HandCoins } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

export default function AdminGivingOverview({ churchId }) {
  const { data: giving = [] } = useQuery({
    queryKey: ['giving-dashboard', churchId],
    queryFn: () => base44.entities.GivingRecord.filter({ church_id: churchId }, '-date', 200),
    enabled: !!churchId,
  });

  const totalAll = giving.reduce((s, g) => s + (g.amount || 0), 0);

  const thisMonthStart = startOfMonth(new Date()).toISOString().split('T')[0];
  const thisMonthEnd = endOfMonth(new Date()).toISOString().split('T')[0];
  const thisMonth = giving.filter(g => g.date >= thisMonthStart && g.date <= thisMonthEnd)
    .reduce((s, g) => s + (g.amount || 0), 0);

  // Last 6 months chart
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(new Date(), 5 - i);
    const start = startOfMonth(d).toISOString().split('T')[0];
    const end = endOfMonth(d).toISOString().split('T')[0];
    const total = giving.filter(g => g.date >= start && g.date <= end).reduce((s, g) => s + (g.amount || 0), 0);
    return { month: format(d, 'MMM'), total };
  });

  const byType = giving.reduce((acc, g) => {
    acc[g.type] = (acc[g.type] || 0) + (g.amount || 0);
    return acc;
  }, {});

  const typeLabels = { tithe: 'Tithe', offering: 'Offering', missions: 'Missions', building_fund: 'Building', benevolence: 'Benevolence', other: 'Other' };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <HandCoins className="w-4 h-4 text-primary" />
          Giving Overview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">This Month</p>
            <p className="text-xl font-bold text-primary">${thisMonth.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">All Time</p>
            <p className="text-xl font-bold">${totalAll.toLocaleString()}</p>
          </div>
        </div>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, 'Giving']} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5">
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([type, amount]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground capitalize">{typeLabels[type] || type}</span>
              <span className="font-medium">${amount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}