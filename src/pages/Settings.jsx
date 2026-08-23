import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import useAppUser from '@/hooks/useAppUser';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPlus, Shield, Users, Building2, Plus, Cake, Send, Trash2, User, Bell, Upload, Monitor, Sun, Moon, Settings2, AlertTriangle, HandCoins } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ImportMembersDialog from '@/components/members/ImportMembersDialog';
import RolePermissionsChecklist from '@/components/settings/RolePermissionsChecklist';
import UserPermissionsDialog, { EXTRA_PERMISSIONS } from '@/components/settings/UserPermissionsDialog';
import { Checkbox } from '@/components/ui/checkbox';
import SMSConfigTab from '@/components/settings/SMSConfigTab';
import FormIntegrationsTab from '@/components/settings/FormIntegrationsTab';
import OnlineGivingConfig from '@/components/settings/OnlineGivingConfig';
import AIChatConfig from '@/components/settings/AIChatConfig';
import CustomRoleBuilder from '@/components/settings/CustomRoleBuilder';
import { Link } from 'react-router-dom';
import { useTheme } from '@/lib/ThemeContext';
import { toast } from 'sonner';

// Roles church admins can assign (cannot assign global_admin)
const CHURCH_ADMIN_ROLES = [
  { value: 'church_admin', label: 'Church Admin' },
  { value: 'ministry_staff', label: 'Ministry Staff' },
  { value: 'church_staff', label: 'Church Staff' },
  { value: 'attendance_tracker', label: 'Attendance Tracker' },
  { value: 'user', label: 'Church Member' },
];

// Ministry staff cannot assign church_admin or ministry_staff
const MINISTRY_STAFF_ROLES = [
  { value: 'church_staff', label: 'Church Staff' },
  { value: 'attendance_tracker', label: 'Attendance Tracker' },
  { value: 'user', label: 'Church Member' },
];

const GLOBAL_ADMIN_ROLES = [
  { value: 'global_admin', label: 'Global Admin' },
  ...CHURCH_ADMIN_ROLES,
];

const emptyChurch = { name: '', city: '', state: '', pastor_name: '', phone: '', email: '' };

export default function Settings() {
  const { user, isChurchAdmin, isGlobalAdmin, isMinistryStaff, myChurches } = useAppUser();
  const activeChurch = myChurches?.find(c => c.id === user?.church_id);
  const { theme, toggleTheme, isLight } = useTheme();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [invitePermissions, setInvitePermissions] = useState(['manage_members']);
  const [inviting, setInviting] = useState(false);
  const [churchForm, setChurchForm] = useState(emptyChurch);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', address: '' });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Load existing MemberProfile for the current user
  const { data: myProfiles = [] } = useQuery({
    queryKey: ['my-member-profile', user?.email],
    queryFn: () => base44.entities.MemberProfile.filter({ user_email: user.email }),
    enabled: !!user?.email,
  });

  const myProfile = myProfiles[0];

  // Initialize form once user + profile data is available
  useEffect(() => {
    if (user && !profileLoaded) {
      setProfileForm({
        full_name: user.full_name || '',
        phone: myProfile?.phone || '',
        address: myProfile?.address || '',
      });
      setProfileLoaded(true);
    }
  }, [user, myProfile, profileLoaded]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    const { full_name, phone, address } = profileForm;
    if (full_name && full_name !== user?.full_name) {
      await base44.auth.updateMe({ full_name });
    }
    if (myProfile) {
      await base44.entities.MemberProfile.update(myProfile.id, { phone, address, display_name: full_name });
    } else {
      await base44.entities.MemberProfile.create({
        phone, address, display_name: full_name,
        church_id: user?.church_id || '',
        user_email: user.email,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['my-member-profile'] });
    toast.success('Profile saved');
    setSavingProfile(false);
  };

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isGlobalAdmin || isChurchAdmin,
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['churches'],
    queryFn: () => base44.entities.Church.list(),
    enabled: isGlobalAdmin,
  });

  const createChurchMutation = useMutation({
    mutationFn: async (data) => {
      const pastorEmail = data.pastor_email || data.email;
      const church = await base44.entities.Church.create({
        ...data,
        status: 'active',
        admin_emails: pastorEmail ? [pastorEmail] : [],
      });
      // If a pastor email is provided, send welcome email + invite them as church_admin
      if (pastorEmail && church?.id) {
        await base44.functions.invoke('welcomeChurchAdmin', {
          churchId: church.id,
          pastorEmail,
          pastorName: data.pastor_name || '',
          churchName: data.name,
        });
      }
      return church;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setChurchForm(emptyChurch);
      toast.success('Church account created and welcome email sent to pastor');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, role, userEmail, userName }) => {
      await base44.entities.User.update(id, { role });
      // If promoted to church_admin, sync to Pastoral Staff for all their churches
      if (role === 'church_admin' && userEmail) {
        const allChurches = await base44.entities.Church.list();
        const theirChurches = allChurches.filter(c => {
          const emails = c.admin_emails || (c.admin_email ? [c.admin_email] : []);
          return emails.includes(userEmail);
        });
        for (const c of theirChurches) {
          base44.functions.invoke('syncPastoralStaff', {
            churchId: c.id,
            adminEmail: userEmail,
            adminName: userName || userEmail,
          }).catch(() => {});
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Role updated');
    },
  });

  const assignChurchMutation = useMutation({
    mutationFn: async ({ userEmail, userName, churchId, action }) => {
      if (!churchId || churchId === '__none__') return;
      const church = churches.find(c => c.id === churchId);
      if (!church) return;
      const currentEmails = church.admin_emails || (church.admin_email ? [church.admin_email] : []);
      let updatedEmails;
      if (action === 'add') {
        updatedEmails = [...new Set([...currentEmails, userEmail])];
      } else {
        updatedEmails = currentEmails.filter(e => e !== userEmail);
      }
      await base44.entities.Church.update(churchId, { admin_emails: updatedEmails });
      // Sync to Pastoral Staff on add
      if (action === 'add') {
        base44.functions.invoke('syncPastoralStaff', {
          churchId,
          adminEmail: userEmail,
          adminName: userName || userEmail,
        }).catch(() => {});
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['churches'] });
      toast.success('Church assignment updated');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User removed');
    },
  });

  const churchUsers = isGlobalAdmin
    ? users
    : users.filter(u => u.church_id === user?.church_id && u.role !== 'global_admin' && u.role !== 'admin');
  const assignableRoles = isGlobalAdmin
    ? GLOBAL_ADMIN_ROLES
    : isChurchAdmin
      ? CHURCH_ADMIN_ROLES
      : MINISTRY_STAFF_ROLES;

  const handleInvite = async () => {
    if (!email || !inviteName) { toast.error('Enter a name and email'); return; }
    setInviting(true);
    try {
      const res = await base44.functions.invoke('inviteChurchUser', {
        email,
        inviteName,
        role: inviteRole,
        churchId: user?.church_id,
        churchName: activeChurch?.name || '',
        extraPermissions: invitePermissions,
      });
      if (res.data?.error) {
        toast.error(res.data.error);
      } else if (res.data?.email_sent === false) {
        toast.success(`Invited ${inviteName} — a default invitation email was sent to ${email}. Set their role below once they register.`);
        setEmail('');
        setInviteName('');
        setInviteRole('user');
        setInvitePermissions(['manage_members']);
        queryClient.invalidateQueries({ queryKey: ['users'] });
      } else {
        toast.success(`Invitation sent to ${inviteName} (${email}) from ${activeChurch?.name || 'ShepherdSyncs'}`);
        setEmail('');
        setInviteName('');
        setInviteRole('user');
        setInvitePermissions(['manage_members']);
        queryClient.invalidateQueries({ queryKey: ['users'] });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send invitation');
    }
    setInviting(false);
  };

  const roleBadge = {
    global_admin: 'bg-red-100 text-red-700',
    church_admin: 'bg-blue-100 text-blue-700',
    ministry_staff: 'bg-indigo-100 text-indigo-700',
    church_staff: 'bg-green-100 text-green-700',
    attendance_tracker: 'bg-gray-100 text-gray-600',
    user: 'bg-purple-100 text-purple-700',
  };

  // Ministry staff cannot change church_admin or ministry_staff roles
  const canEditUserRole = (targetUser) => {
    if (targetUser.id === user?.id) return false;
    if (isGlobalAdmin) return true; // global admins can edit anyone (no restrictions)
    if (isChurchAdmin) return targetUser.role !== 'global_admin';
    if (isMinistryStaff) return targetUser.role !== 'church_admin' && targetUser.role !== 'ministry_staff' && targetUser.role !== 'global_admin';
    return false;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile and access</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">My Profile</TabsTrigger>
          {(isChurchAdmin || isMinistryStaff) && <TabsTrigger value="admin">Administration</TabsTrigger>}
          {isChurchAdmin && <TabsTrigger value="sms">Mass Texting</TabsTrigger>}
          {isChurchAdmin && <TabsTrigger value="forms">Form Integrations</TabsTrigger>}
          {isChurchAdmin && <TabsTrigger value="custom-roles">Custom Roles</TabsTrigger>}
        </TabsList>

        {/* My Profile Tab — visible to ALL users */}
        <TabsContent value="profile" className="space-y-4">

          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {isLight ? <Sun className="w-5 h-5 text-primary" /> : <Moon className="w-5 h-5 text-primary" />}
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Theme</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isLight ? 'Light mode is active — bright backgrounds' : 'Dark mode is active — dark backgrounds'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={!isLight ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => !isLight ? null : toggleTheme()}
                  >
                    <Moon className="w-4 h-4" /> Dark
                  </Button>
                  <Button
                    variant={isLight ? 'default' : 'outline'}
                    size="sm"
                    className="gap-2"
                    onClick={() => isLight ? null : toggleTheme()}
                  >
                    <Sun className="w-4 h-4" /> Light
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="Your full name"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted/40" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="(555) 000-0000"
                  />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input
                    value={profileForm.address}
                    onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Save Profile'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Tab — Church Admins, Global Admins, and Ministry Staff */}
        {(isChurchAdmin || isMinistryStaff) && <TabsContent value="admin" className="space-y-6">

      {/* Global Admin only: Create Church Account */}
      {isGlobalAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Create Church Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Church Name *</Label>
                <Input value={churchForm.name} onChange={e => setChurchForm({ ...churchForm, name: e.target.value })} placeholder="Grace Community Church" />
              </div>
              <div>
                <Label>Pastor Name</Label>
                <Input value={churchForm.pastor_name} onChange={e => setChurchForm({ ...churchForm, pastor_name: e.target.value })} placeholder="Pastor John Smith" />
              </div>
              <div>
                <Label>City</Label>
                <Input value={churchForm.city} onChange={e => setChurchForm({ ...churchForm, city: e.target.value })} placeholder="Dallas" />
              </div>
              <div>
                <Label>State</Label>
                <Input value={churchForm.state} onChange={e => setChurchForm({ ...churchForm, state: e.target.value })} placeholder="TX" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={churchForm.phone} onChange={e => setChurchForm({ ...churchForm, phone: e.target.value })} placeholder="(555) 000-0000" />
              </div>
              <div>
                <Label>Church Email</Label>
                <Input value={churchForm.email} onChange={e => setChurchForm({ ...churchForm, email: e.target.value })} placeholder="office@church.org" type="email" />
              </div>
              <div className="sm:col-span-2">
                <Label>Pastor Email <span className="text-primary font-normal">(receives welcome email + Church Admin access)</span></Label>
                <Input value={churchForm.pastor_email || ''} onChange={e => setChurchForm({ ...churchForm, pastor_email: e.target.value })} placeholder="pastor@church.org" type="email" />
              </div>
            </div>
            <Button
              onClick={() => createChurchMutation.mutate(churchForm)}
              disabled={!churchForm.name || createChurchMutation.isPending}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              {createChurchMutation.isPending ? 'Creating...' : 'Create Church Account'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Online Giving Platform — church admin only */}
      {isChurchAdmin && activeChurch && <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HandCoins className="w-5 h-5 text-primary" />
            Online Giving Platform
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Set your external giving platform URL. A prominent "Give Online" button will appear on your public giving page directing people to your platform.
          </p>
          <OnlineGivingConfig church={activeChurch} onSave={(data) => base44.entities.Church.update(activeChurch.id, data).then(() => queryClient.invalidateQueries({ queryKey: ['churches'] }))} />
        </CardContent>
      </Card>}

      {/* AI Visitor Chat Config — church admin only */}
      {isChurchAdmin && activeChurch && <AIChatConfig church={activeChurch} onSave={(data) => base44.entities.Church.update(activeChurch.id, data).then(() => queryClient.invalidateQueries({ queryKey: ['churches'] }))} />}

      {/* Import Members — church admin only */}
      {isChurchAdmin && <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            Import Member Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Import members from a CSV, Excel, or JSON file. The AI will automatically detect and map your column headers.
          </p>
          <ImportMembersDialog
            churchId={user?.church_id || null}
            onImportSuccess={() => toast.success('Members imported successfully')}
          />
        </CardContent>
      </Card>}

      {/* Kiosk Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Kiosk Mode (Tablet Check-In)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Open a simplified check-in screen for tablets at the church entrance. Parents can search for their child, select a ministry group, and print a name tag on a connected label printer.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button asChild variant="outline" className="gap-2">
              <Link to={`/kiosk${user?.church_id ? `?church_id=${user.church_id}` : ''}`} target="_blank">
                <Monitor className="w-4 h-4" />
                Open Kiosk Mode
              </Link>
            </Button>
            <p className="text-xs text-muted-foreground self-center">Opens in current tab — use browser fullscreen (F11) on the tablet.</p>
          </div>
        </CardContent>
      </Card>

      {/* Ministry Reminder Sweep */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Ministry Schedule Reminders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every morning at 8 AM, assignees on upcoming ministry schedules within the next <strong>3 days</strong> automatically receive a personalized email reminder with their role, date, time, and location.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                toast.loading('Sending reminders now…', { id: 'ministry-reminder' });
                const res = await base44.functions.invoke('ministryReminderSweep', {});
                toast.dismiss('ministry-reminder');
                const total = res.data?.total_emails_sent ?? 0;
                const checked = res.data?.checked ?? 0;
                if (checked === 0) {
                  toast.info('No upcoming schedules need reminders right now.');
                } else {
                  toast.success(`Reminders sent! ${total} email${total !== 1 ? 's' : ''} across ${checked} schedule${checked !== 1 ? 's' : ''}.`);
                }
              }}
            >
              <Send className="w-4 h-4" /> Send Reminders Now
            </Button>
            <p className="text-xs text-muted-foreground">Runs automatically each morning — use this to trigger manually.</p>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Attendance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            Monthly Attendance Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            On the <strong>1st of each month</strong>, all church admins receive an email summarizing last month's attendance — service-by-service trends, average attendance, and a list of members absent for 4+ consecutive weeks with direct reach-out links.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                toast.loading('Generating summary…', { id: 'att-summary' });
                const res = await base44.functions.invoke('monthlyAttendanceSummary', {});
                toast.dismiss('att-summary');
                const total = res.data?.processed?.length ?? 0;
                if (total === 0) {
                  toast.info('No churches with data to report.');
                } else {
                  toast.success(`Summary sent to ${total} church${total !== 1 ? 'es' : ''}!`);
                }
              }}
            >
              <Send className="w-4 h-4" /> Send Summary Now
            </Button>
            <p className="text-xs text-muted-foreground self-center">Runs automatically on the 1st — use this to send a manual preview.</p>
          </div>
        </CardContent>
      </Card>

      {/* Birthday Digest */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Cake className="w-5 h-5 text-primary" />
            Weekly Birthday Digest
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Every Monday at 8 AM, all pastoral staff receive an email listing members with birthdays in the next 14 days — each with a <strong>Send Greeting</strong> link that opens a pre-filled email draft.
          </p>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              variant="outline"
              className="gap-2"
              onClick={async () => {
                toast.loading('Sending digest now…', { id: 'digest' });
                const res = await base44.functions.invoke('weeklyBirthdayDigest', {});
                toast.dismiss('digest');
                const processed = res.data?.processed || [];
                if (processed.length === 0) {
                  toast.info('No upcoming birthdays found across active churches.');
                } else {
                  const total = processed.reduce((sum, c) => sum + c.birthdays, 0);
                  toast.success(`Digest sent! ${total} birthday${total !== 1 ? 's' : ''} across ${processed.length} church${processed.length !== 1 ? 'es' : ''}.`);
                }
              }}
            >
              <Send className="w-4 h-4" /> Send Digest Now
            </Button>
            <p className="text-xs text-muted-foreground">Runs automatically every Monday — use this to send a manual preview.</p>
          </div>
        </CardContent>
      </Card>

      {isChurchAdmin && <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite User
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Invite a new user to your church. They'll receive a branded email from <strong>{activeChurch?.name || 'your church'}</strong> with a link to log in and set their password.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Full name"
              className="flex-1"
            />
            <Input
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              type="email"
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={setInviteRole}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting} className="gap-2">
              <Send className="w-4 h-4" />
              {inviting ? 'Sending...' : 'Send Invite'}
            </Button>
          </div>
          {/* Extra Permissions */}
          <div className="mt-3">
            <p className="text-xs text-muted-foreground mb-2">Extra permissions (granted immediately on first login):</p>
            <div className="flex flex-wrap gap-2">
              {EXTRA_PERMISSIONS.map(perm => {
                const isMandatory = perm.value === 'manage_members';
                const checked = invitePermissions.includes(perm.value);
                return (
                  <button
                    key={perm.value}
                    type="button"
                    disabled={isMandatory}
                    onClick={() => !isMandatory && setInvitePermissions(prev =>
                      prev.includes(perm.value) ? prev.filter(p => p !== perm.value) : [...prev, perm.value]
                    )}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      checked
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/40'
                    } ${isMandatory ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                  >
                    {perm.label}{isMandatory && ' (auto)'}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">The invitation email will appear to come from {activeChurch?.name ? `"${activeChurch.name}"` : 'your church'} and includes a direct login link.</p>
        </CardContent>
      </Card>}

      <RolePermissionsChecklist isGlobalAdmin={isGlobalAdmin} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Users ({isGlobalAdmin ? users.length : churchUsers.length})
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    {isGlobalAdmin && <TableHead>Assigned Church</TableHead>}
                    <TableHead>Extra Access</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
            </TableHeader>
            <TableBody>
              {(isGlobalAdmin ? users : churchUsers).map(u => {
                const canEdit = canEditUserRole(u);
                const adminForChurches = isGlobalAdmin ? churches.filter(c => {
                  const emails = c.admin_emails || (c.admin_email ? [c.admin_email] : []);
                  return emails.includes(u.email);
                }) : [];
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      {canEdit ? (
                        <Select
                          value={u.role || 'user'}
                          onValueChange={(role) => updateRoleMutation.mutate({ id: u.id, role, userEmail: u.email, userName: u.full_name })}
                        >
                          <SelectTrigger className="h-7 text-xs w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {assignableRoles.map(r => (
                              <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className={roleBadge[u.role] || roleBadge.attendance_tracker}>
                          {(u.role || 'user').replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </TableCell>
                    {isGlobalAdmin && (
                      <TableCell>
                        <div className="flex flex-col gap-1 min-w-[180px]">
                          {/* Show all churches this user is admin of */}
                          {churches
                            .filter(c => {
                              const emails = c.admin_emails || (c.admin_email ? [c.admin_email] : []);
                              return emails.includes(u.email);
                            })
                            .map(c => (
                              <div key={c.id} className="flex items-center gap-1">
                                <Badge variant="outline" className="text-xs py-0 px-1.5">{c.name}</Badge>
                                {canEdit && (
                                  <button
                                    className="text-destructive/70 hover:text-destructive text-xs"
                                    title="Remove from church"
                                    onClick={() => assignChurchMutation.mutate({ userEmail: u.email, userName: u.full_name, churchId: c.id, action: 'remove' })}
                                  >✕</button>
                                )}
                              </div>
                            ))
                          }
                          {/* Add to another church */}
                          {canEdit && (
                            <Select
                              value="__none__"
                              onValueChange={(churchId) => churchId !== '__none__' && assignChurchMutation.mutate({ userEmail: u.email, userName: u.full_name, churchId, action: 'add' })}
                            >
                              <SelectTrigger className="h-6 text-xs w-36 border-dashed">
                                <SelectValue placeholder="+ Add church" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__" className="text-xs text-muted-foreground">+ Add to church…</SelectItem>
                                {churches
                                  .filter(c => {
                                    const emails = c.admin_emails || (c.admin_email ? [c.admin_email] : []);
                                    return !emails.includes(u.email);
                                  })
                                  .map(c => (
                                    <SelectItem key={c.id} value={c.id} className="text-xs">{c.name}</SelectItem>
                                  ))
                                }
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {isChurchAdmin && u.id !== user?.id && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5"
                          onClick={() => setPermissionsUser(u)}
                        >
                          <Settings2 className="w-3 h-3" />
                          {(u.extra_permissions?.length || 0) > 0
                            ? `${u.extra_permissions.length} granted`
                            : 'Set'}
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {canEdit && isChurchAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="w-7 h-7 text-destructive"
                          onClick={() => {
                            if (window.confirm(`Remove ${u.full_name || u.email}?`)) deleteUserMutation.mutate(u.id);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(isGlobalAdmin ? users : churchUsers).length === 0 && <TableRow><TableCell colSpan={isGlobalAdmin ? 5 : 4} className="text-center text-muted-foreground py-6">No users found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </Card>

        </TabsContent>}

        {/* SMS / Mass Texting Config — Church Admins only */}
        {isChurchAdmin && activeChurch && (
          <TabsContent value="sms" className="space-y-6">
            <SMSConfigTab church={activeChurch} onSaved={() => queryClient.invalidateQueries({ queryKey: ['churches'] })} />
          </TabsContent>
        )}

        {/* Form Integrations — Church Admins only */}
        {isChurchAdmin && (
          <TabsContent value="forms" className="space-y-6">
            <FormIntegrationsTab churchId={user?.church_id} />
          </TabsContent>
        )}

        {/* Custom Roles — Church Admins only */}
        {isChurchAdmin && (
          <TabsContent value="custom-roles" className="space-y-6">
            <CustomRoleBuilder churchId={user?.church_id} />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Account — visible to all users at bottom of profile tab */}
      <div className="pt-2">
        <Button
          variant="outline"
          className="gap-2 border-destructive/40 text-destructive hover:bg-destructive hover:text-white"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="w-4 h-4" /> Delete My Account
        </Button>
      </div>

      <UserPermissionsDialog
        user={permissionsUser}
        open={!!permissionsUser}
        onOpenChange={(v) => { if (!v) setPermissionsUser(null); }}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
      />

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Delete Account
            </DialogTitle>
            <DialogDescription>
              This will permanently delete your account and all associated data. This action <strong>cannot be undone</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deletingAccount}
              onClick={async () => {
                setDeletingAccount(true);
                await base44.entities.User.delete(user.id);
                base44.auth.logout();
              }}
            >
              {deletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}