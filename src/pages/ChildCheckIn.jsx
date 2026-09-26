import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Printer, CheckCircle2, ChevronLeft, Baby, LogOut, Loader2, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const CLASSROOMS = ['Nursery (0-2)', 'Preschool (3-4)', 'K-2', '3-5', '6-8', '9-12'];

function generatePickupCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function BadgePrint({ checkin }) {
  if (!checkin) return null;
  return (
    <div id="child-checkin-print">
      <style>{`
        @media print {
          body > *:not(#child-checkin-print) { display: none !important; }
          #child-checkin-print { display: flex !important; }
          @page { size: 4in 2in; margin: 0; }
        }
        #child-checkin-print { display: none; }
      `}</style>
      <div style={{ display: 'flex', gap: 8 }}>
        {/* Child badge */}
        <div style={{ width: '4in', height: '2in', border: '3px solid #1F7A8C', borderRadius: 8, padding: '12px 16px', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#fff', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 10, color: '#1F7A8C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>ShepherdSyncs · Child Check-In</div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#071920', lineHeight: 1.1 }}>{checkin.child_name}</div>
            <div style={{ fontSize: 13, color: '#1F7A8C', marginTop: 4, fontWeight: 600 }}>{checkin.classroom}</div>
            {checkin.allergies && <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 4, fontWeight: 700 }}>⚠ Allergy: {checkin.allergies}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div style={{ fontSize: 10, color: '#888' }}>{new Date().toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1F7A8C', letterSpacing: 2 }}>{checkin.pickup_code}</div>
          </div>
        </div>
        {/* Guardian claim ticket */}
        <div style={{ width: '4in', height: '2in', border: '3px dashed #1F7A8C', borderRadius: 8, padding: '12px 16px', fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: '#fff', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 10, color: '#1F7A8C', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Pickup Claim Ticket</div>
          <div>
            <div style={{ fontSize: 16, color: '#071920', fontWeight: 700 }}>{checkin.child_name}</div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{checkin.classroom}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>Show this code at pickup — it must match the child's badge.</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#1F7A8C', letterSpacing: 4 }}>{checkin.pickup_code}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChildCheckIn() {
  const { user } = useAppUser();
  const queryClient = useQueryClient();
  const churchId = user?.church_id;
  const staffName = user?.full_name || user?.email || 'Staff';
  const today = format(new Date(), 'yyyy-MM-dd');

  const [tab, setTab] = useState('checkin');
  const [step, setStep] = useState('search'); // search | form | confirmed
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [form, setForm] = useState({ child_name: '', classroom: CLASSROOMS[0], guardian_name: '', guardian_phone: '', allergies: '', notes: '' });
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [lastCheckin, setLastCheckin] = useState(null);

  const [codeInputs, setCodeInputs] = useState({}); // { checkinId: code }
  const [checkingOutId, setCheckingOutId] = useState(null);

  const { data: members = [] } = useQuery({
    queryKey: ['child-checkin-members', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }),
    enabled: !!churchId,
  });

  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ['child-checkin-roster', churchId, today],
    queryFn: () => base44.entities.ChildCheckin.filter({ church_id: churchId, service_date: today }, '-checked_in_at', 200),
    enabled: !!churchId,
  });

  const filteredMembers = search.length >= 2
    ? members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const checkedInNow = useMemo(() => roster.filter(r => r.status === 'checked_in'), [roster]);
  const checkedOutToday = useMemo(() => roster.filter(r => r.status === 'checked_out'), [roster]);

  const byClassroom = useMemo(() => {
    const map = {};
    checkedInNow.forEach(r => { (map[r.classroom] = map[r.classroom] || []).push(r); });
    return map;
  }, [checkedInNow]);

  const selectMember = (member) => {
    setSelectedMember(member);
    setForm(f => ({ ...f, child_name: `${member.first_name} ${member.last_name}` }));
    setSearch('');
    setStep('form');
  };

  const startWalkIn = () => {
    setSelectedMember(null);
    setForm({ child_name: search || '', classroom: CLASSROOMS[0], guardian_name: '', guardian_phone: '', allergies: '', notes: '' });
    setSearch('');
    setStep('form');
  };

  const resetFlow = () => {
    setStep('search');
    setSearch('');
    setSelectedMember(null);
    setForm({ child_name: '', classroom: CLASSROOMS[0], guardian_name: '', guardian_phone: '', allergies: '', notes: '' });
    setLastCheckin(null);
  };

  const handleCheckIn = async () => {
    if (!form.child_name.trim()) { toast.error("Enter the child's name"); return; }
    if (!form.classroom) { toast.error('Select a classroom'); return; }
    if (!form.guardian_name.trim()) { toast.error("Enter the guardian's name"); return; }
    setSavingCheckin(true);
    try {
      const created = await base44.entities.ChildCheckin.create({
        church_id: churchId,
        child_name: form.child_name.trim(),
        child_member_id: selectedMember?.id || null,
        classroom: form.classroom,
        guardian_name: form.guardian_name.trim(),
        guardian_phone: form.guardian_phone.trim() || null,
        allergies: form.allergies.trim() || null,
        notes: form.notes.trim() || null,
        pickup_code: generatePickupCode(),
        status: 'checked_in',
        service_date: today,
      });
      setLastCheckin(created);
      setStep('confirmed');
      queryClient.invalidateQueries({ queryKey: ['child-checkin-roster', churchId, today] });
      toast.success(`${created.child_name} checked in`);
    } catch (err) {
      toast.error(err.message || 'Failed to check in');
    }
    setSavingCheckin(false);
  };

  const printBadge = () => {
    const el = document.getElementById('child-checkin-print');
    if (el) el.style.display = 'flex';
    window.print();
    if (el) el.style.display = 'none';
  };

  const handleCheckOut = async (checkin) => {
    const enteredCode = (codeInputs[checkin.id] || '').trim();
    if (enteredCode !== checkin.pickup_code) {
      toast.error('That code does not match — check the claim ticket');
      return;
    }
    setCheckingOutId(checkin.id);
    try {
      await base44.entities.ChildCheckin.update(checkin.id, {
        status: 'checked_out',
        checked_out_at: new Date().toISOString(),
        checked_out_by: staffName,
      });
      toast.success(`${checkin.child_name} checked out`);
      queryClient.invalidateQueries({ queryKey: ['child-checkin-roster', churchId, today] });
    } catch (err) {
      toast.error(err.message || 'Failed to check out');
    }
    setCheckingOutId(null);
  };

  return (
    <div className="space-y-6">
      <BadgePrint checkin={lastCheckin} />

      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-2">
          <Baby className="w-7 h-7 text-primary" />
          Child Check-In
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Check children into their classroom with a matching pickup code, and check them out safely.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="checkin">Check In</TabsTrigger>
          <TabsTrigger value="roster">Currently Checked In ({checkedInNow.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
          <Card className="max-w-xl">
            <CardContent className="p-6">
              {step === 'search' && (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-1.5 block">Search for the child</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type first or last name..." className="pl-8" />
                    </div>
                  </div>
                  {search.length >= 2 && (
                    <div className="space-y-1.5">
                      {filteredMembers.map(member => (
                        <button key={member.id} onClick={() => selectMember(member)} className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {member.first_name[0]}{member.last_name[0]}
                          </div>
                          <p className="text-sm font-medium">{member.first_name} {member.last_name}</p>
                        </button>
                      ))}
                      <button onClick={startWalkIn} className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-left text-sm text-muted-foreground">
                        Not listed? Check in "{search}" as a new / guest child
                      </button>
                    </div>
                  )}
                  {search.length < 2 && <p className="text-xs text-muted-foreground">Type at least 2 characters, or leave blank and use the guest option below.</p>}
                  {search.length === 0 && (
                    <Button variant="outline" size="sm" onClick={startWalkIn}>Check in a guest child</Button>
                  )}
                </div>
              )}

              {step === 'form' && (
                <div className="space-y-4">
                  <button onClick={() => setStep('search')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-4 h-4" /> Back
                  </button>
                  <div>
                    <Label className="mb-1.5 block">Child's Name *</Label>
                    <Input value={form.child_name} onChange={(e) => setForm({ ...form, child_name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Classroom *</Label>
                    <div className="flex flex-wrap gap-2">
                      {CLASSROOMS.map(c => (
                        <button key={c} type="button" onClick={() => setForm({ ...form, classroom: c })} className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.classroom === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block">Guardian Name *</Label>
                      <Input value={form.guardian_name} onChange={(e) => setForm({ ...form, guardian_name: e.target.value })} placeholder="Who's dropping off?" />
                    </div>
                    <div>
                      <Label className="mb-1.5 block">Guardian Phone</Label>
                      <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} placeholder="For paging during service" />
                    </div>
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Allergies / Medical Notes</Label>
                    <Input value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} placeholder="e.g. Peanut allergy" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Notes</Label>
                    <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Anything else the classroom volunteer should know" />
                  </div>
                  <Button onClick={handleCheckIn} disabled={savingCheckin} className="w-full h-11 gap-2">
                    {savingCheckin ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {savingCheckin ? 'Checking in...' : 'Check In & Generate Code'}
                  </Button>
                </div>
              )}

              {step === 'confirmed' && lastCheckin && (
                <div className="text-center space-y-5 py-4">
                  <div className="flex justify-center">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-400 flex items-center justify-center">
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{lastCheckin.child_name}</p>
                    <p className="text-muted-foreground mt-1">Checked into <span className="font-medium text-foreground">{lastCheckin.classroom}</span></p>
                  </div>
                  <div className="py-4 px-6 rounded-xl bg-primary/5 border border-primary/20 inline-block mx-auto">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Pickup Code</p>
                    <p className="text-4xl font-black text-primary tracking-widest">{lastCheckin.pickup_code}</p>
                  </div>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">Print both the classroom badge and the guardian's matching claim ticket. Pickup requires the guardian to show this code.</p>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" onClick={printBadge} className="gap-2"><Printer className="w-4 h-4" /> Print Badge & Ticket</Button>
                    <Button onClick={resetFlow}>Check In Next Child</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roster">
          <div className="space-y-4">
            {rosterLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : checkedInNow.length === 0 ? (
              <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">No children currently checked in today.</CardContent></Card>
            ) : (
              Object.entries(byClassroom).map(([classroom, kids]) => (
                <Card key={classroom}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {classroom} <Badge variant="secondary">{kids.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {kids.map(kid => (
                      <div key={kid.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                        <div className="min-w-0">
                          <p className="font-medium text-sm flex items-center gap-2">
                            {kid.child_name}
                            {kid.allergies && (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                                <AlertTriangle className="w-3 h-3" /> {kid.allergies}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Guardian: {kid.guardian_name}{kid.guardian_phone ? ` · ${kid.guardian_phone}` : ''} · Checked in {format(new Date(kid.checked_in_at), 'h:mm a')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Input
                            value={codeInputs[kid.id] || ''}
                            onChange={(e) => setCodeInputs(prev => ({ ...prev, [kid.id]: e.target.value }))}
                            placeholder="Code"
                            className="w-20 text-center font-mono"
                            maxLength={4}
                          />
                          <Button size="sm" variant="outline" onClick={() => handleCheckOut(kid)} disabled={checkingOutId === kid.id} className="gap-1.5">
                            {checkingOutId === kid.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                            Check Out
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))
            )}

            {checkedOutToday.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <X className="w-4 h-4" /> Checked Out Today ({checkedOutToday.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {checkedOutToday.map(kid => (
                    <div key={kid.id} className="flex items-center justify-between text-xs text-muted-foreground py-1.5 border-b last:border-0">
                      <span>{kid.child_name} · {kid.classroom}</span>
                      <span>Picked up {format(new Date(kid.checked_out_at), 'h:mm a')} by {kid.checked_out_by}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
