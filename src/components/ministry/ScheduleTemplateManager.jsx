import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, LayoutTemplate, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

const emptyForm = {
  name: '', default_title: '', default_time: '', default_end_time: '',
  default_location: '', default_notes: '', roles: [],
};

// Lets staff save a reusable template (default title/time/location/notes + a
// list of worker roles) per ministry group, so "New Service" doesn't start
// from a blank form every week.
export default function ScheduleTemplateManager({ churchId, groups, defaultGroupId, onClose }) {
  const queryClient = useQueryClient();
  const [groupId, setGroupId] = useState(defaultGroupId || groups[0]?.id || '');
  const [editing, setEditing] = useState(null); // template being edited, or 'new'
  const [form, setForm] = useState(emptyForm);
  const [roleInput, setRoleInput] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['schedule-templates', churchId],
    queryFn: () => base44.entities.ScheduleTemplate.filter({ church_id: churchId }, 'name', 100),
    enabled: !!churchId,
  });

  const groupTemplates = templates.filter(t => t.group_id === groupId);

  const saveMutation = useMutation({
    mutationFn: (data) => editing && editing !== 'new'
      ? base44.entities.ScheduleTemplate.update(editing.id, data)
      : base44.entities.ScheduleTemplate.create({ ...data, church_id: churchId, group_id: groupId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates', churchId] });
      toast.success(editing && editing !== 'new' ? 'Template updated' : 'Template created');
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (err) => toast.error(err.message || 'Failed to save template'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ScheduleTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-templates', churchId] });
      toast.success('Template deleted');
    },
  });

  const startEdit = (t) => {
    setEditing(t);
    setForm({
      name: t.name || '', default_title: t.default_title || '', default_time: t.default_time || '',
      default_end_time: t.default_end_time || '', default_location: t.default_location || '',
      default_notes: t.default_notes || '', roles: t.roles || [],
    });
  };

  const startNew = () => { setEditing('new'); setForm(emptyForm); };

  const addRole = () => {
    const r = roleInput.trim();
    if (!r) return;
    if (form.roles.includes(r)) { setRoleInput(''); return; }
    setForm(prev => ({ ...prev, roles: [...prev.roles, r] }));
    setRoleInput('');
  };
  const removeRole = (r) => setForm(prev => ({ ...prev, roles: prev.roles.filter(x => x !== r) }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LayoutTemplate className="w-5 h-5" /> Schedule Templates</DialogTitle>
        </DialogHeader>

        {groups.length > 1 && !editing && (
          <div>
            <Label>Ministry Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select group…" /></SelectTrigger>
              <SelectContent>
                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        {!editing ? (
          <div className="space-y-3 mt-2">
            {groupTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No templates yet for this group.</p>
            ) : (
              <div className="space-y-2">
                {groupTemplates.map(t => (
                  <Card key={t.id}>
                    <CardContent className="p-3 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{t.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.default_title || 'No default title'}
                          {t.default_time ? ` · ${t.default_time}` : ''}
                          {t.default_location ? ` · ${t.default_location}` : ''}
                        </p>
                        {(t.roles || []).length > 0 && (
                          <div className="flex gap-1 flex-wrap mt-1.5">
                            {t.roles.map(r => <Badge key={r} variant="outline" className="text-[10px]">{r}</Badge>)}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => startEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => { if (window.confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id); }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <Button variant="outline" className="gap-1.5 w-full" onClick={startNew} disabled={!groupId}>
              <Plus className="w-4 h-4" /> New Template
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <div>
              <Label>Template Name *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sunday Morning" className="mt-1" />
            </div>
            <div>
              <Label>Default Event Title</Label>
              <Input value={form.default_title} onChange={e => setForm({ ...form, default_title: e.target.value })} placeholder="Sunday Morning Service" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Default Start Time</Label>
                <Input value={form.default_time} onChange={e => setForm({ ...form, default_time: e.target.value })} placeholder="9:00 AM" className="mt-1" />
              </div>
              <div>
                <Label>Default End Time</Label>
                <Input value={form.default_end_time} onChange={e => setForm({ ...form, default_end_time: e.target.value })} placeholder="11:00 AM" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Default Location</Label>
              <Input value={form.default_location} onChange={e => setForm({ ...form, default_location: e.target.value })} placeholder="Main Sanctuary" className="mt-1" />
            </div>
            <div>
              <Label>Default Notes</Label>
              <Textarea value={form.default_notes} onChange={e => setForm({ ...form, default_notes: e.target.value })} rows={2} className="mt-1" />
            </div>
            <div>
              <Label>Worker Roles</Label>
              <p className="text-xs text-muted-foreground mb-1.5">Suggested roles to quickly assign each week (e.g. Worship Leader, Sound Tech, Usher).</p>
              {form.roles.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {form.roles.map(r => (
                    <Badge key={r} variant="secondary" className="text-xs gap-1 pr-1">
                      {r}
                      <button onClick={() => removeRole(r)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={roleInput}
                  onChange={e => setRoleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRole(); } }}
                  placeholder="Type a role and press Enter"
                  className="text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addRole}>Add</Button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</Button>
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate(form)}
                disabled={!form.name || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving…' : (editing !== 'new' ? 'Update Template' : 'Create Template')}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
