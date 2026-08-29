import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Church, MapPin, Phone, Mail, Pause, Play, Clock, Paperclip, Trash2, Link, Copy, Users as UsersIcon, Radio, HandCoins, CreditCard } from 'lucide-react';
import DocumentAttachments from '@/components/DocumentAttachments';
import DeleteChurchDialog from '@/components/churches/DeleteChurchDialog';
import ChurchSignupLinks from '@/components/churches/ChurchSignupLinks';
import GlobalAdminOverrideDialog from '@/components/pricing/GlobalAdminOverrideDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { differenceInDays, format, addDays, parseISO } from 'date-fns';

function getTrialInfo(church) {
  if (church.status !== 'trial' || !church.trial_start_date) return null;
  const start = parseISO(church.trial_start_date);
  const days = church.trial_days || 3;
  const expiry = addDays(start, days);
  const remaining = differenceInDays(expiry, new Date());
  const expired = remaining < 0;
  return { expiry, remaining, expired };
}

export default function Churches() {
  const { isGlobalAdmin } = useAppUser();
  const [open, setOpen] = useState(false);
  const [editChurch, setEditChurch] = useState(null);
  const [docsChurch, setDocsChurch] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedChurch, setSelectedChurch] = useState(null);
  const [overrideChurch, setOverrideChurch] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', phone: '', email: '', pastor_name: '', admin_email: '', subdomain: '', custom_domain: '' });
  const queryClient = useQueryClient();

  const { data: churches = [], isLoading } = useQuery({
    queryKey: ['churches'],
    queryFn: () => base44.entities.Church.list('-created_date', 100),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const church = await base44.entities.Church.create(data);
      if (data.admin_email) {
        base44.functions.invoke('syncPastoralStaff', {
          churchId: church.id,
          adminEmail: data.admin_email,
          adminName: data.pastor_name || data.admin_email,
        }).catch(() => {});
      }
      return church;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      setOpen(false);
      setForm({ name: '', address: '', city: '', state: '', phone: '', email: '', pastor_name: '', admin_email: '', subdomain: '', custom_domain: '' });
      toast.success('Church created successfully');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => base44.entities.Church.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      toast.success('Church updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Church.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      toast.success('Church deleted');
    },
  });

  const handleDocsUpdate = (newDocs) => {
    updateMutation.mutate({ id: docsChurch.id, documents: newDocs });
    setDocsChurch(prev => ({ ...prev, documents: newDocs }));
  };

  const handleEditSave = async () => {
  updateMutation.mutate({
    id: editChurch.id,
    name: editChurch.name,
    subdomain: editChurch.subdomain || '',
    address: editChurch.address,
    city: editChurch.city,
    state: editChurch.state,
    phone: editChurch.phone,
    email: editChurch.email,
    pastor_name: editChurch.pastor_name,
    admin_email: editChurch.admin_email,
    custom_domain: editChurch.custom_domain || '',
    online_giving_platform: editChurch.online_giving_platform || null,
    online_giving_url: editChurch.online_giving_url || '',
  });
    // Sync admin to Pastoral Staff group
    if (editChurch.admin_email) {
      base44.functions.invoke('syncPastoralStaff', {
        churchId: editChurch.id,
        adminEmail: editChurch.admin_email,
        adminName: editChurch.pastor_name || editChurch.admin_email,
      }).catch(() => {});
    }
    setEditChurch(null);
  };

  const handleTrialToggle = (church, enabled) => {
    if (enabled) {
      updateMutation.mutate({
        id: church.id,
        status: 'trial',
        trial_start_date: format(new Date(), 'yyyy-MM-dd'),
        trial_days: 30,
      });
      toast.success(`Trial mode enabled for ${church.name} — expires in 30 days`);
    } else {
      updateMutation.mutate({ id: church.id, status: 'active', trial_start_date: null });
      toast.success(`${church.name} moved to active`);
    }
  };

  if (!isGlobalAdmin) {
    return <div className="text-center py-12 text-muted-foreground">Access restricted to Global Admins</div>;
  }

  const statusColors = {
    active: 'bg-green-100 text-green-700 border-green-200',
    trial: 'bg-blue-100 text-blue-700 border-blue-200',
    paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    suspended: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold">Churches</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all registered churches</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Add Church</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add New Church</DialogTitle><DialogDescription className="sr-only">Enter information to create a new church.</DialogDescription></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Church Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Enter church name" /></div>
              <div><Label>Pastor Name</Label><Input value={form.pastor_name} onChange={e => setForm({ ...form, pastor_name: e.target.value })} placeholder="Pastor name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
 <div><Label>Church Admin Email</Label><Input value={form.admin_email} onChange={e => setForm({...form, admin_email: e.target.value })} placeholder="admin@example.com" /></div>
 <div>
 <Label>Custom Subdomain (DNS)</Label>
 <div className="flex items-center mt-1">
 <Input
 value={form.subdomain}
 onChange={e => setForm({...form, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
 placeholder="livinghope"
 />
 <span className="text-xs text-muted-foreground bg-muted border border-l-0 rounded-r-md px-2 h-9 flex items-center whitespace-nowrap">.shepherdsyncs.com</span>
 </div>
 <p className="text-xs text-muted-foreground mt-1">Set your DNS CNAME record from this subdomain to the app.</p>
 </div>
 <div>
 <Label>Custom Domain (optional)</Label>
 <Input
 value={form.custom_domain}
 onChange={e => setForm({...form, custom_domain: e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '') })}
 placeholder="giving.yourchurch.com"
 />
 <p className="text-xs text-muted-foreground mt-1">Your own domain replaces the subdomain. Both URLs will work.</p>
</div>
<Button className="w-full" onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending}>
{createMutation.isPending? "Creating...": "Create Church"}
</Button>
</div>
</DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="churches" className="space-y-4">
        <TabsList>
          <TabsTrigger value="churches">Churches</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="churches">
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Card key={i} className="h-56 animate-pulse bg-muted" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {churches.map(church => {
            const trialInfo = getTrialInfo(church);
            const isTrial = church.status === 'trial';

            return (
              <Card key={church.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Church className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{church.name}</h3>
                        {church.pastor_name && <p className="text-xs text-muted-foreground">Pastor {church.pastor_name}</p>}
                      </div>
                    </div>
                    <Badge variant="outline" className={statusColors[church.status || 'active']}>
                      {church.status || 'active'}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {church.city && <p className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{church.city}, {church.state}</p>}
                    {church.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{church.phone}</p>}
                    {church.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{church.email}</p>}
                  </div>

                  {/* Subdomain link */}
                  {church.subdomain && (
                    <div className="mt-2 flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20">
                      <Link className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-xs text-primary font-medium truncate flex-1">{church.subdomain}.shepherdsyncs.com</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(`https://${church.subdomain}.shepherdsyncs.com`); toast.success('Subdomain URL copied!'); }}
                        className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors"
                        title="Copy subdomain URL"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Trial info */}
                  {isTrial && trialInfo && (
                    <div className={`mt-3 px-3 py-2 rounded-md text-xs flex items-center gap-2 ${trialInfo.expired ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      {trialInfo.expired
                        ? `Trial expired on ${format(trialInfo.expiry, 'MMM d, yyyy')}`
                        : `Trial expires in ${trialInfo.remaining + 1} day${trialInfo.remaining + 1 !== 1 ? 's' : ''} (${format(trialInfo.expiry, 'MMM d')})`}
                    </div>
                  )}

                  {/* Trial switch */}
                  <div className="mt-3 flex items-center justify-between border-t pt-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Trial Mode</span>
                    </div>
                    <Switch
                      checked={isTrial}
                      onCheckedChange={(val) => handleTrialToggle(church, val)}
                      disabled={updateMutation.isPending}
                    />
                  </div>

                  {/* Subscription tier */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Plan</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {(church.subscription_tier || 'free').replace(/_/g, ' ')}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={() => setOverrideChurch(church)}
                      >
                        Override
                      </Button>
                    </div>
                  </div>

                  {/* Live Stream toggle */}
                   <div className="flex items-center justify-between pt-2">
                     <div className="flex items-center gap-2">
                       <Radio className="w-3.5 h-3.5 text-muted-foreground" />
                       <span className="text-xs text-muted-foreground">Live Stream</span>
                     </div>
                     <Switch
                       checked={!!church.livestream_enabled}
                       onCheckedChange={(val) => updateMutation.mutate({ id: church.id, livestream_enabled: val })}
                       disabled={updateMutation.isPending}
                     />
                   </div>

                  {/* Online Giving Platform badge */}
                  {church.online_giving_url && (
                    <div className="flex items-center gap-2 pt-1">
                      <HandCoins className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs text-primary font-medium">
                        {church.online_giving_platform
                          ? { planning_center: 'Planning Center', elvanto: 'Elvanto', elexio: 'Elexio', churchcenter: 'Church Center', pushpay: 'PushPay', tithely: 'Tithe.ly', paypal: 'PayPal', venmo: 'Venmo', cash_app: 'Cash App', custom: 'Custom' }[church.online_giving_platform]
                          : 'External Giving'} configured
                      </span>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedChurch(church)}
                    className="w-full mt-3 text-xs font-medium text-primary hover:underline text-left"
                  >
                    View Signup Links →
                  </button>

                  {/* Activate/Pause */}
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setEditChurch({ ...church })}>
                      Edit Info
                    </Button>
                    {(church.status === 'active') ? (
                      <Button size="sm" variant="outline" className="text-yellow-600 text-xs" onClick={() => updateMutation.mutate({ id: church.id, status: 'paused' })}>
                        <Pause className="w-3.5 h-3.5 mr-1" /> Pause
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-green-600 text-xs" onClick={() => updateMutation.mutate({ id: church.id, status: 'active', trial_start_date: null })}>
                        <Play className="w-3.5 h-3.5 mr-1" /> Activate
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => setDocsChurch(church)}>
                      <Paperclip className="w-3.5 h-3.5" />
                      Docs {(church.documents?.length || 0) > 0 && <span className="text-primary font-semibold">({church.documents.length})</span>}
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs gap-1 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(church)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-4 text-left font-semibold">Email</th>
                      <th className="p-4 text-left font-semibold">Full Name</th>
                      <th className="p-4 text-left font-semibold">Role</th>
                      <th className="p-4 text-left font-semibold">Church(es)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const assignedChurches = churches.filter(c => c.admin_email === user.email);
                      return (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="p-4 font-medium">{user.email}</td>
                          <td className="p-4">{user.full_name || '—'}</td>
                          <td className="p-4">
                            <Badge className={user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                              {user.role === 'admin' ? 'Global Admin' : 'User'}
                            </Badge>
                          </td>
                          <td className="p-4">
                            {assignedChurches.length > 0 ? (
                              <div className="space-y-1">
                                {assignedChurches.map(c => (
                                  <Badge key={c.id} variant="outline" className="mr-2 text-xs">
                                    {c.name}
                                  </Badge>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {users.length === 0 && (
                <div className="p-6 text-center text-muted-foreground">
                  <UsersIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No users found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Church Dialog */}
      {deleteTarget && (
        <DeleteChurchDialog
          church={deleteTarget}
          onConfirm={(c) => deleteMutation.mutate(c.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Edit Church Dialog */}
      <Dialog open={!!editChurch} onOpenChange={v => !v && setEditChurch(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Church</DialogTitle><DialogDescription className="sr-only">Edit the church's information and settings.</DialogDescription></DialogHeader>
          {editChurch && (
            <div className="space-y-4 mt-4">
              <div><Label>Church Name *</Label><Input value={editChurch.name} onChange={e => setEditChurch({ ...editChurch, name: e.target.value })} /></div>
              <div><Label>Pastor Name</Label><Input value={editChurch.pastor_name} onChange={e => setEditChurch({ ...editChurch, pastor_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>City</Label><Input value={editChurch.city} onChange={e => setEditChurch({ ...editChurch, city: e.target.value })} /></div>
                <div><Label>State</Label><Input value={editChurch.state} onChange={e => setEditChurch({ ...editChurch, state: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={editChurch.address} onChange={e => setEditChurch({ ...editChurch, address: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={editChurch.phone} onChange={e => setEditChurch({ ...editChurch, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={editChurch.email} onChange={e => setEditChurch({ ...editChurch, email: e.target.value })} /></div>
              <div><Label>Church Admin Email</Label><Input value={editChurch.admin_email || ''} onChange={e => setEditChurch({ ...editChurch, admin_email: e.target.value })} placeholder="admin@example.com" /></div>
              <div>
                <Label>Custom Subdomain (DNS)</Label>
                <div className="flex items-center mt-1">
                  <Input
                    value={editChurch.subdomain || ''}
                    onChange={e => setEditChurch({ ...editChurch, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="livinghope"
                  />
                  <span className="text-xs text-muted-foreground bg-muted border border-l-0 rounded-r-md px-2 h-9 flex items-center whitespace-nowrap">.shepherdsyncs.com</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Set your DNS CNAME record from this subdomain to the app.</p>
</div>
<div>
<Label>Custom Domain (optional)</Label>
<Input
value={editChurch.custom_domain || ''}
onChange={e => setEditChurch({...editChurch, custom_domain: e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, '') })}
placeholder="giving.yourchurch.com"
/>
<p className="text-xs text-muted-foreground mt-1">Your own domain. Both custom domain and subdomain will work.</p>
</div>

              {/* Online Giving Platform */}
              <div className="border-t pt-3 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2"><HandCoins className="w-4 h-4 text-primary" /> Online Giving Platform</p>
                <div>
                  <Label>Platform</Label>
                  <Select
                    value={editChurch.online_giving_platform || '__none__'}
                    onValueChange={v => setEditChurch({ ...editChurch, online_giving_platform: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="None selected" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      <SelectItem value="planning_center">Planning Center</SelectItem>
                      <SelectItem value="elvanto">Elvanto</SelectItem>
                      <SelectItem value="elexio">Elexio</SelectItem>
                      <SelectItem value="churchcenter">Church Center</SelectItem>
                      <SelectItem value="pushpay">PushPay</SelectItem>
                      <SelectItem value="tithely">Tithe.ly</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="venmo">Venmo</SelectItem>
                      <SelectItem value="cash_app">Cash App</SelectItem>
                      <SelectItem value="custom">Other / Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Giving URL</Label>
                  <Input
                    value={editChurch.online_giving_url || ''}
                    onChange={e => setEditChurch({ ...editChurch, online_giving_url: e.target.value })}
                    placeholder="https://give.planningcenteronline.com/..."
                    type="url"
                  />
                  <p className="text-xs text-muted-foreground mt-1">This button will appear on your public giving page.</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" onClick={handleEditSave} disabled={!editChurch.name || updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button className="flex-1" variant="outline" onClick={() => setEditChurch(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Church Documents Dialog */}
      <Dialog open={!!docsChurch} onOpenChange={v => !v && setDocsChurch(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{docsChurch?.name} — Documents</DialogTitle>
            <DialogDescription className="sr-only">
              View and manage documents for {docsChurch?.name}.
            </DialogDescription>
          </DialogHeader>
          {docsChurch && (
            <DocumentAttachments
              documents={docsChurch.documents || []}
              onUpdate={handleDocsUpdate}
              canEdit={true}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Global Admin Override Dialog */}
      {overrideChurch && (
        <GlobalAdminOverrideDialog
          church={overrideChurch}
          open={!!overrideChurch}
          onOpenChange={(v) => !v && setOverrideChurch(null)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['churches'] })}
        />
      )}

      {/* Church Signup Links Dialog */}
      <Dialog open={!!selectedChurch} onOpenChange={v => !v && setSelectedChurch(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedChurch?.name}</DialogTitle>
            <DialogDescription className="sr-only">
              Copy the member signup link and review pending signups for {selectedChurch?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedChurch && <ChurchSignupLinks church={selectedChurch} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
