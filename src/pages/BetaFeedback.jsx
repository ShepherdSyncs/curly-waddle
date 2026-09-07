import React, { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import useAppUser from '@/hooks/useAppUser';
import { Send, CheckCircle2 } from 'lucide-react';

const SECTIONS = [
{
title: 'Church Information',
questions: [
{ key: 'church_name', label: 'Church Name', type: 'text' },
{ key: 'attendance', label: 'Current Average Weekly Attendance', type: 'radio', options: ['Under 25', '26-50', '51-100', '101-250', '251-500', 'Over 500'] },
{ key: 'role', label: 'Your Role', type: 'radio', options: ['Pastor', 'Executive Pastor', 'Church Administrator', 'Secretary', 'Volunteer', 'Other'] },
]
},
{
title: 'Setup Experience',
questions: [
{ key: 'setup_ease', label: 'How easy was ShepherdSyncs to set up?', type: 'scale', min: 1, max: 5, labels: { 1: 'Very Difficult', 2: 'Difficult', 3: 'Average', 4: 'Easy', 5: 'Very Easy' } },
{ key: 'import_success', label: 'Were you able to import your member information successfully?', type: 'radio', options: ['Yes', 'Mostly', 'Partially', 'No', "Haven't Tried"] },
{ key: 'setup_challenges', label: 'What setup challenges did you encounter?', type: 'textarea' },
]
},
{
title: 'Feature Usage',
questions: [
{ key: 'features_used', label: 'Which features are you currently using?', type: 'checkbox', options: ['Member Management', 'Attendance Tracking', 'Volunteer Scheduling', 'Church Communications', 'Event Management', 'Reports', 'Small Groups', 'Ministry Teams', 'Visitor Tracking', 'Other'] },
{ key: 'most_valuable', label: 'Which feature provides the most value?', type: 'dropdown', options: ['Member Management', 'Attendance Tracking', 'Volunteer Scheduling', 'Church Communications', 'Event Management', 'Reports', 'Small Groups', 'Ministry Teams', 'Visitor Tracking', 'Other', "Haven't used yet"] },
{ key: 'least_used', label: 'Which feature do you use least?', type: 'dropdown', options: ['Member Management', 'Attendance Tracking', 'Volunteer Scheduling', 'Church Communications', 'Event Management', 'Reports', 'Small Groups', 'Ministry Teams', 'Visitor Tracking', 'Other', "Haven't used yet"] },
]
},
{
title: 'Impact on Ministry',
questions: [
{ key: 'workload', label: 'Has ShepherdSyncs reduced administrative workload?', type: 'radio', options: ['Significantly', 'Somewhat', 'No Change', 'Increased Workload'] },
{ key: 'hours_saved', label: 'How many hours per week has ShepherdSyncs saved?', type: 'radio', options: ['Less than 1 Hour', '1-3 Hours', '4-6 Hours', '7-10 Hours', 'More Than 10 Hours'] },
{ key: 'communication', label: 'Has communication within your church improved?', type: 'radio', options: ['Significantly', 'Somewhat', 'No Change', 'Not Sure'] },
{ key: 'attendance_tracking', label: 'Has attendance tracking become easier?', type: 'radio', options: ['Yes', 'Somewhat', 'No', "We Don't Use Attendance Tracking"] },
]
},
{
title: 'Satisfaction',
questions: [
{ key: 'overall_satisfaction', label: 'Overall, how satisfied are you with ShepherdSyncs?', type: 'scale', min: 1, max: 10 },
{ key: 'nps', label: 'How likely are you to recommend ShepherdSyncs to another church?', type: 'scale', min: 0, max: 10 },
{ key: 'like_most', label: 'What do you like most about ShepherdSyncs?', type: 'textarea' },
{ key: 'like_least', label: 'What do you like least about ShepherdSyncs?', type: 'textarea' },
]
},
{
title: 'Future Improvements',
questions: [
{ key: 'features_wanted', label: 'Which features would you like to see added?', type: 'checkbox', options: ['Text Messaging', 'Online Giving', 'Mobile App', 'Volunteer Scheduling', 'Child Check-In', 'Worship Team Planning', 'Prayer Requests', 'Sermon Notes', 'Multi-Campus Support', 'Other'] },
{ key: 'immediate_improvement', label: 'What is one thing we could improve immediately?', type: 'textarea' },
{ key: 'indispensable', label: 'What feature would make ShepherdSyncs indispensable to your church?', type: 'textarea' },
]
},
{
title: 'Testimonial Request',
questions: [
{ key: 'testimonial', label: 'Would you be willing to provide a testimonial?', type: 'radio', options: ['Yes', 'Maybe', 'Not At This Time'] },
{ key: 'feature_on_site', label: 'Can we feature your church on our website?', type: 'radio', options: ['Yes', 'No'] },
{ key: 'experience', label: 'Please share your experience with ShepherdSyncs.', type: 'textarea' },
]
},
{
title: 'Final',
questions: [
{ key: 'connected_organized', label: 'Is ShepherdSyncs helping your church stay more connected and organized?', type: 'radio', options: ['Strongly Agree', 'Agree', 'Neutral', 'Disagree', 'Strongly Disagree'] },
]
},
];

const TRIAL_QUESTIONS = [
{ key: 'trial_plan', label: 'At the end of your 30-day trial, do you plan to:', type: 'radio', options: ['Continue on the Free Plan', 'Upgrade to Basic', 'Upgrade to Growth', 'Request Enterprise Pricing', 'Not Continue'] },
{ key: 'trial_why_not', label: 'If not continuing, why?', type: 'textarea' },
];

function Question({ q, value, onChange }) {
if (q.type === 'text') return <input className="w-full border rounded-lg px-3 py-2 text-sm" value={value || ''} onChange={e => onChange(q.key, e.target.value)} />;
if (q.type === 'textarea') return <Textarea value={value || ''} onChange={e => onChange(q.key, e.target.value)} rows={3} />;
if (q.type === 'radio') return (<div className="space-y-2">{q.options.map(o => (<label key={o} className="flex items-center gap-2 text-sm cursor-pointer"><input type="radio" name={q.key} checked={value === o} onChange={() => onChange(q.key, o)} className="accent-primary" />{o}</label>))}</div>);
if (q.type === 'checkbox') return (<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{q.options.map(o => (<label key={o} className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={((value || []) as string[]).includes(o)} onChange={() => { const cur = (value || []) as string[]; onChange(q.key, cur.includes(o)? cur.filter(x => x!== o): [...cur, o]); }} className="accent-primary" />{o}</label>))}</div>);
if (q.type === 'dropdown') return (<select className="w-full border rounded-lg px-3 py-2 text-sm" value={value || ''} onChange={e => onChange(q.key, e.target.value)}><option value="">Select...</option>{q.options.map(o => <option key={o} value={o}>{o}</option>)}</select>);
if (q.type === 'scale') {
const nums = []; for (let i = q.min; i <= q.max; i++) nums.push(i);
return (<div className="flex flex-wrap gap-2">{nums.map(n => (<button key={n} type="button" onClick={() => onChange(q.key, n)} className={`w-10 h-10 rounded-lg border-2 text-sm font-semibold transition-colors ${value === n? 'border-primary bg-primary text-primary-foreground': 'border-border hover:border-primary/50'}`}>{n}</button>))}</div>);
}
return null;
}

export default function BetaFeedback() {
const { user, activeChurch } = useAppUser();
const [responses, setResponses] = useState({});
const [submitting, setSubmitting] = useState(false);
const [done, setDone] = useState(false);
const isTrial = activeChurch?.subscription_status === 'trial';

const update = (key, val) => setResponses(prev => ({...prev, [key]: val }));

const handleSubmit = async () => {
setSubmitting(true);
try {
const { error } = await supabase.from('beta_feedback').insert({ church_id: user?.church_id, user_id: user?.id, responses });
if (error) throw error;
await supabase.from('churches').update({ beta_last_feedback: new Date().toISOString(), beta_suspended: false }).eq('id', user?.church_id);
setDone(true);
toast.success('Feedback submitted. Thank you for helping shape ShepherdSyncs.');
} catch (err) {
toast.error(err.message || 'Failed to submit');
} finally {
setSubmitting(false);
}
};

if (done) return (<div className="max-w-xl mx-auto text-center py-20"><CheckCircle2 className="w-16 h-16 mx-auto text-green-500 mb-4" /><h2 className="text-2xl font-bold mb-2">Thank You</h2><p className="text-muted-foreground">Your feedback has been recorded. We truly value your input as a beta partner.</p></div>);

return (<div className="max-w-2xl mx-auto py-8 space-y-6">
<div className="text-center mb-4"><h1 className="text-3xl font-bold mb-2">ShepherdSyncs Church Feedback Survey</h1><p className="text-muted-foreground">Your monthly feedback helps us build what churches actually need.</p></div>
{SECTIONS.map((s, si) => (<Card key={si}><CardHeader><CardTitle className="text-lg">{s.title}</CardTitle></CardHeader><CardContent className="space-y-6">{s.questions.map(q => (<div key={q.key}><label className="block text-sm font-medium mb-2">{q.label}</label><Question q={q} value={responses[q.key]} onChange={update} />{q.type === 'scale' && q.labels && responses[q.key] && <p className="text-xs text-muted-foreground mt-1">{q.labels[responses[q.key]]}</p>}</div>))}</CardContent></Card>))}
{isTrial && (<Card><CardHeader><CardTitle className="text-lg">Trial Conversion</CardTitle></CardHeader><CardContent className="space-y-6">{TRIAL_QUESTIONS.map(q => (<div key={q.key}><label className="block text-sm font-medium mb-2">{q.label}</label><Question q={q} value={responses[q.key]} onChange={update} /></div>))}</CardContent></Card>)}
<Button className="w-full" size="lg" onClick={handleSubmit} disabled={submitting}><Send className="w-4 h-4 mr-2" />{submitting? 'Submitting...': 'Submit Feedback'}</Button>
</div>);
}
