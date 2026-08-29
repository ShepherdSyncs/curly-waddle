import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, HandCoins, ExternalLink, Edit2, Trash2, DollarSign, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import RecordGivingDialog from '@/components/giving/RecordGivingDialog';
import MemberGivingHistory from '@/components/giving/MemberGivingHistory';

const GIVING_TYPES = ['tithe', 'offering', 'missions', 'building_fund', 'benevolence', 'other'];
const PAYMENT_METHODS_ENUM = ['cash', 'check', 'online', 'other'];

const PROVIDERS = [
  { value: 'stripe', label: 'Stripe', icon: '💳' },
  { value: 'paypal', label: 'PayPal', icon: '🅿️' },
  { value: 'cashapp', label: 'Cash App', icon: '💚' },
  { value: 'zelle', label: 'Zelle', icon: '💜' },
  { value: 'venmo', label: 'Venmo', icon: '💙' },
  { value: 'givelify', label: 'Givelify', icon: '🙏' },
  { value: 'pushpay', label: 'PushPay', icon: '📱' },
  { value: 'custom', label: 'Custom', icon: '🔗' },
];

const TYPE_COLORS = {
  tithe: 'bg-blue-500/15 text-blue-400',
  offering: 'bg-green-500/15 text-green-400',
  missions: 'bg-purple-500/15 text-purple-400',
  building_fund: 'bg-orange-500/15 text-orange-400',
  benevolence: 'bg-pink-500/15 text-pink-400',
  other: 'bg-muted text-muted-foreground',
};

const emptyMethodForm = { provider: 'cashapp', label: '', instructions: '', link_url: '', handle: '', qr_image_url: '', sort_order: 0 };

export default function Giving() {
  const { user, loading, isStaff, isChurchAdmin, isGlobalAdmin, hasPermission } = useAppUser();
  const churchId = user?.church_id;

if (loading ||!user) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div></div>;
  const queryClient = useQueryClient();
  const isDeacon = user?.role === 'deacon' || isStaff;

  const [methodFormOpen, setMethodFormOpen] = useState(false);
  const [editMethod, setEditMethod] = useState(null);
  const [methodForm, setMethodForm] = useState(emptyMethodForm);
  const [givingOpen, setGivingOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const canManage = isChurchAdmin || isGlobalAdmin || isDeacon || hasPermission('view_giving');
  const canRecord = isChurchAdmin || isGlobalAdmin || isDeacon || hasPermission('record_giving');
  const isRegularMember = !canManage && !!churchId;

  // For regular members: find their own ChurchMember record to link giving history
  const { data: myMemberRecord } = useQuery({
    queryKey: ['my-member-record', churchId, user?.email],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, email: user?.email }),
    enabled: isRegularMember && !!user?.email,
    select: (data) => data[0] || null,
  });

  const { data: myGivingRecords = [] } = useQuery({
    queryKey: ['my-giving', churchId, myMemberRecord?.id],
    queryFn: () => base44.entities.GivingRecord.filter({ church_id: churchId, member_id: myMemberRecord.id }, '-date', 200),
    enabled: isRegularMember && !!myMemberRecord?.id,
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods', churchId],
    queryFn: () => base44.entities.PaymentMethod.filter({ church_id: churchId, is_active: true }, 'sort_order', 20),
    enabled: !!churchId,
  });

  const { data: givingRecords = [] } = useQuery({
    queryKey: ['giving', churchId],
    queryFn: () => churchId
      ? base44.entities.GivingRecord.filter({ church_id: churchId }, '-date', 500)
      : [],
    enabled: !!user && canManage,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId, status: 'active' }, 'first_name', 200),
    enabled: !!churchId && canManage,
  });

  const saveMethodMutation = useMutation({
    mutationFn: (data) => editMethod
      ? base44.entities.PaymentMethod.update(editMethod.id, data)
      : base44.entities.PaymentMethod.create({ ...data, church_id: churchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      setMethodFormOpen(false);
      setEditMethod(null);
      setMethodForm(emptyMethodForm);
      toast.success(editMethod ? 'Payment method updated' : 'Payment method added');
    },
  });

  const deleteMethodMutation = useMutation({
    mutationFn: (id) => base44.entities.PaymentMethod.update(id, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
      toast.success('Payment method removed');
    },
  });

  const recordGivingMutation = useMutation({
    mutationFn: (data) => editRecord
      ? base44.entities.GivingRecord.update(editRecord.id, data)
      : base44.entities.GivingRecord.create({ ...data, church_id: churchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giving'] });
      setGivingOpen(false);
      setEditRecord(null);
      toast.success(editRecord ? 'Giving record updated' : 'Giving record saved');
    },
  });

  const deleteGivingMutation = useMutation({
    mutationFn: (id) => base44.entities.GivingRecord.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['giving'] });
      toast.success('Giving record deleted');
    },
  });

  const openEditRecord = (record) => {
    setEditRecord(record);
    setGivingOpen(true);
  };

  const openEditMethod = (m) => {
    setEditMethod(m);
    setMethodForm({ provider: m.provider, label: m.label, instructions: m.instructions || '', link_url: m.link_url || '', handle: m.handle || '', qr_image_url: m.qr_image_url || '', sort_order: m.sort_order || 0 });
    setMethodFormOpen(true);
  };

  const totalGiving = givingRecords.reduce((s, g) => s + (g.amount || 0), 0);
  const thisMonthGiving = givingRecords.filter(g => g.date?.startsWith(format(new Date(), 'yyyy-MM'))).reduce((s, g) => s + (g.amount || 0), 0);
  const thisYearGiving = givingRecords.filter(g => g.date?.startsWith(new Date().getFullYear().toString())).reduce((s, g) => s + (g.amount || 0), 0);
  const providerInfo = (val) => PROVIDERS.find(p => p.value === val) || { label: val, icon: '💰' };

  // Member giving summaries
  const memberSummaries = members.map(m => {
    const memberRecords = givingRecords.filter(r => r.member_id === m.id || r.member_name === `${m.first_name} ${m.last_name}`);
    const total = memberRecords.reduce((s, r) => s + (r.amount || 0), 0);
    return { ...m, records: memberRecords, total };
  }).filter(m => m.records.length > 0 || search);

  const filteredSummaries = memberSummaries.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRecords = givingRecords.filter(g => {
    const matchesType = typeFilter === 'all' || g.type === typeFilter;
    const matchesSearch = !search || (g.member_name || '').toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  if (selectedMember) {
    return (
      <>
        <MemberGivingHistory
          memberName={`${selectedMember.first_name} ${selectedMember.last_name}`}
          records={selectedMember.records}
          onBack={() => setSelectedMember(null)}
          onEdit={(isChurchAdmin || isGlobalAdmin) ? openEditRecord : undefined}
          onDelete={(isChurchAdmin || isGlobalAdmin) ? (id) => deleteGivingMutation.mutate(id) : undefined}
        />
        <RecordGivingDialog
          open={givingOpen}
          onOpenChange={(v) => { setGivingOpen(v); if (!v) setEditRecord(null); }}
          onSave={(data) => recordGivingMutation.mutate(data)}
          members={members}
          isSaving={recordGivingMutation.isPending}
          initialData={editRecord}
        />
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Giving</h1>
          <p className="text-sm text-muted-foreground mt-1">Tithes, offerings &amp; donations</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {canRecord && <Button variant="outline" onClick={() => setGivingOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Record Giving
            </Button>}
            {isChurchAdmin && (
              <Button onClick={() => { setEditMethod(null); setMethodForm(emptyMethodForm); setMethodFormOpen(true); }} className="gap-2">
                <Plus className="w-4 h-4" /> Add Payment Method
              </Button>
            )}
          </div>
        )}
      </div>

      <Tabs defaultValue={canManage ? 'overview' : 'give'}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="give">Give Now</TabsTrigger>
          {isRegularMember && <TabsTrigger value="my-giving">My Giving</TabsTrigger>}
          {canManage && <TabsTrigger value="overview">Overview</TabsTrigger>}
          {canManage && <TabsTrigger value="records">All Records</TabsTrigger>}
          {canManage && <TabsTrigger value="members">By Member</TabsTrigger>}
          {isChurchAdmin && <TabsTrigger value="methods">Payment Methods</TabsTrigger>}
        </TabsList>

        {/* GIVE NOW — member view */}
        <TabsContent value="give" className="space-y-4 mt-4">
          {paymentMethods.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Your Church has not setup online giving yet. Please contact your church admin for more ways to give. Thank You for Giving to the Kingdom. ShepherdSyncs Team</CardContent></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {paymentMethods.map(method => {
                const p = providerInfo(method.provider);
                return (
                  <Card key={method.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{p.icon}</span>
                        <div>
                          <p className="font-semibold">{method.label}</p>
                          <p className="text-xs text-muted-foreground">{p.label}</p>
                        </div>
                      </div>
                      {method.handle && <div className="p-2 rounded-lg bg-muted text-sm font-mono text-center">{method.handle}</div>}
                      {method.instructions && <p className="text-sm text-muted-foreground">{method.instructions}</p>}
                      {method.qr_image_url && <img src={method.qr_image_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-lg object-contain" />}
                      {method.link_url && (
                        <Button className="w-full gap-2" onClick={() => window.open(method.link_url, '_blank')}>
                          <ExternalLink className="w-4 h-4" /> Give Now
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MY GIVING — regular member view */}
        {isRegularMember && (
          <TabsContent value="my-giving" className="mt-4">
            {!myMemberRecord ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">
                Your giving history is not available yet. Make sure your email matches your church membership record.
              </CardContent></Card>
            ) : (
              <MemberGivingHistory
                memberName={`${myMemberRecord.first_name} ${myMemberRecord.last_name}`}
                records={myGivingRecords}
                onBack={null}
              />
            )}
          </TabsContent>
        )}

        {/* OVERVIEW — staff */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><HandCoins className="w-5 h-5 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold">${totalGiving.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Total Giving</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-secondary" /></div>
                <div>
                  <p className="text-2xl font-bold">${thisMonthGiving.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">This Month</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center"><DollarSign className="w-5 h-5 text-accent" /></div>
                <div>
                  <p className="text-2xl font-bold">${thisYearGiving.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">This Year</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Type breakdown */}
          {givingRecords.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Giving by Category</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {GIVING_TYPES.map(type => {
                  const amt = givingRecords.filter(r => r.type === type).reduce((s, r) => s + (r.amount || 0), 0);
                  if (!amt) return null;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <Badge className={TYPE_COLORS[type] || TYPE_COLORS.other}>{type.replace(/_/g, ' ')}</Badge>
                      <span className="font-semibold text-sm">${amt.toLocaleString()}</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {paymentMethods.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Active Payment Methods</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {paymentMethods.map(m => {
                  const p = providerInfo(m.provider);
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <span className="text-lg">{p.icon}</span>
                      <div className="flex-1"><p className="text-sm font-medium">{m.label}</p>{m.handle && <p className="text-xs text-muted-foreground">{m.handle}</p>}</div>
                      <Badge variant="secondary" className="text-xs">{p.label}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ALL RECORDS */}
        <TabsContent value="records" className="space-y-3 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search by member name…" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {GIVING_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {filteredRecords.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No giving records found</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Member</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Method</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-right">Amount</th>
                      {(isChurchAdmin || isGlobalAdmin) && <th className="px-4 py-3"></th>}
                      </tr>
                      </thead>
                      <tbody className="divide-y">
                      {filteredRecords.map(g => (
                      <tr key={g.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 text-muted-foreground">{g.date}</td>
                        <td className="px-4 py-3">{g.member_name || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge className={`text-xs ${TYPE_COLORS[g.type] || TYPE_COLORS.other}`}>{g.type?.replace(/_/g, ' ')}</Badge>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">{g.method}</td>
                        <td className="px-4 py-3 text-right font-semibold text-primary">${(g.amount || 0).toLocaleString()}</td>
                        {(isChurchAdmin || isGlobalAdmin) && (
                          <td className="px-4 py-3">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEditRecord(g)}><Edit2 className="w-3.5 h-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteGivingMutation.mutate(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                      ))}
                  </tbody>
                  <tfoot>
                     <tr className="border-t bg-muted/20">
                       <td colSpan={(isChurchAdmin || isGlobalAdmin) ? 5 : 4} className="px-4 py-3 font-semibold">Total</td>
                      <td className="px-4 py-3 text-right font-bold text-primary">
                        ${filteredRecords.reduce((s, r) => s + (r.amount || 0), 0).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* BY MEMBER */}
        <TabsContent value="members" className="space-y-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search members…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {filteredSummaries.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No member giving records found</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredSummaries.map(m => (
                <Card key={m.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMember(m)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {m.first_name?.[0]}{m.last_name?.[0]}
                      </div>
                      <div>
                        <p className="font-medium">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-muted-foreground">{m.records.length} record{m.records.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <span className="font-bold text-primary text-lg">${m.total.toLocaleString()}</span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* PAYMENT METHODS — admin config */}
        <TabsContent value="methods" className="space-y-3 mt-4">
          <p className="text-sm text-muted-foreground">Configure how members can give. Add payment links, handles, or QR codes for any provider.</p>
          {paymentMethods.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No payment methods added yet</CardContent></Card>
          )}
          {paymentMethods.map(method => {
            const p = providerInfo(method.provider);
            return (
              <Card key={method.id}>
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{p.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium">{method.label}</p>
                    <p className="text-xs text-muted-foreground">{p.label}{method.handle ? ` · ${method.handle}` : ''}</p>
                    {method.link_url && <p className="text-xs text-blue-500 truncate">{method.link_url}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEditMethod(method)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteMethodMutation.mutate(method.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Payment Method Dialog */}
      <Dialog open={methodFormOpen} onOpenChange={v => { if (!v) { setMethodFormOpen(false); setEditMethod(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editMethod ? 'Edit Payment Method' : 'Add Payment Method'}</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Provider</Label>
              <Select value={methodForm.provider} onValueChange={v => setMethodForm({ ...methodForm, provider: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.icon} {p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Display Label *</Label><Input value={methodForm.label} onChange={e => setMethodForm({ ...methodForm, label: e.target.value })} placeholder="e.g. Give via Cash App" /></div>
            <div><Label>Handle / Username</Label><Input value={methodForm.handle} onChange={e => setMethodForm({ ...methodForm, handle: e.target.value })} placeholder="$cashtag, @venmo, phone number…" /></div>
            <div><Label>Payment Link URL</Label><Input value={methodForm.link_url} onChange={e => setMethodForm({ ...methodForm, link_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>QR Code Image URL</Label><Input value={methodForm.qr_image_url} onChange={e => setMethodForm({ ...methodForm, qr_image_url: e.target.value })} placeholder="https://..." /></div>
            <div><Label>Instructions for Members</Label><Textarea value={methodForm.instructions} onChange={e => setMethodForm({ ...methodForm, instructions: e.target.value })} rows={2} placeholder="Send payment to $cashtag with your name in the memo…" /></div>
            <Button className="w-full" onClick={() => saveMethodMutation.mutate(methodForm)} disabled={!methodForm.label || saveMethodMutation.isPending}>
              {saveMethodMutation.isPending ? 'Saving…' : editMethod ? 'Update' : 'Add Payment Method'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record / Edit Giving Dialog */}
      <RecordGivingDialog
        open={givingOpen}
        onOpenChange={(v) => { setGivingOpen(v); if (!v) setEditRecord(null); }}
        onSave={(data) => recordGivingMutation.mutate(data)}
        members={members}
        isSaving={recordGivingMutation.isPending}
        initialData={editRecord}
      />
    </div>
  );
}