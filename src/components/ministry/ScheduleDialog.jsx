import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Bell, ChevronRight, ChevronLeft, Users, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { getMemberAvailability } from '@/lib/availability';

export default function ScheduleDialog({ group, editSchedule, user, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = !!editSchedule?.id;
  const [step, setStep] = useState(isEdit ? 0 : 1); // 0 = edit (all), 1 = details, 2 = workers
  const [createdId, setCreatedId] = useState(null);

  // Guards against malformed years some browsers allow typing into a native date input
  // (e.g. "20206-08-08"), which would otherwise crash any page that formats this date later.
  const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + 'T00:00:00').getTime());
  const sanitizeDateInput = (v) => {
    const [y = '', m = '', day = ''] = v.split('-');
    return y.length > 4 ? [y.slice(0, 4), m, day].filter(Boolean).join('-') : v;
  };

  const [form, setForm] = useState({
    title: editSchedule?.title || '',
    date: editSchedule?.date || '',
    time: editSchedule?.time || '',
    end_time: editSchedule?.end_time || '',
    location: editSchedule?.location || '',
    notes: editSchedule?.notes || '',
    send_reminder: editSchedule?.send_reminder ?? false,
    assignees: editSchedule?.assignees || [],
  });

  const { data: members = [] } = useQuery({
    queryKey: ['ministry-members-available', group.id],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ group_id: group.id }),
  });

  // Availability data for every member in the church — filtered client-side per
  // member below, same pattern as other church-scoped lookups in this app.
  const { data: weeklyRules = [] } = useQuery({
    queryKey: ['weekly-availability', group.church_id],
    queryFn: () => base44.entities.MemberWeeklyAvailability.filter({ church_id: group.church_id }),
    enabled: !!group.church_id,
  });
  const { data: exceptions = [] } = useQuery({
    queryKey: ['availability-exceptions', group.church_id],
    queryFn: () => base44.entities.MemberAvailabilityException.filter({ church_id: group.church_id }, '-start_date', 500),
    enabled: !!group.church_id,
  });

  const getAvailabilityFor = (memberEmail) => {
    if (!isValidDate(form.date)) return { available: true, reason: null };
    return getMemberAvailability({ memberEmail, date: form.date, weeklyRules, exceptions });
  };

  const [selectedMemberEmail, setSelectedMemberEmail] = useState('');
  const [assigneeRole, setAssigneeRole] = useState('');

  const addAssignee = () => {
    const member = members.find(m => m.member_email === selectedMemberEmail || m.display_name === selectedMemberEmail);
    if (!member) return;
    if (form.assignees.some(a => a.member_name === member.display_name)) { toast.error('Already assigned'); return; }
    const avail = getAvailabilityFor(member.member_email);
    if (!avail.available) {
      toast.error(`${member.display_name} is marked unavailable${avail.reason ? ` — ${avail.reason}` : ''} on this date`);
      return;
    }
    setForm(prev => ({
      ...prev,
      assignees: [...prev.assignees, { member_email: member.member_email || '', member_name: member.display_name, role: assigneeRole }],
    }));
    setSelectedMemberEmail('');
    setAssigneeRole('');
  };

  const removeAssignee = (name) => {
    setForm(prev => ({ ...prev, assignees: prev.assignees.filter(a => a.member_name !== name) }));
  };

  // Create new schedule (step 1 → step 2)
  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.MinistrySchedule.create({ ...data, assignee_emails: (data.assignees || []).map(a => a.member_email).filter(Boolean), group_id: group.id, church_id: group.church_id }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ministry-schedules'] });
      setCreatedId(result.id);
      setStep(2);
      toast.success('Service created! Now assign your team.');
    },
  });

  // Update existing schedule (edit mode)
  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.MinistrySchedule.update(editSchedule.id, { ...data, assignee_emails: (data.assignees || []).map(a => a.member_email).filter(Boolean) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-schedules'] });
      toast.success('Schedule updated');
      onClose();
    },
  });

  // Save assignees after creation (step 2 → close)
  const saveAssigneesMutation = useMutation({
    mutationFn: (assignees) => base44.entities.MinistrySchedule.update(createdId, { assignees, assignee_emails: assignees.map(a => a.member_email).filter(Boolean) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-schedules'] });
      toast.success('Workers assigned!');
      onClose();
    },
  });

  // Update details when going back from step 2 to step 1 and re-saving
  const updateDetailsMutation = useMutation({
    mutationFn: (data) => base44.entities.MinistrySchedule.update(createdId, { ...data, assignee_emails: (data.assignees || []).map(a => a.member_email).filter(Boolean) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ministry-schedules'] });
      setStep(2);
      toast.success('Details updated');
    },
  });

  const sendReminderMutation = useMutation({
    mutationFn: () => base44.functions.invoke('ministryMailer', { schedule_id: editSchedule.id }),
    onSuccess: () => toast.success('Reminders sent!'),
  });

  const handlePrimaryAction = () => {
    if (isEdit) {
      updateMutation.mutate(form);
    } else if (!createdId) {
      createMutation.mutate(form);
    } else {
      updateDetailsMutation.mutate(form);
    }
  };

  const handleDone = () => {
    if (createdId) {
      saveAssigneesMutation.mutate(form.assignees);
    }
  };

  const showDetails = isEdit || step === 1;
  const showAssignees = isEdit || step === 2;
  const isCreating = createMutation.isPending || updateMutation.isPending || updateDetailsMutation.isPending || saveAssigneesMutation.isPending;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? 'Edit Schedule'
              : step === 1
                ? `New Service — ${group.name}`
                : `Assign Workers — ${form.title}`}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator for new schedules */}
        {!isEdit && (
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center gap-1.5 text-xs font-medium ${step === 1 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>1</div>
              <Calendar className="w-3 h-3" /> Details
            </div>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
            <div className={`flex items-center gap-1.5 text-xs font-medium ${step === 2 ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>2</div>
              <Users className="w-3 h-3" /> Workers
            </div>
          </div>
        )}

        <div className="space-y-4 mt-2">
          {/* STEP 1: Service Details */}
          {showDetails && (
            <>
              <div>
                <Label>Event Title *</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Sunday Morning Service" className="mt-1" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={e => setForm({ ...form, date: sanitizeDateInput(e.target.value) })}
                    className="mt-1"
                  />
                  {form.date && !isValidDate(form.date) && (
                    <p className="text-xs text-destructive mt-1">Enter a valid date</p>
                  )}
                </div>
                <div>
                  <Label>Start Time</Label>
                  <Input value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} placeholder="9:00 AM" className="mt-1" />
                </div>
                <div>
                  <Label>End Time</Label>
                  <Input value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} placeholder="11:00 AM" className="mt-1" />
                </div>
              </div>

              <div>
                <Label>Location</Label>
                <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Main Sanctuary" className="mt-1" />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Any notes for the team…" className="mt-1" />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Send Email Reminder</p>
                    <p className="text-xs text-muted-foreground">Notify assignees by email</p>
                  </div>
                </div>
                <Switch checked={form.send_reminder} onCheckedChange={v => setForm({ ...form, send_reminder: v })} />
              </div>
            </>
          )}

          {/* STEP 2: Assign Workers */}
          {showAssignees && (
            <div className={`space-y-2 ${!isEdit ? 'pt-2 border-t' : ''}`}>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Assign Service Workers
              </p>
              <p className="text-xs text-muted-foreground">Add musicians, offering takers, security, SS teachers, and more.</p>
              {form.assignees.length > 0 && (
                <div className="space-y-1.5">
                  {form.assignees.map(a => (
                    <div key={a.member_name} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                        {a.member_name[0]}
                      </div>
                      <span className="flex-1 text-sm">{a.member_name}</span>
                      {a.role && <Badge variant="secondary" className="text-xs">{a.role}</Badge>}
                      <Button size="icon" variant="ghost" className="w-6 h-6 text-destructive" onClick={() => removeAssignee(a.member_name)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2">
                <Select value={selectedMemberEmail} onValueChange={setSelectedMemberEmail}>
                  <SelectTrigger className="text-xs col-span-2"><SelectValue placeholder="Select member…" /></SelectTrigger>
                  <SelectContent>
                    {members.map(m => {
                      const avail = getAvailabilityFor(m.member_email);
                      return (
                        <SelectItem
                          key={m.id}
                          value={m.member_email || m.display_name}
                          disabled={!avail.available}
                          className="text-xs"
                        >
                          <span className="flex items-center gap-1.5">
                            {m.display_name}
                            {isValidDate(form.date) && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1 py-0 h-4 leading-none ${avail.available ? 'text-green-600 border-green-300' : 'text-red-500 border-red-300'}`}
                              >
                                {avail.available ? 'Available' : 'Unavailable'}
                              </Badge>
                            )}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <Input className="text-xs" placeholder="Role…" value={assigneeRole} onChange={e => setAssigneeRole(e.target.value)} />
              </div>
              {selectedMemberEmail && !getAvailabilityFor(selectedMemberEmail).available && (
                <p className="text-xs text-destructive">
                  Unavailable on this date{getAvailabilityFor(selectedMemberEmail).reason ? ` — ${getAvailabilityFor(selectedMemberEmail).reason}` : ''}. Pick another date or member.
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={addAssignee}
                disabled={!selectedMemberEmail || !getAvailabilityFor(selectedMemberEmail).available}
              >
                <Plus className="w-3.5 h-3.5" /> Add Worker
              </Button>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-2">
            {!isEdit && step === 2 && (
              <Button variant="outline" className="gap-1.5" onClick={() => setStep(1)}>
                <ChevronLeft className="w-4 h-4" /> Back
              </Button>
            )}
            {isEdit ? (
              <Button className="flex-1" onClick={() => updateMutation.mutate(form)} disabled={!form.title || !isValidDate(form.date) || isCreating}>
                {isCreating ? 'Saving…' : 'Update Schedule'}
              </Button>
            ) : step === 1 ? (
              <Button className="flex-1 gap-1.5" onClick={handlePrimaryAction} disabled={!form.title || !isValidDate(form.date) || isCreating}>
                {isCreating ? 'Creating…' : (createdId ? 'Save & Continue' : 'Create & Assign Workers')} <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button className="flex-1" onClick={handleDone} disabled={isCreating}>
                {isCreating ? 'Saving…' : 'Done'}
              </Button>
            )}
            {isEdit && form.send_reminder && (
              <Button variant="outline" className="gap-1.5" onClick={() => sendReminderMutation.mutate()} disabled={sendReminderMutation.isPending}>
                <Bell className="w-4 h-4" /> {sendReminderMutation.isPending ? '…' : 'Send Reminders'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}