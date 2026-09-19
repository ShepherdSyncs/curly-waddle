import React, { useState } from 'react';
import useAppUser from '@/hooks/useAppUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Upload, Calendar, Clock, CheckCircle2, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const EXAMPLE_JSON = `{
  "title": "Quarterly Ministry Check-In",
  "description": "Help us understand how your church is doing this quarter.",
  "questions": [
    { "id": "q1", "prompt": "How would you rate this quarter overall?", "type": "rating", "required": true },
    { "id": "q2", "prompt": "What's working well?", "type": "text", "required": false },
    { "id": "q3", "prompt": "Which area needs the most support?", "type": "multiple_choice",
      "options": ["Finances", "Attendance", "Volunteers", "Technology"], "required": true }
  ]
}`;

function StatusBadge({ status }) {
  const map = {
    draft: 'bg-slate-100 text-slate-700',
    scheduled: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    closed: 'bg-slate-200 text-slate-500',
  };
  return <Badge className={map[status] || map.draft}>{status}</Badge>;
}

export default function SurveyBuilder() {
  const { isGlobalAdmin } = useAppUser();
  const queryClient = useQueryClient();
  const [importOpen, setImportOpen] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [parseError, setParseError] = useState('');

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['surveys-admin'],
    queryFn: () => base44.entities.Survey.list('-created_at'),
    enabled: isGlobalAdmin,
  });

  const { data: assignmentCounts = {} } = useQuery({
    queryKey: ['survey-assignment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('survey_assignments').select('survey_id, status');
      if (error) throw error;
      const counts = {};
      (data || []).forEach(a => {
        counts[a.survey_id] = counts[a.survey_id] || { total: 0, completed: 0 };
        counts[a.survey_id].total += 1;
        if (a.status === 'completed') counts[a.survey_id].completed += 1;
      });
      return counts;
    },
    enabled: isGlobalAdmin,
  });

  const importMutation = useMutation({
    mutationFn: async ({ survey, scheduledStartAt }) => {
      const { data, error } = await supabase.rpc('import_survey', {
        p_survey: survey,
        p_scheduled_start_at: scheduledStartAt || null,
        p_church_ids: null, // all churches
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Survey imported');
      queryClient.invalidateQueries({ queryKey: ['surveys-admin'] });
      queryClient.invalidateQueries({ queryKey: ['survey-assignment-counts'] });
      setImportOpen(false);
      setJsonText('');
      setScheduleAt('');
      setParseError('');
    },
    onError: (err) => {
      toast.error('Import failed: ' + err.message);
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id) => base44.entities.Survey.update(id, { status: 'closed' }),
    onSuccess: () => {
      toast.success('Survey closed');
      queryClient.invalidateQueries({ queryKey: ['surveys-admin'] });
    },
    onError: (err) => toast.error('Failed: ' + err.message),
  });

  const handleImport = () => {
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setParseError('That is not valid JSON: ' + e.message);
      return;
    }
    if (!parsed.title) {
      setParseError('JSON must include a "title" field.');
      return;
    }
    if (!Array.isArray(parsed.questions)) {
      setParseError('JSON must include a "questions" array.');
      return;
    }
    setParseError('');
    const scheduledStartAt = scheduleAt ? new Date(scheduleAt).toISOString() : null;
    importMutation.mutate({ survey: parsed, scheduledStartAt });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setJsonText(text);
    e.target.value = '';
  };

  if (!isGlobalAdmin) {
    return <div className="p-8 text-center text-muted-foreground">You don't have access to this page.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Surveys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import surveys from JSON and schedule when they roll out to churches.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          Import Survey
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Loading surveys...</div>
      ) : surveys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No surveys yet. Import one to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {surveys.map(survey => {
            const counts = assignmentCounts[survey.id] || { total: 0, completed: 0 };
            return (
              <Card key={survey.id}>
                <CardContent className="py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium">{survey.title}</h3>
                      <StatusBadge status={survey.status} />
                    </div>
                    {survey.description && (
                      <p className="text-sm text-muted-foreground mt-1">{survey.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileJson className="w-3.5 h-3.5" />
                        {(survey.questions || []).length} question{(survey.questions || []).length === 1 ? '' : 's'}
                      </span>
                      {survey.status === 'scheduled' && survey.scheduled_start_at && (
                        <span className="flex items-center gap-1 text-blue-700">
                          <Calendar className="w-3.5 h-3.5" />
                          Starts {format(new Date(survey.scheduled_start_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      )}
                      {survey.status === 'active' && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          {counts.completed}/{counts.total} churches completed
                        </span>
                      )}
                    </div>
                  </div>
                  {survey.status !== 'closed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => closeMutation.mutate(survey.id)}
                      disabled={closeMutation.isPending}
                    >
                      Close
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) { setJsonText(''); setScheduleAt(''); setParseError(''); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Survey from JSON</DialogTitle>
            <DialogDescription>
              Paste or upload a survey definition. Optionally schedule it to auto-activate and
              go out to churches on a future date — useful for queuing up several surveys over
              the coming months.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Survey JSON</Label>
                <label className="text-xs text-primary cursor-pointer hover:underline">
                  <input type="file" accept=".json,application/json" className="hidden" onChange={handleFileUpload} />
                  Upload a .json file
                </label>
              </div>
              <Textarea
                value={jsonText}
                onChange={e => { setJsonText(e.target.value); setParseError(''); }}
                placeholder={EXAMPLE_JSON}
                rows={10}
                className="font-mono text-xs"
              />
              {parseError && <p className="text-xs text-destructive mt-1">{parseError}</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Expected shape: <code>{'{ title, description, questions: [{ id, prompt, type: "text"|"multiple_choice"|"rating", required, options? }] }'}</code>
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-3.5 h-3.5" />
                Schedule activation (optional)
              </Label>
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={e => setScheduleAt(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to activate and assign to all churches immediately. Otherwise the
                survey stays queued and automatically activates at this time.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!jsonText.trim() || importMutation.isPending}>
              {importMutation.isPending ? 'Importing...' : scheduleAt ? 'Schedule Survey' : 'Import & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
