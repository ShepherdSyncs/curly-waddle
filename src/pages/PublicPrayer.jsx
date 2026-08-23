import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Cross, Heart, CheckCircle2, Loader2 } from 'lucide-react';

const CATEGORIES = [
  { value: 'healing', label: '🙏 Healing' },
  { value: 'family', label: '👨‍👩‍👧 Family' },
  { value: 'finances', label: '💼 Finances' },
  { value: 'relationships', label: '❤️ Relationships' },
  { value: 'salvation', label: '✝️ Salvation' },
  { value: 'guidance', label: '🌟 Guidance' },
  { value: 'grief', label: '🕊️ Grief & Loss' },
  { value: 'thanksgiving', label: '🙌 Thanksgiving' },
  { value: 'other', label: '📝 Other' },
];

function getChurchId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('church');
}

export default function PublicPrayer() {
  const churchId = getChurchId();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    request: '',
    category: 'other',
    is_anonymous: false,
    is_private: false,
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['church-name', churchId],
    queryFn: () => churchId ? base44.entities.Church.filter({ id: churchId }) : [],
    enabled: !!churchId,
  });
  const church = churches[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.request.trim()) return;
    if (!churchId) return;
    setSubmitting(true);
    await base44.entities.PrayerRequest.create({
      church_id: churchId,
      name: form.is_anonymous ? '' : form.name,
      email: form.is_anonymous ? '' : form.email,
      request: form.request,
      category: form.category,
      is_anonymous: form.is_anonymous,
      is_private: form.is_private,
      status: 'new',
    });
    setSubmitting(false);
    setSubmitted(true);
  };

  if (!churchId) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center">
          <Cross className="w-12 h-12 mx-auto mb-4 text-white/30" />
          <p className="text-white/50">No church specified. Please use the link provided by your church.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-primary/10 to-slate-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-white/10 px-4 py-4">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
            <Cross className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-serif font-bold text-white text-lg leading-none">
              {church?.name || 'Shepherd'}
            </h1>
            <p className="text-xs text-white/50">Prayer Requests</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          {submitted ? (
            <div className="text-center text-white space-y-5">
              <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <div>
                <h2 className="text-2xl font-serif font-bold">We're Praying for You</h2>
                <p className="text-white/60 mt-2">Your prayer request has been received. Our team will be lifting you up in prayer.</p>
              </div>
              <Button
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => { setSubmitted(false); setForm({ name: '', email: '', request: '', category: 'other', is_anonymous: false, is_private: false }); }}
              >
                Submit Another Request
              </Button>
            </div>
          ) : (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 space-y-6">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-3">
                  <Heart className="w-6 h-6 text-secondary" />
                </div>
                <h2 className="text-xl font-serif font-bold text-white">Share Your Prayer Request</h2>
                <p className="text-sm text-white/50 mt-1">Your request will be seen by our pastoral team. All submissions are treated with care and confidentiality.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Anonymous toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-medium text-white">Submit Anonymously</p>
                    <p className="text-xs text-white/40">Your name won't be shown to staff</p>
                  </div>
                  <Switch
                    checked={form.is_anonymous}
                    onCheckedChange={(v) => setForm({ ...form, is_anonymous: v })}
                  />
                </div>

                {/* Name & Email — hidden if anonymous */}
                {!form.is_anonymous && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-white/70 text-xs">Your Name</Label>
                      <Input
                        value={form.name}
                        onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="John Smith"
                        className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-secondary"
                      />
                    </div>
                    <div>
                      <Label className="text-white/70 text-xs">Email (optional)</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => setForm({ ...form, email: e.target.value })}
                        placeholder="you@email.com"
                        className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-secondary"
                      />
                    </div>
                  </div>
                )}

                {/* Category */}
                <div>
                  <Label className="text-white/70 text-xs">Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger className="mt-1 bg-white/10 border-white/20 text-white focus:ring-secondary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prayer Request */}
                <div>
                  <Label className="text-white/70 text-xs">Your Prayer Request *</Label>
                  <Textarea
                    value={form.request}
                    onChange={e => setForm({ ...form, request: e.target.value })}
                    placeholder="Share what's on your heart..."
                    rows={5}
                    className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus-visible:ring-secondary resize-none"
                    required
                  />
                </div>

                {/* Private toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                  <div>
                    <p className="text-sm font-medium text-white">Keep Private</p>
                    <p className="text-xs text-white/40">Only visible to pastor/admin, not general staff</p>
                  </div>
                  <Switch
                    checked={form.is_private}
                    onCheckedChange={(v) => setForm({ ...form, is_private: v })}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitting || !form.request.trim()}
                  className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-semibold h-11"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Heart className="w-4 h-4 mr-2" />}
                  {submitting ? 'Submitting...' : 'Submit Prayer Request'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}