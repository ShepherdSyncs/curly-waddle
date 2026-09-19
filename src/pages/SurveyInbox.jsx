import React, { useState } from 'react';
import useAppUser from '@/hooks/useAppUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Inbox, Mail, MailOpen, Star, Church } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function SurveyInbox() {
  const { isGlobalAdmin } = useAppUser();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['survey-responses-inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_responses')
        .select('*, survey:surveys(title, questions)')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isGlobalAdmin,
  });

  const questionPrompt = (response, qid) => {
    const q = (response?.survey?.questions || []).find(q => q.id === qid);
    return q?.prompt || qid;
  };

  const markReadMutation = useMutation({
    mutationFn: ({ id, read }) => base44.entities.SurveyResponse.update(id, { read }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['survey-responses-inbox'] }),
  });

  const openResponse = (r) => {
    setSelected(r);
    if (!r.read) markReadMutation.mutate({ id: r.id, read: true });
  };

  if (!isGlobalAdmin) {
    return <div className="p-8 text-center text-muted-foreground">You don't have access to this page.</div>;
  }

  const unreadCount = responses.filter(r => !r.read).length;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
          <Inbox className="w-6 h-6 text-primary" />
          Survey Inbox
          {unreadCount > 0 && <Badge className="bg-primary text-primary-foreground">{unreadCount} new</Badge>}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Completed survey responses from churches, newest first.
        </p>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading responses...</div>
      ) : responses.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No survey responses yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {responses.map(r => (
            <Card
              key={r.id}
              className={cn('cursor-pointer transition-colors hover:bg-muted/50', !r.read && 'border-primary/40 bg-primary/5')}
              onClick={() => openResponse(r)}
            >
              <CardContent className="py-3.5 flex items-center gap-3">
                {r.read ? (
                  <MailOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <Mail className="w-4 h-4 text-primary shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-sm', !r.read && 'font-semibold')}>
                      {r.church_name || 'Unknown church'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Church className="w-3 h-3" />
                      {r.submitted_by_name || r.submitted_by_email || 'Unknown submitter'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {format(new Date(r.submitted_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.survey?.title || 'Survey'} — {selected.church_name}</DialogTitle>
                <DialogDescription>
                  Submitted by {selected.submitted_by_name || selected.submitted_by_email} on{' '}
                  {format(new Date(selected.submitted_at), 'MMM d, yyyy h:mm a')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {Object.entries(selected.answers || {}).map(([qid, answer]) => (
                  <div key={qid} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{questionPrompt(selected, qid)}</p>
                    {typeof answer === 'number' ? (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={cn('w-4 h-4', n <= answer ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm">{String(answer)}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
