import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function AnniversaryWidget({ churchId, churchName }) {
  const [sending, setSending] = useState(null);

  const { data: members = [] } = useQuery({
    queryKey: ['members-anniversaries', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }),
    enabled: !!churchId,
  });

  // Find members with anniversaries in the next 30 days
  const today = new Date();
  const upcoming = members
    .filter(m => m.join_date)
    .map(m => {
      const joinDate = new Date(m.join_date + 'T00:00:00');
      const thisYear = new Date(today.getFullYear(), joinDate.getMonth(), joinDate.getDate());
      const nextAnniversary = thisYear < today
        ? new Date(today.getFullYear() + 1, joinDate.getMonth(), joinDate.getDate())
        : thisYear;
      const daysUntil = Math.round((nextAnniversary - today) / (1000 * 60 * 60 * 24));
      const yearsOfService = nextAnniversary.getFullYear() - joinDate.getFullYear();
      return { ...m, daysUntil, yearsOfService, nextAnniversary };
    })
    .filter(m => m.daysUntil <= 30)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  const handleSendEmail = async (member) => {
    if (!member.email) {
      toast.error('This member has no email address');
      return;
    }
    setSending(member.id);
    const firstName = member.first_name;
    const years = member.yearsOfService;
    const subject = encodeURIComponent(`Happy ${years}-Year Anniversary, ${firstName}! 🎉`);
    const body = encodeURIComponent(
      `Dear ${firstName},\n\nCongratulations on ${years} wonderful year${years !== 1 ? 's' : ''} with ${churchName || 'our church'}! We are so grateful for your faithful membership and the impact you have made in our congregation.\n\nMay God continue to bless you abundantly!\n\nWith love and gratitude,\n${churchName || 'Your Church Family'}`
    );
    window.open(`mailto:${member.email}?subject=${subject}&body=${body}`);
    setSending(null);
    toast.success(`Email draft opened for ${firstName}`);
  };

  if (upcoming.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Upcoming Anniversaries
          <Badge className="bg-amber-100 text-amber-700 ml-1">{upcoming.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {upcoming.map(member => (
          <div
            key={member.id}
            className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-amber-50/30"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                {member.first_name?.[0]}{member.last_name?.[0]}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">
                  {member.first_name} {member.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.yearsOfService} year{member.yearsOfService !== 1 ? 's' : ''} ·{' '}
                  {member.daysUntil === 0
                    ? '🎉 Today!'
                    : member.daysUntil === 1
                    ? 'Tomorrow'
                    : `In ${member.daysUntil} days`}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100"
              onClick={() => handleSendEmail(member)}
              disabled={sending === member.id}
            >
              <Mail className="w-3 h-3" /> Celebrate
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}