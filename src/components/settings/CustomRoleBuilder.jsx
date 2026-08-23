import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Plus, Trash2, Edit2, Shield, Users, X, MapPin, Eye } from 'lucide-react';
import { toast } from 'sonner';

// Permissions grouped by area
const PERMISSION_GROUPS = [
  { group: 'Members & Families', items: [
    { key: 'view_members', label: 'View Member List' },
    { key: 'edit_members', label: 'Add & Edit Members' },
    { key: 'delete_members', label: 'Delete Members' },
    { key: 'view_family_groups', label: 'View Family Groups' },
    { key: 'manage_family_groups', label: 'Manage Family Groups' },
  ]},
  { group: 'Attendance', items: [
    { key: 'take_attendance', label: 'Take Attendance' },
    { key: 'view_attendance_reports', label: 'View Attendance Reports' },
  ]},
  { group: 'Giving', items: [
    { key: 'record_giving', label: 'Record Giving' },
    { key: 'view_all_giving', label: 'View All Giving Records' },
    { key: 'view_own_giving', label: 'View Personal Giving History' },
  ]},
  { group: 'Spiritual Records', items: [
    { key: 'log_spiritual', label: 'Log Spiritual Records (Baptism, Holy Ghost)' },
    { key: 'view_spiritual', label: 'View Spiritual Records' },
  ]},
  { group: 'Ministry Groups', items: [
    { key: 'view_ministry', label: 'View Ministry Groups' },
    { key: 'manage_ministry', label: 'Manage Ministry Groups' },
    { key: 'send_announcements', label: 'Send Ministry Announcements' },
    { key: 'manage_schedules', label: 'Manage Ministry Schedules' },
    { key: 'take_ministry_attendance', label: 'Take Ministry Attendance' },
  ]},
  { group: 'Communication', items: [
    { key: 'send_sms', label: 'Send Mass Texts' },
    { key: 'view_follow_up', label: 'View Follow-Up Tasks' },
    { key: 'manage_follow_up', label: 'Manage Follow-Up Tasks' },
  ]},
  { group: 'Content', items: [
    { key: 'view_events', label: 'View Events' },
    { key: 'manage_events', label: 'Manage Events' },
    { key: 'view_sermons', label: 'View Sermons' },
    { key: 'manage_sermons', label: 'Manage Sermons' },
    { key: 'view_bible_study', label: 'View Bible Studies' },
    { key: 'manage_bible_study', label: 'Manage Bible Studies' },
    { key: 'view_prayer', label: 'View Prayer Requests' },
    { key: 'manage_prayer', label: 'Manage Prayer Requests' },
  ]},
  { group: 'Live Stream & Analytics', items: [
    { key: 'view_livestream', label: 'View Live Stream' },
    { key: 'manage_livestream', label: 'Manage Live Stream' },
    { key: 'view_dashboard', label: 'View Dashboard & Analytics' },
  ]},
];

const AGE_GROUPS = [
  { value: 'infants', label: 'Infants (0–2)' },
  { value: 'littles', label: 'Littles (2–8)' },
  { value: 'young', label: 'Youth (8–17)' },
  { value: 'adults', label: 'Adults (18+)' },
];

const COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const emptyForm = {
  name: '',
  description: '',
  color: '#6366f1',
  permissions: [],
  tracked_records: [],
  attendance_rooms: [],
  member_age_groups: [],
  assigned_user_emails: [],
};

export default function CustomRoleBuilder({ churchId }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newRoom, setNewRoom] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: customRoles = [], isLoading } = useQuery({
    queryKey: ['custom-roles', churchId],
    queryFn: () => base44.entities.CustomRole.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['church-users-for-roles', churchId],
    queryFn: () => base44.entities.User.list(),
    enabled: !!churchId && dialogOpen,
  });

  const openNew = () => {
    setEditRole(null);
    setForm(emptyForm);
    setNewRoom('');
    setDialogOpen(true);
  };

  const openEdit = (role) => {
    setEditRole(role);
    setForm({
      name: role.name || '',
      description: role.description || '',
      color: role.color || '#6366f1',
      permissions: role.permissions || [],
      tracked_records: role.tracked_records || [],
      attendance_rooms: role.attendance_rooms || [],
      member_age_groups: role.member_age_groups || [],
      assigned_user_emails: role.assigned_user_emails || [],
    });
    setNewRoom('');
    setDialogOpen(true);
  };

  const toggle = (field, value) => {
    setForm(f => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter(v => v !== value) : [...f[field], value],
    }));
  };

  const addRoom = () => {
    const trimmed = newRoom.trim();
    if (!trimmed || form.attendance_rooms.includes(trimmed)) return;
    setForm(f => ({ ...f, attendance_rooms: [...f.attendance_rooms, trimmed] }));
    setNewRoom('');
  };

  const removeRoom = (room) => {
    setForm(f => ({ ...f, attendance_rooms: f.attendance_rooms.filter(r => r !== room) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Role name is required'); return; }
    setSaving(true);
    const payload = { ...form, church_id: churchId };
    if (editRole) {
      await base44.entities.CustomRole.update(editRole.id, payload);
      toast.success('Custom role updated');
    } else {
      await base44.entities.CustomRole.create(payload);
      toast.success(`"${form.name}" role created`);
    }
    queryClient.invalidateQueries({ queryKey: ['custom-roles', churchId] });
    setDialogOpen(false);
    setSaving(false);
  };

  const handleDelete = async (role) => {
    if (!window.confirm(`Delete "${role.name}"?`)) return;
    await base44.entities.CustomRole.delete(role.id);
    queryClient.invalidateQueries({ queryKey: ['custom-roles', churchId] });
    toast.success('Role deleted');
  };

  const allPermKeys = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Custom Access Levels
          </CardTitle>
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="w-4 h-4" /> New Role
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Create named access levels for your church (e.g. "SS Teacher", "Nursery Volunteer") — only visible within your church.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-sm text-muted-foreground py-4">Loading...</div>}
        {!isLoading && customRoles.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">No custom roles yet</p>
            <p className="text-xs mt-1">Create roles like "SS Teacher" or "Nursery Volunteer" with specific access.</p>
          </div>
        )}
        <div className="space-y-3">
          {customRoles.map(role => (
            <div key={role.id} className="p-4 rounded-lg border bg-muted/20">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: role.color || '#6366f1' }} />
                  <span className="font-semibold text-sm">{role.name}</span>
                  {role.assigned_user_emails?.length > 0 && (
                    <Badge variant="secondary" className="text-xs gap-1 py-0">
                      <Users className="w-3 h-3" />{role.assigned_user_emails.length} user{role.assigned_user_emails.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(role)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => handleDelete(role)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {role.description && <p className="text-xs text-muted-foreground mb-2">{role.description}</p>}

              <div className="flex flex-wrap gap-1">
                {(role.permissions || []).slice(0, 4).map(p => {
                  const found = PERMISSION_GROUPS.flatMap(g => g.items).find(i => i.key === p);
                  return <Badge key={p} variant="outline" className="text-xs py-0">{found?.label || p}</Badge>;
                })}
                {(role.permissions || []).length > 4 && (
                  <Badge variant="outline" className="text-xs py-0 text-muted-foreground">+{role.permissions.length - 4} more</Badge>
                )}
              </div>

              {(role.member_age_groups || []).length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  <Eye className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Sees:</span>
                  {role.member_age_groups.map(g => {
                    const found = AGE_GROUPS.find(a => a.value === g);
                    return <Badge key={g} className="text-xs py-0 bg-blue-500/10 text-blue-600 border-blue-200">{found?.label || g}</Badge>;
                  })}
                </div>
              )}

              {(role.attendance_rooms || []).length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  <MapPin className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Rooms:</span>
                  {role.attendance_rooms.map(r => (
                    <Badge key={r} className="text-xs py-0 bg-green-500/10 text-green-700 border-green-200">{r}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editRole ? `Edit "${editRole.name}"` : 'Create Custom Role'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-1">

            {/* Name + Description */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label>Role Name <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. SS Teacher, Nursery Lead"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this role do?"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Color */}
            <div>
              <Label>Color Tag</Label>
              <div className="flex gap-2 mt-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`w-7 h-7 rounded-full border-2 transition-all ${form.color === c ? 'border-foreground scale-110 shadow' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <Separator />

            {/* Member Age Group Visibility */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-primary" /> Member Visibility
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Limit which age groups this role can see. Leave all unchecked to allow viewing all members.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {AGE_GROUPS.map(ag => (
                  <label key={ag.value} className="flex items-center gap-2 cursor-pointer p-2 rounded border hover:bg-muted/40 transition-colors">
                    <Checkbox
                      checked={form.member_age_groups.includes(ag.value)}
                      onCheckedChange={() => toggle('member_age_groups', ag.value)}
                    />
                    <span className="text-xs">{ag.label}</span>
                  </label>
                ))}
              </div>
              {form.member_age_groups.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1.5 italic">No restriction — can view all age groups.</p>
              )}
            </div>

            <Separator />

            {/* Attendance Room Restrictions */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-primary" /> Attendance Room Restrictions
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Specify which rooms/classes this role can take attendance in. Leave empty to allow all rooms.
              </p>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newRoom}
                  onChange={e => setNewRoom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRoom()}
                  placeholder="e.g. Nursery, Room 101, Youth Hall"
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={addRoom} disabled={!newRoom.trim()}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {form.attendance_rooms.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {form.attendance_rooms.map(room => (
                    <Badge key={room} className="gap-1 bg-green-500/10 text-green-700 border-green-200 pr-1">
                      {room}
                      <button type="button" onClick={() => removeRoom(room)} className="ml-1 hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No room restriction — can take attendance anywhere.</p>
              )}
            </div>

            <Separator />

            {/* Permissions */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-semibold">Permissions</Label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForm(f => ({
                    ...f,
                    permissions: f.permissions.length === allPermKeys.length ? [] : [...allPermKeys],
                  }))}
                >
                  {form.permissions.length === allPermKeys.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mb-3">Choose what this role is allowed to do in the system.</p>
              <div className="space-y-4">
                {PERMISSION_GROUPS.map(group => (
                  <div key={group.group}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{group.group}</p>
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {group.items.map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1 hover:bg-muted/40 transition-colors">
                          <Checkbox
                            checked={form.permissions.includes(key)}
                            onCheckedChange={() => toggle('permissions', key)}
                          />
                          <span className="text-sm text-muted-foreground">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Assign Users */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" /> Assign Users
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                Select which users in your church should have this custom role.
              </p>
              {allUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No users found.</p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {allUsers.map(u => (
                    <label key={u.id} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-muted/40 transition-colors">
                      <Checkbox
                        checked={form.assigned_user_emails.includes(u.email)}
                        onCheckedChange={() => toggle('assigned_user_emails', u.email)}
                      />
                      <span className="text-sm">{u.full_name || u.email}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{u.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editRole ? 'Save Changes' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}