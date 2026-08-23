import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Heart, CheckCircle2, Share2, User, Lock, EyeOff,
  Plus, Send, FolderOpen, Sparkles
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

const CATEGORY_LABELS = {
  healing: '🙏 Healing',
  family: '👨‍👩‍👧 Family',
  finances: '💼 Finances',
  relationships: '❤️ Relationships',
  salvation: '✝️ Salvation',
  guidance: '🌟 Guidance',
  grief: '🕊️ Grief & Loss',
  thanksgiving: '🙌 Thanksgiving',
  other: '📝 Other',
};

const emptyForm = { name: '', email: '', request: '', category: 'other', is_anonymous: false, is_private: false };

// 30-day cutoff for showing answered requests on the public "Answered" tab
const ANSWERED_VISIBLE_DAYS = 30;

function isAnsweredRecent(req) {
  if (!req.answered_at) return false;
  return differenceInDays(new Date(), new Date(req.answered_at)) < ANSWERED_VISIBLE_DAYS;
}

function PrayerCard({ req, currentUser, isChurchAdmin, onMarkAnswered, onOpen }) {
  const isOwner = req.created_by === currentUser?.email || req.email === currentUser?.email;
  const canMarkAnswered = (isOwner || isChurchAdmin) && req.status === 'active';
  const daysLeft = req.answered_at
    ? ANSWERED_VISIBLE_DAYS - differenceInDays(new Date(), new Date(req.answered_at))
    : null;

  return (
    <Card
      className="hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen(req)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="font-medium text-sm flex items-center gap-1.5">
                {req.is_anonymous
                  ? <><EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> Anonymous</>
                  : <><User className="w-3.5 h-3.5 text-muted-foreground" /> {req.name || 'Member'}</>}
              </span>
              {req.is_private && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-rose-300 text-rose-600 gap-1">
                  <Lock className="w-2.5 h-2.5" /> Private
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {CATEGORY_LABELS[req.category] || req.category}
              </Badge>
              {req.status === 'answered' && (
                <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border border-emerald-200 gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Answered
                </Badge>
              )}
            </div>
            <p className="text-sm text-foreground line-clamp-3">{req.request}</p>
            <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-2">
              <span>{format(new Date(req.created_date), 'MMM d, yyyy')}</span>
              {req.status === 'answered' && req.answered_by && (
                <span className="text-emerald-600">· Answered by {req.answered_by}</span>
              )}
              {req.status === 'answered' && daysLeft !== null && daysLeft > 0 && (
                <span className="text-muted-foreground">· Visible for {daysLeft} more day{daysLeft !== 1 ? 's' : ''}</span>
              )}
            </p>
          </div>
          {canMarkAnswered && (
            <Button
              size="sm"
              className="text-xs gap-1 h-7 bg-emerald-500 hover:bg-emerald-600 flex-shrink-0"
              onClick={e => { e.stopPropagation(); onMarkAnswered(req); }}
            >
              <CheckCircle2 className="w-3 h-3" /> Answered
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PrayerRequests() {
  const { user, isChurchAdmin } = useAppUser();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('board');
  const [submitOpen, setSubmitOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['prayer-requests', user?.church_id],
    queryFn: () => user?.church_id
      ? base44.entities.PrayerRequest.filter({ church_id: user.church_id }, '-created_date', 300)
      : base44.entities.PrayerRequest.list('-created_date', 300),
    enabled: !!user,
  });

  const submitMutation = useMutation({
    mutationFn: (data) => base44.entities.PrayerRequest.create({
      ...data,
      church_id: user.church_id,
      status: 'active',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prayer-requests'] });
      setSubmitOpen(false);
      setForm(emptyForm);
      toast.success('Prayer request submitted 🙏');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PrayerRequest.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['prayer-requests'] }),
  });

  const markAnswered = (req) => {
    updateMutation.mutate({
      id: req.id,
      data: {
        status: 'answered',
        answered_at: new Date().toISOString(),
        answered_by: user?.full_name || user?.email,
      },
    });
    setSelected(prev => prev?.id === req.id ? { ...prev, status: 'answered' } : prev);
    toast.success('Praise God! Marked as answered 🙌');
  };

  // Visibility rules:
  // - Private: only visible to poster (by email or created_by) and church admins
  // - Active public: visible to all on the Community Board
  // - Answered: visible on Answered board for 30 days, then only in archive (poster + admin)
  const isOwner = (req) =>
    req.created_by === user?.email || req.email === user?.email;

  const canSeePrivate = (req) =>
    !req.is_private || isChurchAdmin || isOwner(req);

  // Community board: active, non-private
  const boardRequests = requests.filter(r =>
    r.status === 'active' && !r.is_private
  );

  // Answered tab: answered, non-private, within 30 days
  const answeredRecentPublic = requests.filter(r =>
    r.status === 'answered' && !r.is_private && isAnsweredRecent(r)
  );

  // Archive: answered past 30 days (poster + admin) OR private answered (poster + admin)
  const archiveRequests = requests.filter(r =>
    r.status === 'answered' &&
    (isOwner(r) || isChurchAdmin) &&
    (!isAnsweredRecent(r) || r.is_private)
  );

  // My requests: everything the current user posted
  const myRequests = requests.filter(r => isOwner(r));

  // Private tab (admin only): all private requests
  const privateRequests = requests.filter(r => r.is_private);

  const openCard = (req) => {
    if (canSeePrivate(req)) setSelected(req);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
            <Heart className="w-6 h-6 text-rose-500" />
            Prayer Requests
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {boardRequests.length} active · {answeredRecentPublic.length} recently answered
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isChurchAdmin && user?.church_id && (
            <Button variant="outline" size="sm" className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/pray?church=${user.church_id}`);
                toast.success('Prayer page link copied!');
              }}>
              <Share2 className="w-3.5 h-3.5" /> Share Prayer Page
            </Button>
          )}
          <Button className="gap-2 bg-rose-500 hover:bg-rose-600" onClick={() => setSubmitOpen(true)}>
            <Plus className="w-4 h-4" /> Submit Prayer Request
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="board">Community Board</TabsTrigger>
          <TabsTrigger value="answered">
            <Sparkles className="w-3 h-3 mr-1 text-emerald-500" />
            Answered ({answeredRecentPublic.length})
          </TabsTrigger>
          <TabsTrigger value="mine">My Requests</TabsTrigger>
          {(isChurchAdmin || archiveRequests.length > 0) && (
            <TabsTrigger value="archive">
              <FolderOpen className="w-3 h-3 mr-1" />
              Archive
            </TabsTrigger>
          )}
          {isChurchAdmin && (
            <TabsTrigger value="private">
              <Lock className="w-3 h-3 mr-1" />
              Private ({privateRequests.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* COMMUNITY BOARD */}
        <TabsContent value="board" className="mt-4">
          <div className="space-y-3">
            {isLoading ? (
              [1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)
            ) : boardRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No active prayer requests.</p>
                <Button className="mt-4 bg-rose-500 hover:bg-rose-600" onClick={() => setSubmitOpen(true)}>
                  Be the first to share
                </Button>
              </div>
            ) : boardRequests.map(req => (
              <PrayerCard key={req.id} req={req} currentUser={user} isChurchAdmin={isChurchAdmin}
                onMarkAnswered={markAnswered} onOpen={openCard} />
            ))}
          </div>
        </TabsContent>

        {/* ANSWERED */}
        <TabsContent value="answered" className="mt-4">
          <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm text-emerald-700">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            Answered prayers stay visible here for 30 days, then move to the Archive folder.
          </div>
          <div className="space-y-3">
            {answeredRecentPublic.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>No recently answered prayers yet.</p>
              </div>
            ) : answeredRecentPublic.map(req => (
              <PrayerCard key={req.id} req={req} currentUser={user} isChurchAdmin={isChurchAdmin}
                onMarkAnswered={markAnswered} onOpen={openCard} />
            ))}
          </div>
        </TabsContent>

        {/* MY REQUESTS */}
        <TabsContent value="mine" className="mt-4">
          <div className="space-y-3">
            {myRequests.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Heart className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p>You haven't submitted any requests yet.</p>
                <Button className="mt-4 bg-rose-500 hover:bg-rose-600" onClick={() => setSubmitOpen(true)}>
                  Submit a Request
                </Button>
              </div>
            ) : myRequests.map(req => (
              <PrayerCard key={req.id} req={req} currentUser={user} isChurchAdmin={isChurchAdmin}
                onMarkAnswered={markAnswered} onOpen={openCard} />
            ))}
          </div>
        </TabsContent>

        {/* ARCHIVE */}
        <TabsContent value="archive" className="mt-4">
          <div className="mb-3 p-3 rounded-lg bg-muted/50 border flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="w-4 h-4 flex-shrink-0" />
            Answered prayers older than 30 days, plus private answered prayers. Visible only to you and church admins.
          </div>
          <div className="space-y-3">
            {archiveRequests.length === 0 ? (
              <p className="text-center py-10 text-muted-foreground">No archived requests.</p>
            ) : archiveRequests.map(req => (
              <PrayerCard key={req.id} req={req} currentUser={user} isChurchAdmin={isChurchAdmin}
                onMarkAnswered={markAnswered} onOpen={openCard} />
            ))}
          </div>
        </TabsContent>

        {/* PRIVATE (admin only) */}
        {isChurchAdmin && (
          <TabsContent value="private" className="mt-4">
            <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2 text-sm text-rose-700">
              <Lock className="w-4 h-4 flex-shrink-0" />
              These requests are visible only to church leadership and the person who posted them.
            </div>
            <div className="space-y-3">
              {privateRequests.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">No private requests.</p>
              ) : privateRequests.map(req => (
                <PrayerCard key={req.id} req={req} currentUser={user} isChurchAdmin={isChurchAdmin}
                  onMarkAnswered={markAnswered} onOpen={openCard} />
              ))}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Submit Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Submit a Prayer Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <p className="text-sm font-medium">Anonymous</p>
                <p className="text-xs text-muted-foreground">Hide your name from others</p>
              </div>
              <Switch checked={form.is_anonymous} onCheckedChange={v => setForm({ ...form, is_anonymous: v })} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-rose-50 border border-rose-200">
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-rose-500" /> Private
                </p>
                <p className="text-xs text-muted-foreground">Only you and church leadership can see this</p>
              </div>
              <Switch checked={form.is_private} onCheckedChange={v => setForm({ ...form, is_private: v })} />
            </div>
            {!form.is_anonymous && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
                </div>
                <div>
                  <Label>Email (optional)</Label>
                  <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="your@email.com" />
                </div>
              </div>
            )}
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prayer Request *</Label>
              <Textarea
                value={form.request}
                onChange={e => setForm({ ...form, request: e.target.value })}
                placeholder="Share your prayer need..."
                rows={4}
                className="mt-1 resize-none"
              />
            </div>
            <Button
              className="w-full bg-rose-500 hover:bg-rose-600 gap-2"
              onClick={() => submitMutation.mutate(form)}
              disabled={!form.request.trim() || submitMutation.isPending}
            >
              <Send className="w-4 h-4" />
              {submitMutation.isPending ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={v => !v && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-rose-500" /> Prayer Request
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 mt-1">
              <div className="p-3 rounded-lg bg-muted/50 border space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  {selected.is_anonymous ? <em>Anonymous</em> : <span>{selected.name || 'Member'}</span>}
                  {selected.is_private && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-rose-300 text-rose-600 ml-auto gap-1">
                      <Lock className="w-2.5 h-2.5" /> Private
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(selected.created_date), 'MMMM d, yyyy')}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Prayer Request</p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-3 border">{selected.request}</p>
              </div>

              {selected.status === 'answered' && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <Sparkles className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Answered{selected.answered_by && ` by ${selected.answered_by}`}
                    {selected.answered_at && ` on ${format(new Date(selected.answered_at), 'MMM d, yyyy')}`}
                  </span>
                </div>
              )}

              {isChurchAdmin && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Staff Notes (private)</p>
                  <StaffNotesEditor
                    initialNotes={selected.staff_notes || ''}
                    onSave={(notes) => updateMutation.mutate({ id: selected.id, data: { staff_notes: notes } })}
                  />
                </div>
              )}

              {/* Actions */}
              {selected.status === 'active' && (isOwner(selected) || isChurchAdmin) && (
                <div className="flex gap-2 pt-1 border-t">
                  <Button
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 gap-2"
                    onClick={() => markAnswered(selected)}
                    disabled={updateMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4" /> Mark as Answered
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Small inline component to avoid inline state complexity
function StaffNotesEditor({ initialNotes, onSave }) {
  const [notes, setNotes] = useState(initialNotes);
  return (
    <>
      <Textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Add private notes..."
        rows={3}
        className="text-sm resize-none"
      />
      <Button size="sm" variant="outline" className="mt-2" onClick={() => onSave(notes)}>Save Notes</Button>
    </>
  );
}