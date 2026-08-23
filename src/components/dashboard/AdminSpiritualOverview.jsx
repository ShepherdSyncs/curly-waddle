import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Droplets, Flame, Heart } from 'lucide-react';
import { format } from 'date-fns';

const ICONS = {
  baptism: { icon: Droplets, color: 'text-blue-500', bg: 'bg-blue-100/60', label: 'Baptisms' },
  holy_ghost: { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-100/60', label: 'Holy Ghost' },
  rededication: { icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100/60', label: 'Rededications' },
};

export default function AdminSpiritualOverview({ churchId }) {
  const { data: records = [] } = useQuery({
    queryKey: ['spiritual-dashboard', churchId],
    queryFn: () => base44.entities.SpiritualRecord.filter({ church_id: churchId }, '-date', 100),
    enabled: !!churchId,
  });

  const counts = {
    baptism: records.filter(r => r.type === 'baptism').length,
    holy_ghost: records.filter(r => r.type === 'holy_ghost').length,
    rededication: records.filter(r => r.type === 'rededication').length,
  };

  const recent = records.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Droplets className="w-4 h-4 text-primary" />
          Spiritual Records
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ICONS).map(([type, { icon: Icon, color, bg, label }]) => (
            <div key={type} className={`rounded-lg ${bg} p-3 text-center`}>
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
              <p className="text-xl font-bold">{counts[type]}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent</p>
            {recent.map(r => {
              const cfg = ICONS[r.type];
              const Icon = cfg?.icon;
              return (
                <div key={r.id} className="flex items-center gap-2 text-sm">
                  {Icon && <Icon className={`w-3.5 h-3.5 ${cfg.color} flex-shrink-0`} />}
                  <span className="font-medium truncate">{r.member_name || '—'}</span>
                  <span className="text-muted-foreground ml-auto text-xs flex-shrink-0">
                    {r.date ? format(new Date(r.date + 'T00:00:00'), 'MMM d, yyyy') : ''}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}