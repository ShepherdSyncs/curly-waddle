import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

const CHURCH_KEY = 'active_church_id';

export default function useAppUser() {
  const [user, setUser] = useState(null);
  const [myChurches, setMyChurches] = useState([]);
  const [activeChurch, setActiveChurch] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      try {
        const me = await base44.auth.me();
        if (!me) { setLoading(false); return; }

        const isGlobalAdmin = me.role === 'global_admin' || me.role === 'admin';
        const isChurchAdmin = me.role === 'church_admin';
        const hadChurchIdOnRecord = !!me.church_id;

        if (isGlobalAdmin || isChurchAdmin) {
          const allChurches = await base44.entities.Church.list();
          const adminChurches = isGlobalAdmin
            ? allChurches
            : allChurches.filter(c =>
                (c.admin_emails && c.admin_emails.includes(me.email)) ||
                c.admin_email === me.email
              );

          setMyChurches(adminChurches);

          if (adminChurches.length > 0) {
            const savedId = sessionStorage.getItem(CHURCH_KEY);
            const active = adminChurches.find(c => c.id === savedId) || adminChurches[0];
            me.church_id = active.id;
            me.church_name = active.name;
          }
        } else if (!me.church_id) {
          // regular user — look up church by membership
          const invitations = await base44.entities.ChurchInvitation.filter({ user_email: me.email, status: 'verified' });
          if (invitations.length > 0) {
            me.church_id = invitations[0].church_id;
            const churches = await base44.entities.Church.filter({ id: invitations[0].church_id });
            if (churches.length > 0) me.church_name = churches[0].name;
          }
        } else if (me.church_id && !me.church_name) {
          const churches = await base44.entities.Church.filter({ id: me.church_id });
          if (churches.length > 0) me.church_name = churches[0].name;
        }

        setUser(me);

        // Self-heal: if church_id wasn't actually persisted on this account yet,
        // sync it in the background so future loads (and church-scoped permission
        // checks) don't have to re-derive it every time.
        if (!isGlobalAdmin) {
          base44.functions.invoke('syncMyChurchId', {}).catch(() => {});
        }
      } catch (e) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    loadUser();
  }, []);

  useEffect(() => {
    if (!user?.church_id) { setActiveChurch(null); return; }
    const found = myChurches.find(c => c.id === user.church_id);
    if (found) { setActiveChurch(found); return; }
    base44.entities.Church.filter({ id: user.church_id })
      .then(res => { if (res?.length) setActiveChurch(res[0]); })
      .catch(() => {});
  }, [user?.church_id, myChurches]);

  const switchChurch = useCallback((church) => {
    const role = user?.role;
    const isGlobal = role === 'global_admin' || role === 'admin';
    const isChurchAdm = role === 'church_admin';
    if (!isGlobal && !isChurchAdm) return;
    if (isChurchAdm && !myChurches.some(c => c.id === church.id)) return;
    sessionStorage.setItem(CHURCH_KEY, church.id);
    setUser(prev => ({ ...prev, church_id: church.id, church_name: church.name }));
  }, [user?.role, myChurches]);

  const isGlobalAdmin = user?.role === 'global_admin' || user?.role === 'admin';
  const isChurchAdmin = user?.role === 'church_admin' || isGlobalAdmin;
  const isMinistryStaff = user?.role === 'ministry_staff' || isChurchAdmin;
  const isStaff = user?.role === 'church_staff' || isMinistryStaff;
  const isTracker = user?.role === 'attendance_tracker' || isStaff;
  const isChurchUser = user?.role === 'user' || isTracker;

  // Check if user has a specific extra permission granted by admin.
  // Global admins and church admins have ALL permissions — no restrictions.
  const hasPermission = (perm) => {
    if (isGlobalAdmin || isChurchAdmin) return true;
    return (user?.extra_permissions || []).includes(perm);
  };

  // Check if user has a custom role permission (for custom roles created by church admins)
  const hasCustomPermission = (perm, customRoles = []) => {
    if (isGlobalAdmin || isChurchAdmin) return true;
    return customRoles
      .filter(r => (r.assigned_user_emails || []).includes(user?.email))
      .some(r => (r.permissions || []).includes(perm));
  };

  // Returns the merged attendance rooms this user is restricted to (empty = no restriction)
  const allowedAttendanceRooms = (customRoles = []) => {
    if (isGlobalAdmin || isChurchAdmin || isMinistryStaff || isStaff) return []; // no restriction
    const userRoles = customRoles.filter(r => (r.assigned_user_emails || []).includes(user?.email));
    if (userRoles.length === 0) return [];
    const rooms = userRoles.flatMap(r => r.attendance_rooms || []);
    return [...new Set(rooms)];
  };

  // Returns the merged visible age groups for this user (empty = no restriction = see all)
  const allowedAgeGroups = (customRoles = []) => {
    if (isGlobalAdmin || isChurchAdmin || isMinistryStaff || isStaff) return []; // no restriction
    const userRoles = customRoles.filter(r => (r.assigned_user_emails || []).includes(user?.email));
    if (userRoles.length === 0) return [];
    const groups = userRoles.flatMap(r => r.member_age_groups || []);
    return [...new Set(groups)];
  };

  return { user, loading, isGlobalAdmin, isChurchAdmin, isMinistryStaff, isStaff, isTracker, isChurchUser, myChurches, switchChurch, hasPermission, hasCustomPermission, allowedAttendanceRooms, allowedAgeGroups, activeChurch };
}