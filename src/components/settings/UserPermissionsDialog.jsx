import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Extra permissions that can be granted on top of a user's base role
export const EXTRA_PERMISSIONS = [
  {
    value: 'view_giving',
    label: 'View Giving Records',
    description: 'Can view the Giving dashboard, all records, and member giving summaries',
  },
  {
    value: 'record_giving',
    label: 'Record Giving',
    description: 'Can record new tithes and offerings (requires View Giving)',
  },
  {
    value: 'view_spiritual',
    label: 'View Spiritual Records',
    description: 'Can view baptism, salvation, and Holy Ghost records',
  },
  {
    value: 'record_spiritual',
    label: 'Record Spiritual Milestones',
    description: 'Can create new spiritual records (baptism, salvation, etc.)',
  },
  {
    value: 'manage_members',
    label: 'Manage Members',
    description: 'Can add, edit, and view full member profiles',
  },
  {
    value: 'view_analytics',
    label: 'View Analytics',
    description: 'Can access the Analytics dashboard',
  },
  {
    value: 'manage_events',
    label: 'Manage Events',
    description: 'Can create and edit church events',
  },
  {
    value: 'manage_prayer',
    label: 'Manage Prayer Requests',
    description: 'Can view all prayer requests including private ones and add staff notes',
  },
  {
    value: 'access_bible_study',
    label: 'Access Bible Study',
    description: 'Can access Bible Study, Study Guides, and the Study Companion AI assistant',
  },
  {
    value: 'access_church_chat',
    label: 'Access Church Chat',
    description: 'Can participate in church-wide and ministry group chat channels',
  },
];

export default function UserPermissionsDialog({ user: targetUser, open, onOpenChange, onSaved }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (targetUser) {
      setSelected(targetUser.extra_permissions || []);
    }
  }, [targetUser]);

  const toggle = (perm) => {
    setSelected(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.User.update(targetUser.id, { extra_permissions: selected });
    toast.success('Permissions updated');
    setSaving(false);
    onSaved?.();
    onOpenChange(false);
  };

  if (!targetUser) return null;

  const roleBadgeColor = {
    church_admin: 'bg-blue-100 text-blue-700',
    ministry_staff: 'bg-indigo-100 text-indigo-700',
    church_staff: 'bg-green-100 text-green-700',
    attendance_tracker: 'bg-gray-100 text-gray-600',
    user: 'bg-purple-100 text-purple-700',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Extra Permissions</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 mt-1">
          <p className="text-sm text-muted-foreground">
            Grant <strong>{targetUser.full_name || targetUser.email}</strong> access to specific features beyond their base role.
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={`text-xs ${roleBadgeColor[targetUser.role] || 'bg-muted text-muted-foreground'}`}>
              {(targetUser.role || 'user').replace(/_/g, ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">base role</span>
          </div>
        </div>

        <div className="space-y-3 mt-3 max-h-72 overflow-y-auto pr-1">
          {EXTRA_PERMISSIONS.map(perm => (
            <div
              key={perm.value}
              className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => toggle(perm.value)}
            >
              <Checkbox
                id={perm.value}
                checked={selected.includes(perm.value)}
                onCheckedChange={() => toggle(perm.value)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <Label htmlFor={perm.value} className="text-sm font-medium cursor-pointer">{perm.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Permissions'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}