import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/supabaseClient';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Archive, RotateCcw, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function ArchivedChurches() {
  const queryClient = useQueryClient();
  const { isGlobalAdmin } = useAppUser();

  const { data: churches = [], isLoading } = useQuery({
    queryKey: ['churches'],
    queryFn: () => base44.entities.Church.list('-created_date', 500),
    enabled: isGlobalAdmin,
  });

  const archived = churches.filter(c => c.status === 'archived');

  const restoreMutation = useMutation({
    mutationFn: async (churchId) => {
      const { error } = await supabase.rpc('unarchive_church', { p_church_id: churchId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      toast.success('Church restored');
    },
    onError: (err) => {
      toast.error('Failed to restore church: ' + err.message);
    },
  });

  if (!isGlobalAdmin) {
    return <div className="p-6 text-center text-muted-foreground">You don't have access to this page.</div>;
  }

  if (isLoading) {
    return <div className="p-6 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-2">
        <Archive className="w-5 h-5 text-amber-600" />
        <h1 className="text-xl font-semibold">Archived Churches</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Archived churches are hidden from the active list, but no data has been deleted.
        Restore a church anytime to bring it back.
      </p>

      {archived.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Archive className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No archived churches</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {archived.map(church => (
            <Card key={church.id}>
              <CardContent className="py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">{church.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{church.city}, {church.state}
                  </p>
                  {church.archived_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Archived {format(new Date(church.archived_at), 'MMM d, yyyy')}
                      {church.archived_by ? ` by ${church.archived_by}` : ''}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate(church.id)}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Restore
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
