import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Mail, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function HouseholdMessagesTab({ user }) {
  const { data, isLoading } = useQuery({
    queryKey: ['household-messages', user?.email],
    queryFn: () => base44.functions.invoke('getHouseholdMessages', {}),
    enabled: !!user?.email,
  });

  const messages = data?.data?.messages || [];
  const isHOH = data?.data?.isHOH || false;

  if (isLoading) return <Card><CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent></Card>;

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">No messages yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {isHOH
          ? 'Messages sent by members of your household to the pastoral team.'
          : 'Your messages to the pastoral team.'}
      </p>
      {messages.map(m => (
        <Card key={m.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{m.sender_name}</span>
                {isHOH && m.sender_email !== user?.email && (
                  <Badge variant="outline" className="text-xs">Family</Badge>
                )}
                <Badge variant={m.status === 'replied' ? 'default' : 'secondary'} className="text-xs">
                  {m.status === 'replied' ? <><CheckCircle className="w-3 h-3 mr-1" />Replied</> : <><Mail className="w-3 h-3 mr-1" />Pending</>}
                </Badge>
              </div>
              <span className="text-xs text-muted-foreground">{format(new Date(m.created_date), 'MMM d, yyyy')}</span>
            </div>
            {m.subject && <p className="text-sm font-medium">{m.subject}</p>}
            <p className="text-sm text-muted-foreground">{m.body}</p>
            {m.reply_body && (
              <div className="pt-2 border-t">
                <p className="text-xs font-medium mb-1">Reply from {m.replied_by_name || 'Pastoral Team'}:</p>
                <p className="text-sm text-muted-foreground">{m.reply_body}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}