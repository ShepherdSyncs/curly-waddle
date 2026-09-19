import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ClipboardList, Star } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/supabaseClient';
import { cn } from '@/lib/utils';

function RatingInput({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-1"
          aria-label={`Rate ${n} out of 5`}
        >
          <Star className={cn('w-6 h-6', n <= (value || 0) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')} />
        </button>
      ))}
    </div>
  );
}

// assignment: { id, survey: { id, title, description, questions }, dismiss_count, required }
export default function SurveyPromptDialog({ assignment, onDismissed, onCompleted }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  const survey = assignment.survey;
  const questions = survey?.questions || [];
  const canDismiss = !assignment.required;

  const setAnswer = (qid, value) => setAnswers(prev => ({ ...prev, [qid]: value }));

  const missingRequired = questions.some(q => q.required && !answers[q.id]);

  const handleSubmit = async () => {
    if (missingRequired) {
      toast.error('Please answer all required questions');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('submit_survey_response', {
      p_assignment_id: assignment.id,
      p_answers: answers,
    });
    setSubmitting(false);
    if (error) {
      toast.error('Failed to submit survey: ' + error.message);
      return;
    }
    toast.success('Thank you for completing the survey');
    onCompleted?.(assignment.id);
  };

  const handleDismiss = async () => {
    setDismissing(true);
    const { error } = await supabase.rpc('dismiss_survey_prompt', {
      p_assignment_id: assignment.id,
    });
    setDismissing(false);
    if (error) {
      toast.error('Could not dismiss: ' + error.message);
      return;
    }
    onDismissed?.(assignment.id);
  };

  return (
    <Dialog open onOpenChange={() => { if (canDismiss) handleDismiss(); }}>
      <DialogContent className="max-w-lg" onInteractOutside={e => { if (!canDismiss) e.preventDefault(); }} onEscapeKeyDown={e => { if (!canDismiss) e.preventDefault(); }} hideClose={!canDismiss}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            {survey?.title || 'Survey'}
          </DialogTitle>
          <DialogDescription>
            {survey?.description || 'Please share your feedback.'}
          </DialogDescription>
        </DialogHeader>

        {!canDismiss && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            You've postponed this survey twice this month — please complete it now.
          </div>
        )}

        <div className="space-y-5 max-h-[50vh] overflow-y-auto pr-1">
          {questions.map((q, i) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium">
                {i + 1}. {q.prompt}{q.required && <span className="text-destructive"> *</span>}
              </Label>
              {q.type === 'text' && (
                <Textarea
                  value={answers[q.id] || ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder="Type your answer..."
                  rows={3}
                />
              )}
              {q.type === 'multiple_choice' && (
                <RadioGroup value={answers[q.id] || ''} onValueChange={v => setAnswer(q.id, v)}>
                  {(q.options || []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} id={`${q.id}-${oi}`} />
                      <Label htmlFor={`${q.id}-${oi}`} className="font-normal">{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
              {q.type === 'rating' && (
                <RatingInput value={answers[q.id]} onChange={v => setAnswer(q.id, v)} />
              )}
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          {canDismiss && (
            <Button variant="outline" className="flex-1" onClick={handleDismiss} disabled={dismissing || submitting}>
              {dismissing ? 'Please wait...' : 'Remind me later'}
            </Button>
          )}
          <Button className="flex-1" onClick={handleSubmit} disabled={submitting || dismissing}>
            {submitting ? 'Submitting...' : 'Submit Survey'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
