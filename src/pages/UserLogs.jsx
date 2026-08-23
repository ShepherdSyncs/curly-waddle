import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Activity, Users, ChevronDown, ChevronUp, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
function formatEST(dateInput) {
  if (!dateInput) return '—';
  const d = new Date(dateInput);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric'
  });
}
import useAppUser from '@/hooks/useAppUser';
import UserActivityTimeline from '@/components/admin/UserActivityTimeline';

export default function UserLogs() {
  const { isGlobalAdmin } = useAppUser();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users-logs'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    enabled: isGlobalAdmin,
  });

  const { data: churches = [] } = useQuery({
    queryKey: ['churches-logs'],
    queryFn: () => base44.entities.Church.list(),
    enabled: isGlobalAdmin,
  });

  if (!isGlobalAdmin) {
    return <div className="p-8 text-center text-muted-foreground">Access denied.</div>;
  }

  const churchMap = Object.fromEntries(churches.map(c => [c.id, c.name]));

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const roleColor = {
    global_admin: 'bg-red-100 text-red-700',
    admin: 'bg-red-100 text-red-700',
    church_admin: 'bg-orange-100 text-orange-700',
    church_staff: 'bg-blue-100 text-blue-700',
    attendance_tracker: 'bg-purple-100 text-purple-700',
    user: 'bg-gray-100 text-gray-600',
  };

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  // Detail view
  if (selectedUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedUser(null)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-serif font-bold">{selectedUser.full_name || selectedUser.email}</h1>
            <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
          </div>
          <Badge className={`ml-2 border-0 ${roleColor[selectedUser.role] || 'bg-gray-100 text-gray-600'}`}>
            {selectedUser.role?.replace(/_/g, ' ') || 'user'}
          </Badge>
        </div>
        <UserActivityTimeline user={selectedUser} churchMap={churchMap} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-serif font-bold flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" /> User Logs
        </h1>
        <p className="text-sm text-muted-foreground mt-1">All registered users — click a user to view their activity</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{users.length}</p><p className="text-xs text-muted-foreground">Total Users</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{roleCounts['church_admin'] || 0}</p><p className="text-xs text-muted-foreground">Church Admins</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{(roleCounts['church_staff'] || 0) + (roleCounts['attendance_tracker'] || 0)}</p><p className="text-xs text-muted-foreground">Staff</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{roleCounts['user'] || 0}</p><p className="text-xs text-muted-foreground">Members</p></CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="global_admin">Global Admin</SelectItem>
            <SelectItem value="church_admin">Church Admin</SelectItem>
            <SelectItem value="church_staff">Church Staff</SelectItem>
            <SelectItem value="attendance_tracker">Attendance Tracker</SelectItem>
            <SelectItem value="user">Member</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No users found.</p>
            </div>
          )}
          {filtered.map(u => (
            <Card
              key={u.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedUser(u)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary flex-shrink-0">
                  {(u.full_name || u.email)?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.full_name || '(No name)'}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge className={`text-xs border-0 ${roleColor[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {u.role?.replace(/_/g, ' ') || 'user'}
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    Joined {formatEST(u.created_date)}
                  </span>
                  {u.church_id && (
                    <span className="text-xs text-muted-foreground hidden md:block">{churchMap[u.church_id] || ''}</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}