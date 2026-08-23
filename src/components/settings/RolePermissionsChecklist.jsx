import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ROLES = [
  { value: 'global_admin', label: 'Global Admin', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'church_admin', label: 'Church Admin', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'ministry_staff', label: 'Ministry Staff', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'church_staff', label: 'Church Staff', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'attendance_tracker', label: 'Attendance Tracker', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'user', label: 'Church Member', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
];

const PERMISSIONS = [
  { label: 'View Dashboard & Analytics', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff'] },
  { label: 'Manage Members (add/edit)', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff'] },
  { label: 'Delete Records', roles: ['global_admin', 'church_admin'] },
  { label: 'Track Attendance', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker'] },
  { label: 'Record Giving (Tithes & Offerings)', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff'] },
  { label: 'View All Giving Records', roles: ['global_admin', 'church_admin', 'ministry_staff']},
  { label: 'Log Spiritual Records (Baptism, Holy Ghost)', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff'] },
  { label: 'Create & Manage Ministry Groups', roles: ['global_admin', 'church_admin', 'ministry_staff'] },
  { label: 'Manage Users Within Ministry Groups', roles: ['global_admin', 'church_admin', 'ministry_staff'] },
  { label: 'Send Ministry Announcements', roles: ['global_admin', 'church_admin', 'ministry_staff'] },
  { label: 'Manage Ministry Schedules', roles: ['global_admin', 'church_admin', 'ministry_staff'] },
  { label: 'Invite New Users', roles: ['global_admin', 'church_admin'] },
  { label: 'Assign Church Staff / Attendance Tracker Roles', roles: ['global_admin', 'church_admin'] },
  { label: 'Assign Ministry Staff Role', roles: ['global_admin', 'church_admin'] },
  { label: 'Assign Church Admin Role', roles: ['global_admin', 'church_admin'] },
  { label: 'Manage Church Settings & Payment Methods', roles: ['global_admin', 'church_admin'] },
  { label: 'Access Bible Study, Study Guides & Companion', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker'] },
  { label: 'Access Church Chat', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker'] },
  { label: 'Contact Pastoral Team (always available)', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker', 'user'] },
  { label: 'Submit Prayer Requests', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker', 'user'] },
  { label: 'View Personal Giving History', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker', 'user'] },
  { label: 'View Events & RSVP', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker', 'user'] },
  { label: 'Access Live Stream', roles: ['global_admin', 'church_admin', 'ministry_staff', 'church_staff', 'attendance_tracker', 'user'] },
  { label: 'Manage Churches (Global Admin only)', roles: ['global_admin'] },
];

export default function RolePermissionsChecklist({ isGlobalAdmin = false }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRoles = isGlobalAdmin ? ROLES : ROLES.filter(r => r.value !== 'global_admin');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Access Level Permissions
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(v => !v)} className="gap-1">
            {expanded ? <><ChevronUp className="w-4 h-4" /> Collapse</> : <><ChevronDown className="w-4 h-4" /> View All</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Role legend */}
        <div className="flex flex-wrap gap-2">
          {visibleRoles.map(r => (
            <Badge key={r.value} className={`text-xs ${r.color}`}>{r.label}</Badge>
          ))}
        </div>

        {/* Quick summary cards */}
        <div className="grid md:grid-cols-2 gap-3">
          {visibleRoles.map(role => (
            <div key={role.value} className="p-3 rounded-lg bg-muted/40 border space-y-1">
              <Badge className={`text-xs ${role.color}`}>{role.label}</Badge>
              <ul className="text-xs text-muted-foreground space-y-0.5 mt-1">
                {PERMISSIONS.filter(p => p.roles.includes(role.value)).slice(0, expanded ? undefined : 4).map(p => (
                  <li key={p.label} className="flex items-start gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                    {p.label}
                  </li>
                ))}
                {!expanded && PERMISSIONS.filter(p => p.roles.includes(role.value)).length > 4 && (
                  <li className="text-primary cursor-pointer" onClick={() => setExpanded(true)}>
                    +{PERMISSIONS.filter(p => p.roles.includes(role.value)).length - 4} more…
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Full permissions table */}
        {expanded && (
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground min-w-[200px]">Permission</th>
                  {visibleRoles.map(r => (
                    <th key={r.value} className="py-2 px-2 text-center font-medium">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-xs ${r.color}`}>{r.label.split(' ')[0]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {PERMISSIONS.map(p => (
                  <tr key={p.label} className="hover:bg-muted/20">
                    <td className="py-2 pr-3 text-foreground">{p.label}</td>
                    {visibleRoles.map(r => (
                      <td key={r.value} className="py-2 px-2 text-center">
                        {p.roles.includes(r.value)
                          ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                          : <XCircle className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}