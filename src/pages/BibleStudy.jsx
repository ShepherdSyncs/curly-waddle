import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BookOpen, Sparkles, Loader2, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import StudyGuidesTab from '@/components/bible-study/StudyGuidesTab';
import StudyCompanionTab from '@/components/bible-study/StudyCompanionTab';

export default function BibleStudy() {
  const { user, isStaff, isGlobalAdmin } = useAppUser();
  const churchId = user?.church_id;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), topic: '', scripture_references: '', attendee_count: '', leader_name: '', notes: '' });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiQuery, setAiQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: studies = [] } = useQuery({
    queryKey: ['studies', churchId],
    queryFn: () => churchId
      ? base44.entities.BibleStudy.filter({ church_id: churchId }, '-date', 100)
      : isGlobalAdmin ? base44.entities.BibleStudy.list('-date', 100) : [],
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.BibleStudy.create({
      ...data,
      church_id: churchId,
      attendee_count: parseInt(data.attendee_count) || 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studies'] });
      setOpen(false);
      setForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), topic: '', scripture_references: '', attendee_count: '', leader_name: '', notes: '' });
      toast.success('Bible study recorded');
    },
  });

  const handleAiStudy = async () => {
    if (!aiQuery.trim()) { toast.error('Enter a topic or scripture'); return; }
    setAiLoading(true);
    setAiResult(null);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a Bible study assistant. Create a comprehensive Bible study guide on the following topic or scripture passage: "${aiQuery}".

Include:
1. **Introduction** - Brief context and background
2. **Key Scriptures** - Relevant Bible verses (use KJV references)
3. **Main Points** - 3-5 key teachings or lessons
4. **Discussion Questions** - 4-6 thought-provoking questions for group discussion
5. **Application** - How to apply these teachings in daily life
6. **Prayer Points** - 2-3 prayer focuses related to the study

Format as clean markdown with headers.`,
    });
    setAiResult(result);
    setAiLoading(false);
  };

  const totalAttendees = studies.reduce((s, st) => s + (st.attendee_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Bible Study</h1>
          <p className="text-sm text-muted-foreground mt-1">Study tools, guides & session tracking</p>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="companion">AI Companion</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          {isStaff && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 mr-2" /> Log Study Session</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Log Bible Study Session</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-4">
                  <div><Label>Title *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Study title" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Date *</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
                    <div><Label>Attendees</Label><Input type="number" value={form.attendee_count} onChange={e => setForm({ ...form, attendee_count: e.target.value })} placeholder="0" /></div>
                  </div>
                  <div><Label>Topic</Label><Input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="Study topic" /></div>
                  <div><Label>Scripture References</Label><Input value={form.scripture_references} onChange={e => setForm({ ...form, scripture_references: e.target.value })} placeholder="e.g. John 3:16, Romans 8:28" /></div>
                  <div><Label>Leader</Label><Input value={form.leader_name} onChange={e => setForm({ ...form, leader_name: e.target.value })} placeholder="Study leader name" /></div>
                  <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
                  <Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.title || !form.date || createMutation.isPending}>
                    {createMutation.isPending ? 'Saving...' : 'Save Session'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          {/* AI Bible Study Tool */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-secondary" />
                AI Bible Study Assistant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  placeholder="Enter a topic, scripture, or question..."
                  className="flex-1"
                  onKeyDown={e => e.key === 'Enter' && handleAiStudy()}
                />
                <Button onClick={handleAiStudy} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  {aiLoading ? 'Generating...' : 'Generate'}
                </Button>
              </div>
              {aiResult && (
                <div className="bg-card rounded-lg border p-5 prose prose-sm max-w-none">
                  <ReactMarkdown>{aiResult}</ReactMarkdown>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{studies.length}</p>
                  <p className="text-xs text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalAttendees}</p>
                  <p className="text-xs text-muted-foreground">Total Attendees</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent Studies */}
          <div className="space-y-3">
            {studies.map(s => (
              <Card key={s.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{s.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(s.date), 'MMM d, yyyy')}</span>
                        {s.attendee_count > 0 && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{s.attendee_count}</span>}
                      </div>
                      {s.scripture_references && <p className="text-sm mt-1"><span className="font-medium">Scripture:</span> {s.scripture_references}</p>}
                      {s.leader_name && <p className="text-sm text-muted-foreground">Led by {s.leader_name}</p>}
                    </div>
                    {s.topic && <Badge variant="secondary">{s.topic}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
            {studies.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">No Bible study sessions recorded</CardContent></Card>}
          </div>
        </TabsContent>

        <TabsContent value="guides">
          <StudyGuidesTab />
        </TabsContent>

        <TabsContent value="companion">
          <StudyCompanionTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}