import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Users, Mail, CheckCircle2, XCircle, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MAX_SUBJECT_LENGTH = 150;

export default function MassEmailTab() {
  const { user, myChurches } = useAppUser();
  const churchId = user?.church_id;
  const church = myChurches?.find(c => c.id === churchId);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('active'); // active | all | group
  const [groupId, setGroupId] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['mass-email-members', churchId],
    queryFn: () => base44.entities.ChurchMember.filter({ church_id: churchId }),
    enabled: !!churchId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['mass-email-groups', churchId],
    queryFn: () => base44.entities.MinistryGroup.filter({ church_id: churchId, is_active: true }),
    enabled: !!churchId,
  });

  const { data: groupMembers = [] } = useQuery({
    queryKey: ['mass-email-group-members', groupId],
    queryFn: () => base44.entities.MinistryGroupMember.filter({ group_id: groupId }),
    enabled: !!groupId && segment === 'group',
  });

  const membersWithEmail = useMemo(() => members.filter(m => m.email && m.email.trim()), [members]);

  const segmentedMembers = useMemo(() => {
    if (segment === 'group') {
      const emails = new Set(groupMembers.map(gm => gm.member_email));
      return membersWithEmail.filter(m => emails.has(m.email));
    }
    if (segment === 'active') return membersWithEmail.filter(m => m.status === 'active');
    return membersWithEmail; // all
  }, [membersWithEmail, segment, groupMembers]);

  const filteredMembers = useMemo(() => {
    if (!search) return segmentedMembers;
    const q = search.toLowerCase();
    return segmentedMembers.filter(m =>
      `${m.first_name} ${m.last_name}`.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  }, [segmentedMembers, search]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => setSelectedIds(new Set(filteredMembers.map(m => m.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const selectedMembers = segmentedMembers.filter(m => selectedIds.has(m.id));

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    if (selectedMembers.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }
    setSending(true);
    setResults(null);
    try {
      const recipients = selectedMembers.map(m => ({ email: m.email, name: `${m.first_name} ${m.last_name}` }));
      const data = await base44.functions.invoke('send-church-email', {
        churchId,
        subject: subject.trim(),
        message: message.trim(),
        recipients,
      });
      if (data?.error && !data?.sent) {
        toast.error(data.error);
        setResults({ error: data.error });
      } else {
        toast.success(`Sent ${data.sent} of ${data.total} emails`);
        setResults(data);
        if (data.sent > 0) {
          setSubject('');
          setMessage('');
          clearSelection();
        }
      }
    } catch (err) {
      toast.error(err.message || 'Failed to send emails');
      setResults({ error: err.message });
    }
    setSending(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-serif font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" />
            Mass Email
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Send an email to your congregation — no setup required, sent from {church?.name || 'your church'}.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recipient selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Recipients
              <Badge variant="secondary">{selectedMembers.length} selected</Badge>
            </CardTitle>
            <CardDescription>{segmentedMembers.length} members match this segment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs mb-1.5 block">Segment</Label>
              <Select value={segment} onValueChange={(v) => { setSegment(v); clearSelection(); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active members only</SelectItem>
                  <SelectItem value="all">All members (incl. inactive)</SelectItem>
                  <SelectItem value="group">Specific ministry group</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {segment === 'group' && (
              <div>
                <Label className="text-xs mb-1.5 block">Ministry Group</Label>
                <Select value={groupId} onValueChange={(v) => { setGroupId(v); clearSelection(); }}>
                  <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                  <SelectContent>
                    {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members..." className="pl-8" />
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Button size="sm" variant="outline" onClick={selectAllFiltered}>Select Filtered</Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
            </div>
            <Separator />
            <div className="max-h-[360px] overflow-y-auto space-y-1.5">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : filteredMembers.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No members found</p>
              ) : (
                filteredMembers.map(member => (
                  <label key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                    <Checkbox checked={selectedIds.has(member.id)} onCheckedChange={() => toggleSelect(member.id)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.first_name} {member.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Compose & send */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Compose Email
            </CardTitle>
            <CardDescription>Recipients see this from {church?.name || 'your church'}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Subject</Label>
                <span className={`text-xs ${subject.length > MAX_SUBJECT_LENGTH ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {subject.length} / {MAX_SUBJECT_LENGTH}
                </span>
              </div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. This Sunday's service update" maxLength={MAX_SUBJECT_LENGTH} />
            </div>
            <div>
              <Label className="mb-1.5 block">Message</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message here..." rows={8} />
            </div>

            <div className="p-3 rounded-lg bg-muted/30 border text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Recipients</span><span className="font-medium">{selectedMembers.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Billed to</span><span className="font-medium">Included with ShepherdSyncs</span></div>
            </div>

            <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim() || selectedMembers.length === 0} className="w-full gap-2 h-11" size="lg">
              {sending ? (<><Loader2 className="w-4 h-4 animate-spin" /> Sending {selectedMembers.length} emails...</>) : (<><Send className="w-4 h-4" /> Send to {selectedMembers.length} {selectedMembers.length === 1 ? 'person' : 'people'}</>)}
            </Button>

            {results && !results.error && (
              <div className="p-4 rounded-lg border space-y-3 bg-emerald-500/5 border-emerald-500/20">
                <div className="flex items-center gap-2 text-emerald-600"><CheckCircle2 className="w-5 h-5" /><span className="font-medium">Sending Complete</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded-lg bg-emerald-500/10"><p className="text-2xl font-bold text-emerald-600">{results.sent}</p><p className="text-xs text-muted-foreground">Sent</p></div>
                  {results.failed > 0 && (
                    <div className="text-center p-2 rounded-lg bg-red-500/10"><p className="text-2xl font-bold text-red-500">{results.failed}</p><p className="text-xs text-muted-foreground">Failed</p></div>
                  )}
                </div>
                {results.errors?.length > 0 && (
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {results.errors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-red-500">
                        <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                        <span className="font-mono">{err.email}</span>
                        <span className="text-muted-foreground">— {err.error}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {results?.error && !results?.sent && (
              <div className="p-4 rounded-lg border bg-red-500/5 border-red-500/20 flex items-start gap-2 text-red-500">
                <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div><p className="font-medium">Failed to send</p><p className="text-sm text-muted-foreground">{results.error}</p></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
