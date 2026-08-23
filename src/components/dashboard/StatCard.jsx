import React from 'react';
import { Card } from '@/components/ui/card';

export default function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <Card className="p-5 relative overflow-hidden group hover:shadow-md transition-shadow duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl md:text-3xl font-bold mt-1 text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color || 'bg-primary/10'}`}>
          <Icon className={`w-5 h-5 ${color ? 'text-white' : 'text-primary'}`} />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}