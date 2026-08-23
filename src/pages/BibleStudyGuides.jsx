import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, BookOpen, Sparkles, Loader2, Upload, Check, X, Eye, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';

export default function BibleStudyGuides() {
  const { user, isGlobalAdmin, isChurchAdmin } = useAppUser();
  const churchId = user?.church_id;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('approved');
  const [previewGuide, setPreviewGuide] = useState(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [uploadForm, setUploadForm] = useState({ title: '', topic: '', scripture_references: '', content: '', file: null, file_name: '' });

  const { data: guides = [] } = useQuery({
    queryKey: ['guides', churchId],
    queryFn: () => churchId
      ? base44.entities.BibleStudyGuide.filter({ church_id: churchId }, '-created_date', 200)
      : isGlobalAdmin ? base44.entities.BibleStudyGuide.list('-created_date', 200) : [],
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.BibleStudyGuide.update(id, {
      status,
      approved_by: user?.email,
      approved_at: new Date().toISOString(),
    }),
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['guides'] });
      toast.success(status === 'approved' ? 'Guide approved & published' : 'Guide rejected');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BibleStudyGuide.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guides'] });
      toast.success('Guide deleted');
    },
  });

  const handleUpload = async () => {
    if (!uploadForm.title) { toast.error('Title is required'); return; }
    setUploading(true);
    let file_url = '', file_name = '';
    if (uploadForm.file) {
      const res = await base44.integrations.Core.UploadFile({ file: uploadForm.file });
      file_url = res.file_url;
      file_name = uploadForm.file.name;
    }
    const status = isChurchAdmin ? 'approved' : 'pending';
    await base44.entities.BibleStudyGuide.create({
      church_id: churchId,
      title: uploadForm.title,
      topic: uploadForm.topic,
      scripture_references: uploadForm.scripture_references,
      content: uploadForm.content || `# ${uploadForm.title}\n\n${uploadForm.topic || ''}`,
      file_url,
      file_name,
      source: 'uploaded',
      status,
      ...(isChurchAdmin ? { approved_by: user?.email, approved_at: new Date().toISOString() } : {}),
    });
    queryClient.invalidateQueries({ queryKey: ['guides'] });
    setUploadOpen(false);
    setUploadForm({ title: '', topic: '', scripture_references: '', content: '', file: null, file_name: '' });
    setUploading(false);
    toast.success(isChurchAdmin ? 'Guide uploaded & published' : 'Guide submitted for approval');
  };

  const handleAiGenerate = async () => {
    if (!aiQuery.trim()) { toast.error('Enter a topic or scripture'); return; }
    setAiLoading(true);
    setAiResult(null);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a comprehensive Bible study guide on: "${aiQuery}".
Include:
1. **Introduction** - Brief context and background
2. **Key Scriptures** - Relevant Bible verses (KJV)
3. **Main Points** - 3-5 key teachings
4. **Discussion Questions** - 4-6 thought-provoking questions
5. **Application** - How to apply these teachings
6. **Prayer Points** - 2-3 prayer focuses
Format as clean markdown with headers.`,
    });
    setAiResult(result);
    setAiLoading(false);
  };

  const handleSaveAiGuide = async () => {
    if (!aiResult) return;
    const titleMatch = aiQuery;
    const status = isChurchAdmin ? 'approved' : 'pending';
    await base44.entities.BibleStudyGuide.create({
      church_id: churchId,
      title: titleMatch,
      content: aiResult,
      source: 'ai_generated',
      status,
      ...(isChurchAdmin ? { approved_by: user?.email, approved_at: new Date().toISOString() } : {}),
    });
    queryClient.invalidateQueries({ queryKey: ['guides'] });
    setAiOpen(false);
    setAiResult(null);
    setAiQuery('');
    toast.success(isChurchAdmin ? 'AI guide saved & published' : 'AI guide submitted for approval');
  };

  const pending = guides.filter(g => g.status === 'pending');
  const approved = guides.filter(g => g.status === 'approved');
  const rejected = guides.filter(g => g.status === 'rejected');

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    approved: 'bg-green-100 text-green-700 border-green-200',
    rejected: 'bg-red-100 text-red-700 border-red-200',
  };

  const sourceColors = {
    ai_generated: 'bg-purple-100 text-purple-700',
    uploaded: 'bg-blue-100 text-blue-700',
    manual: 'bg-gray-100 text-gray-600',
  };

  const GuideCard = ({ guide }) => (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{guide.title}</h3>
              <Badge variant="outline" className={statusColors[guide.status]}>{guide.status}</Badge>
              <Badge variant="secondary" className={sourceColors[guide.source]}>{guide.source?.replace('_', ' ')}</Badge>
            </div>
            {guide.topic && <p className="text-sm text-muted-foreground mt-0.5">{guide.topic}</p>}
            {guide.scripture_references && <p className="text-xs text-muted-foreground mt-0.5">{guide.scripture_references}</p>}
            <p className="text-xs text-muted-foreground mt-1">Added {format(new Date(guide.created_date), 'MMM d, yyyy')}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => setPreviewGuide(guide)}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
            {guide.status === 'pending' && isChurchAdmin && (
              <>
                <Button size="sm" variant="outline" className="h-8 px-2 text-green-600 border-green-200" onClick={() => approveMutation.mutate({ id: guide.id, status: 'approved' })}>
                  <Check className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-8 px-2 text-red-600 border-red-200" onClick={() => approveMutation.mutate({ id: guide.id, status: 'rejected' })}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {isChurchAdmin && (
              <Button size="sm" variant="ghost" className="h-8 px-2 text-destructive" onClick={() => deleteMutation.mutate(guide.id)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Bible Study Guides</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage & publish study materials for your congregation</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiOpen(true)}>
            <Sparkles className="w-4 h-4 mr-2 text-purple-500" /> AI Generate
          </Button>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="w-4 h-4 mr-2" /> Upload Guide
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{approved.length}</p>
          <p className="text-xs text-muted-foreground">Published</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{pending.length}</p>
          <p className="text-xs text-muted-foreground">Pending Review</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{guides.length}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="approved">Published ({approved.length})</TabsTrigger>
          <TabsTrigger value="pending">
            Pending {pending.length > 0 && <Badge className="ml-1.5 h-4 w-4 p-0 justify-center text-[10px]">{pending.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="rejected">Rejected ({rejected.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="approved" className="space-y-3 mt-4">
          {approved.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No published guides</CardContent></Card>
            : approved.map(g => <GuideCard key={g.id} guide={g} />)}
        </TabsContent>
        <TabsContent value="pending" className="space-y-3 mt-4">
          {pending.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No pending guides</CardContent></Card>
            : pending.map(g => <GuideCard key={g.id} guide={g} />)}
        </TabsContent>
        <TabsContent value="rejected" className="space-y-3 mt-4">
          {rejected.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">No rejected guides</CardContent></Card>
            : rejected.map(g => <GuideCard key={g.id} guide={g} />)}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog */}
      <Dialog open={!!previewGuide} onOpenChange={v => !v && setPreviewGuide(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewGuide?.title}</DialogTitle>
          </DialogHeader>
          {previewGuide?.file_url && (
            <a href={previewGuide.file_url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="mb-3 gap-2">
                <ExternalLink className="w-4 h-4" /> Download Attached File
              </Button>
            </a>
          )}
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{previewGuide?.content || ''}</ReactMarkdown>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Upload Bible Study Guide</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div><Label>Title *</Label><Input value={uploadForm.title} onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })} placeholder="Guide title" /></div>
            <div><Label>Topic</Label><Input value={uploadForm.topic} onChange={e => setUploadForm({ ...uploadForm, topic: e.target.value })} placeholder="e.g. Faith, Prayer" /></div>
            <div><Label>Scripture References</Label><Input value={uploadForm.scripture_references} onChange={e => setUploadForm({ ...uploadForm, scripture_references: e.target.value })} placeholder="e.g. John 3:16" /></div>
            <div>
              <Label>Content (optional if uploading file)</Label>
              <Textarea value={uploadForm.content} onChange={e => setUploadForm({ ...uploadForm, content: e.target.value })} placeholder="Study notes or outline (markdown supported)..." className="h-32" />
            </div>
            <div>
              <Label>Attach File (PDF, DOC, etc.)</Label>
              <input type="file" accept=".pdf,.doc,.docx,.txt" className="mt-1 w-full text-sm" onChange={e => setUploadForm({ ...uploadForm, file: e.target.files[0] })} />
            </div>
            {!isChurchAdmin && <p className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-2">This will be submitted for church admin approval before being published to members.</p>}
            <Button className="w-full" onClick={handleUpload} disabled={!uploadForm.title || uploading}>
              {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : isChurchAdmin ? 'Upload & Publish' : 'Submit for Approval'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Generate Dialog */}
      <Dialog open={aiOpen} onOpenChange={v => { setAiOpen(v); if (!v) { setAiResult(null); setAiQuery(''); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-purple-500" /> AI Bible Study Generator</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex gap-3">
              <Input value={aiQuery} onChange={e => setAiQuery(e.target.value)} placeholder="Enter a topic, scripture, or question..." className="flex-1" onKeyDown={e => e.key === 'Enter' && handleAiGenerate()} />
              <Button onClick={handleAiGenerate} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
            {aiResult && (
              <>
                <div className="bg-muted/50 rounded-lg border p-4 prose prose-sm max-w-none max-h-96 overflow-y-auto">
                  <ReactMarkdown>{aiResult}</ReactMarkdown>
                </div>
                {!isChurchAdmin && <p className="text-xs text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-2">This will be submitted for church admin approval before being published.</p>}
                <Button className="w-full" onClick={handleSaveAiGuide}>
                  {isChurchAdmin ? 'Save & Publish' : 'Submit for Approval'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}