import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, Plus, Pencil, Trash2, MapPin, Users as UsersIcon, Check, X, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format, isPast } from 'date-fns';
import ResourceFormDialog from '@/components/facility/ResourceFormDialog';
import BookingFormDialog from '@/components/facility/BookingFormDialog';

const TYPE_LABELS = { room: 'Room / Space', equipment: 'Equipment', vehicle: 'Vehicle', other: 'Other' };
const STATUS_STYLES = {
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  denied: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function FacilityBooking() {
  const { user, isChurchAdmin, isGlobalAdmin, isStaff } = useAppUser();
  const churchId = user?.church_id;
  const canManage = isChurchAdmin || isGlobalAdmin || isStaff;
  const queryClient = useQueryClient();

  const [tab, setTab] = useState('bookings');
  const [resourceFilter, setResourceFilter] = useState('all');
  const [showResourceDialog, setShowResourceDialog] = useState(false);
  const [editingResource, setEditingResource] = useState(null);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);

  const { data: resources = [], isLoading: loadingResources } = useQuery({
    queryKey: ['facility-resources', churchId],
    queryFn: () => base44.entities.FacilityResource.filter({ church_id: churchId }, 'name', 500),
    enabled: !!churchId,
  });

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['facility-bookings', churchId],
    queryFn: () => base44.entities.FacilityBooking.filter({ church_id: churchId }, '-start_time', 1000),
    enabled: !!churchId,
  });

  const activeResources = useMemo(() => resources.filter(r => r.is_active !== false), [resources]);

  const resourceById = useMemo(() => {
    const map = {};
    resources.forEach(r => { map[r.id] = r; });
    return map;
  }, [resources]);

  const filteredBookings = useMemo(() => {
    let list = bookings;
    if (resourceFilter !== 'all') list = list.filter(b => b.resource_id === resourceFilter);
    return list;
  }, [bookings, resourceFilter]);

  const upcomingBookings = useMemo(
    () => filteredBookings.filter(b => !isPast(new Date(b.end_time))).sort((a, b) => new Date(a.start_time) - new Date(b.start_time)),
    [filteredBookings]
  );
  const pastBookings = useMemo(
    () => filteredBookings.filter(b => isPast(new Date(b.end_time))).sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 50),
    [filteredBookings]
  );

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.FacilityBooking.update(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-bookings', churchId] });
      queryClient.invalidateQueries({ queryKey: ['facility-bookings-all', churchId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update booking'),
  });

  const deleteBookingMutation = useMutation({
    mutationFn: (id) => base44.entities.FacilityBooking.delete(id),
    onSuccess: () => {
      toast.success('Booking deleted');
      queryClient.invalidateQueries({ queryKey: ['facility-bookings', churchId] });
      queryClient.invalidateQueries({ queryKey: ['facility-bookings-all', churchId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete booking'),
  });

  const deleteResourceMutation = useMutation({
    mutationFn: (id) => base44.entities.FacilityResource.delete(id),
    onSuccess: () => {
      toast.success('Resource deleted');
      queryClient.invalidateQueries({ queryKey: ['facility-resources', churchId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete resource. It may have existing bookings.'),
  });

  const BookingRow = ({ b }) => {
    const resource = resourceById[b.resource_id];
    return (
      <div className="flex items-start justify-between gap-3 p-3 rounded-lg border bg-white">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium truncate">{b.title}</p>
            <Badge variant="outline" className={STATUS_STYLES[b.status] || ''}>{b.status}</Badge>
          </div>
          <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
            <Building2 className="w-3.5 h-3.5" /> {resource?.name || 'Unknown resource'}
          </p>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(b.start_time), 'MMM d, yyyy h:mm a')} – {format(new Date(b.end_time), 'h:mm a')}
          </p>
          {b.purpose && <p className="text-sm text-slate-500 mt-0.5">{b.purpose}</p>}
          {(b.requested_by_name || b.requested_by_email) && (
            <p className="text-xs text-slate-400 mt-0.5">Requested by {b.requested_by_name}{b.requested_by_email ? ` (${b.requested_by_email})` : ''}</p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            {b.status === 'pending' && (
              <>
                <Button size="icon" variant="ghost" className="text-emerald-600 hover:text-emerald-700" title="Approve" onClick={() => statusMutation.mutate({ id: b.id, status: 'approved' })}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-red-600 hover:text-red-700" title="Deny" onClick={() => statusMutation.mutate({ id: b.id, status: 'denied' })}>
                  <X className="w-4 h-4" />
                </Button>
              </>
            )}
            <Button size="icon" variant="ghost" onClick={() => { setEditingBooking(b); setShowBookingDialog(true); }}>
              <Pencil className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => { if (confirm('Delete this booking?')) deleteBookingMutation.mutate(b.id); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-600" /> Facility Booking
          </h1>
          <p className="text-slate-500 text-sm">Reserve rooms, equipment, and vehicles, and manage conflicts.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bookings">Bookings</TabsTrigger>
          <TabsTrigger value="resources">Resources ({resources.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="bookings" className="space-y-4 mt-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <Select value={resourceFilter} onValueChange={setResourceFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="All resources" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All resources</SelectItem>
                {resources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {canManage && (
              <Button onClick={() => { if (activeResources.length === 0) { toast.error('Add a resource first'); return; } setEditingBooking(null); setShowBookingDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> New Booking
              </Button>
            )}
          </div>

          {loadingBookings ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : (
            <>
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Upcoming ({upcomingBookings.length})</h3>
                {upcomingBookings.length === 0 ? (
                  <p className="text-sm text-slate-400">No upcoming bookings.</p>
                ) : (
                  <div className="space-y-2">{upcomingBookings.map(b => <BookingRow key={b.id} b={b} />)}</div>
                )}
              </div>
              {pastBookings.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2 mt-6">Past</h3>
                  <div className="space-y-2 opacity-70">{pastBookings.map(b => <BookingRow key={b.id} b={b} />)}</div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="resources" className="space-y-4 mt-4">
          <div className="flex items-center justify-end">
            {canManage && (
              <Button onClick={() => { setEditingResource(null); setShowResourceDialog(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Resource
              </Button>
            )}
          </div>
          {loadingResources ? (
            <p className="text-slate-400 text-sm">Loading…</p>
          ) : resources.length === 0 ? (
            <p className="text-sm text-slate-400">No resources yet. Add a room, piece of equipment, or vehicle to start booking.</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {resources.map(r => (
                <Card key={r.id} className={r.is_active === false ? 'opacity-60' : ''}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{r.name}</span>
                      <Badge variant="outline">{TYPE_LABELS[r.type] || r.type}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm text-slate-500">
                    {r.location && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {r.location}</p>}
                    {r.capacity && <p className="flex items-center gap-1"><UsersIcon className="w-3.5 h-3.5" /> Capacity {r.capacity}</p>}
                    {r.notes && <p className="text-slate-400">{r.notes}</p>}
                    {r.is_active === false && <Badge variant="outline" className="bg-slate-100">Inactive</Badge>}
                    {canManage && (
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => { setEditingResource(r); setShowResourceDialog(true); }}>
                          <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600" onClick={() => { if (confirm(`Delete "${r.name}"? This cannot be undone.`)) deleteResourceMutation.mutate(r.id); }}>
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {showResourceDialog && (
        <ResourceFormDialog
          churchId={churchId}
          resource={editingResource}
          onClose={() => { setShowResourceDialog(false); setEditingResource(null); }}
        />
      )}
      {showBookingDialog && (
        <BookingFormDialog
          churchId={churchId}
          resources={activeResources}
          booking={editingBooking}
          defaultResourceId={resourceFilter !== 'all' ? resourceFilter : undefined}
          user={user}
          onClose={() => { setShowBookingDialog(false); setEditingBooking(null); }}
        />
      )}
    </div>
  );
}
