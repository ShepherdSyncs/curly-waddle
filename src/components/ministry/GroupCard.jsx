import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Settings, Megaphone, Calendar } from 'lucide-react';

const CATEGORY_COLORS = {
  worship: 'bg-purple-100 text-purple-700',
  youth: 'bg-green-100 text-green-700',
  greeters: 'bg-yellow-100 text-yellow-700',
  pastoral: 'bg-blue-100 text-blue-700',
  janitorial: 'bg-gray-100 text-gray-600',
  outreach: 'bg-orange-100 text-orange-700',
  prayer: 'bg-rose-100 text-rose-700',
  media: 'bg-cyan-100 text-cyan-700',
  other: 'bg-slate-100 text-slate-600',
};

export default function GroupCard({ group, memberCount, isLeader, isAdmin, onManage, onAnnounce, onSchedule }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
              style={{ backgroundColor: group.color || '#6366f1' }}>
              {group.name[0]}
            </div>
            <div>
              <h3 className="font-semibold leading-tight">{group.name}</h3>
              <Badge variant="secondary" className={`text-xs mt-0.5 ${CATEGORY_COLORS[group.category] || CATEGORY_COLORS.other}`}>
                {(group.category || 'other').replace(/_/g, ' ')}
              </Badge>
            </div>
          </div>
          {(isLeader || isAdmin) && (
            <Button size="icon" variant="ghost" className="w-8 h-8 flex-shrink-0" onClick={onManage}>
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>

        {group.description && <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>}

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
          {group.leader_name && <span className="text-muted-foreground/60">· Led by {group.leader_name}</span>}
        </div>

        {(isLeader || isAdmin) && (
          <div className="flex gap-2 pt-1 border-t">
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={onAnnounce}>
              <Megaphone className="w-3.5 h-3.5" /> Announce
            </Button>
            <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={onSchedule}>
              <Calendar className="w-3.5 h-3.5" /> Schedule
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}