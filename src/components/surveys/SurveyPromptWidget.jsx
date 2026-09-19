import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabaseClient';
import useAppUser from '@/hooks/useAppUser';
import SurveyPromptDialog from './SurveyPromptDialog';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // re-check every 5 minutes while logged in

export default function SurveyPromptWidget() {
  const { user } = useAppUser();
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState([]);

  const isEligible = user?.role === 'church_admin' && !!user?.church_id;

  const { data: dueAssignment } = useQuery({
    queryKey: ['due-survey-assignment', user?.church_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_assignments')
        .select('*, survey:surveys!inner(*)')
        .eq('church_id', user.church_id)
        .eq('status', 'pending')
        .eq('survey.status', 'active')
        .lte('next_prompt_at', new Date().toISOString())
        .order('next_prompt_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: isEligible,
    refetchInterval: CHECK_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const visible = dueAssignment && !dismissedIds.includes(dueAssignment.id);

  const handleDismissed = (id) => {
    setDismissedIds(prev => [...prev, id]);
    queryClient.invalidateQueries({ queryKey: ['due-survey-assignment', user?.church_id] });
  };

  const handleCompleted = (id) => {
    setDismissedIds(prev => [...prev, id]);
    queryClient.invalidateQueries({ queryKey: ['due-survey-assignment', user?.church_id] });
  };

  if (!isEligible || !visible) return null;

  return (
    <SurveyPromptDialog
      assignment={dueAssignment}
      onDismissed={handleDismissed}
      onCompleted={handleCompleted}
    />
  );
}
