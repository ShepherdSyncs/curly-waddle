Last login: Sun Aug 23 15:10:22 on ttys000
bthompson@Brads-MacBook-Air ~ % touch src/pages/Login.jsx
touch: src/pages/Login.jsx: No such file or directory
bthompson@Brads-MacBook-Air ~ % cd "/Users/bthompson/Library/CloudStorage/OneDrive-NewLifeChristianAcademy/ShepherdSyncs/shepherdsync-main"
bthompson@Brads-MacBook-Air shepherdsync-main % touch src/pages/Login.jsx
bthompson@Brads-MacBook-Air shepherdsync-main % open -a TextEdit src/pages/Login.jsx
bthompson@Brads-MacBook-Air shepherdsync-main % cat src/App.jsx
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

import SubdomainApp from '@/components/SubdomainApp';
import AppLayout from '@/components/layout/AppLayout';
import Dashboard from '@/pages/Dashboard';
import Churches from '@/pages/Churches';
import Members from '@/pages/Members';
import Attendance from '@/pages/Attendance';
import Giving from '@/pages/Giving';
import SpiritualRecords from '@/pages/SpiritualRecords';
import BibleStudy from '@/pages/BibleStudy';
import Settings from '@/pages/Settings';
import Analytics from '@/pages/Analytics';
import LiveStreamAdmin from '@/pages/LiveStreamAdmin';
import PublicLiveStream from '@/pages/PublicLiveStream';
import PublicGiving from '@/pages/PublicGiving';
import UserPortal from '@/pages/UserPortal';
import BibleStudyGuides from '@/pages/BibleStudyGuides';
import PrayerRequests from '@/pages/PrayerRequests';
import PublicPrayer from '@/pages/PublicPrayer';
import Events from '@/pages/Events';
import SermonArchive from '@/pages/SermonArchive';
import MemberDirectory from '@/pages/MemberDirectory';
import MinistryGroups from '@/pages/MinistryGroups';
import MyMinistrySchedule from '@/pages/MyMinistrySchedule';
import ChurchPortal from '@/pages/ChurchPortal';
import PublicSignup from '@/pages/PublicSignup';
import VerifyMembers from '@/pages/VerifyMembers';
import KioskMode from '@/pages/KioskMode';
import PublicEventSignup from '@/pages/PublicEventSignup';
import UserLogs from '@/pages/UserLogs';
import FollowUpTasks from '@/pages/FollowUpTasks';
import MassTexting from '@/pages/MassTexting';
import ChurchHome from '@/pages/ChurchHome';
import ChurchSubpage from '@/pages/ChurchSubpage';
import ChurchChat from '@/pages/ChurchChat';
import BibleStudyCompanion from '@/pages/BibleStudyCompanion';
import ContactPastoral from '@/pages/ContactPastoral';
import Pricing from '@/pages/Pricing';
import ServiceSchedule from '@/pages/ServiceSchedule';
import Profile from '@/pages/Profile';

// Synchronous hostname check — runs before any auth context mounts
const MAIN_HOSTNAMES = new Set([
  'shepherdsyncs.com',
  'app.shepherdsyncs.com',
  'admin.shepherdsyncs.com',
  'www.shepherdsyncs.com',
  'base44.app',
  'localhost',
]);

function isSubdomain() {
  const hostname = window.location.hostname;
  if (MAIN_HOSTNAMES.has(hostname)) return false;
  if (hostname.endsWith('.base44.app')) return false;
  if (hostname.endsWith('.base44.link')) return false;
  return true;
}

const PUBLIC_PATHS = ['/live', '/give', '/pray', '/portal', '/signup', '/kiosk', '/event-signup'];

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, authChecked, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  // App is public mode — still require login for non-public routes
  if (authChecked && !isAuthenticated) {
    const path = window.location.pathname;
    const isPublicRoute = PUBLIC_PATHS.some(p => path.startsWith(p)) || path.startsWith('/c/');
    if (!isPublicRoute) {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      {/* Church subdomain-style routes */}
      <Route path="/c/:slug" element={<ChurchHome />} />
      <Route path="/c/:slug/:section" element={<ChurchSubpage />} />

      {/* Public routes — no login required */}
      <Route path="/live" element={<PublicLiveStream />} />
      <Route path="/give" element={<PublicGiving />} />
      <Route path="/pray" element={<PublicPrayer />} />
      <Route path="/portal" element={<ChurchPortal />} />
      <Route path="/signup" element={<PublicSignup />} />
      <Route path="/kiosk" element={<KioskMode />} />
      <Route path="/event-signup" element={<PublicEventSignup />} />

      {/* Authenticated app routes */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/churches" element={<Churches />} />
        <Route path="/members" element={<Members />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/giving" element={<Giving />} />
        <Route path="/spiritual" element={<SpiritualRecords />} />
        <Route path="/bible-study" element={<BibleStudy />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/livestream" element={<LiveStreamAdmin />} />
        <Route path="/study-guides" element={<BibleStudyGuides />} />
        <Route path="/my" element={<UserPortal />} />
        <Route path="/prayer" element={<PrayerRequests />} />
        <Route path="/events" element={<Events />} />
        <Route path="/sermons" element={<SermonArchive />} />
        <Route path="/directory" element={<MemberDirectory />} />
        <Route path="/ministry" element={<MinistryGroups />} />
        <Route path="/my-schedule" element={<MyMinistrySchedule />} />
        <Route path="/verify-members" element={<VerifyMembers />} />
        <Route path="/user-logs" element={<UserLogs />} />
        <Route path="/follow-up" element={<FollowUpTasks />} />
        <Route path="/mass-texting" element={<MassTexting />} />
        <Route path="/chat" element={<ChurchChat />} />
        <Route path="/study-companion" element={<BibleStudyCompanion />} />
        <Route path="/contact-pastoral" element={<ContactPastoral />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/schedule" element={<ServiceSchedule />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  // Bypass all auth for church subdomains — render public landing page directly
  if (isSubdomain()) {
    return <SubdomainApp />;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App%                                                             bthompson@Brads-MacBook-Air shepherdsync-main % open -a TextEdit app.jsx
The file /Users/bthompson/Library/CloudStorage/OneDrive-NewLifeChristianAcademy/ShepherdSyncs/shepherdsync-main/app.jsx does not exist.
bthompson@Brads-MacBook-Air shepherdsync-main % open -a TextEdit src/App.jsx
bthompson@Brads-MacBook-Air shepherdsync-main % git add.
git: 'add.' is not a git command. See 'git --help'.

The most similar command is
	add
bthompson@Brads-MacBook-Air shepherdsync-main % git add .
bthompson@Brads-MacBook-Air shepherdsync-main % git commit -m "migrated auth and data layer from base44 to supabase"

[main 7e53cf8] migrated auth and data layer from base44 to supabase
 5 files changed, 533 insertions(+), 262 deletions(-)
 create mode 100644 src/api/base44Client.js.backup
 create mode 100644 src/pages/Login.jsx
bthompson@Brads-MacBook-Air shepherdsync-main % git push
Enumerating objects: 18, done.
Counting objects: 100% (18/18), done.
Delta compression using up to 8 threads
Compressing objects: 100% (10/10), done.
Writing objects: 100% (10/10), 5.62 KiB | 5.62 MiB/s, done.
Total 10 (delta 5), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (5/5), completed with 5 local objects.
To https://github.com/ShepherdSyncs/curly-waddle.git
   bd35893..7e53cf8  main -> main
bthompson@Brads-MacBook-Air shepherdsync-main % cat.env
zsh: command not found: cat.env
bthompson@Brads-MacBook-Air shepherdsync-main % cat .env
VITE_SUPABASE_URL=https://nzodqfzbowhyrnuauzzr.supabase.co/rest/v1/>.env

echo VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b2RxZnpib3doeXJudWF1enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU2OTMsImV4cCI6MjEwMjk4MTY5M30.kIFNgPa9ZEYJYuwBLgXYDKMFcCwJHGLnTIcfN3NXYgQ
bthompson@Brads-MacBook-Air shepherdsync-main % echo 'VITE_SUPABASE_URL=https://nzodqfzbowhyrnuauzzr.supabase.co' >.env
bthompson@Brads-MacBook-Air shepherdsync-main % echo 'VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b2RxZnpib3doeXJudWF1enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU2OTMsImV4cCI6MjEwMjk4MTY5M30.kIFNgPa9ZEYJYuwBLgXYDKMFcCwJHGLnTIcfN3NXYgQ' >>.env
bthompson@Brads-MacBook-Air shepherdsync-main % cat .env
VITE_SUPABASE_URL=https://nzodqfzbowhyrnuauzzr.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b2RxZnpib3doeXJudWF1enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU2OTMsImV4cCI6MjEwMjk4MTY5M30.kIFNgPa9ZEYJYuwBLgXYDKMFcCwJHGLnTIcfN3NXYgQ
bthompson@Brads-MacBook-Air shepherdsync-main % touch vercel.json
bthompson@Brads-MacBook-Air shepherdsync-main % open -a TextEdit vercel.json
bthompson@Brads-MacBook-Air shepherdsync-main % git add.
git commit -m "added vercel.json for client-side routing"
git push

git: 'add.' is not a git command. See 'git --help'.

The most similar command is
	add
On branch main
Your branch is up to date with 'origin/main'.

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	vercel.json

nothing added to commit but untracked files present (use "git add" to track)
Everything up-to-date
bthompson@Brads-MacBook-Air shepherdsync-main % git add .
bthompson@Brads-MacBook-Air shepherdsync-main % git commit -m "added vercel.json for client-side routing"
[main d93d02d] added vercel.json for client-side routing
 1 file changed, 5 insertions(+)
 create mode 100644 vercel.json
bthompson@Brads-MacBook-Air shepherdsync-main % git push
Enumerating objects: 4, done.
Counting objects: 100% (4/4), done.
Delta compression using up to 8 threads
Compressing objects: 100% (3/3), done.
Writing objects: 100% (3/3), 364 bytes | 364.00 KiB/s, done.
Total 3 (delta 1), reused 0 (delta 0), pack-reused 0 (from 0)
remote: Resolving deltas: 100% (1/1), completed with 1 local object.
To https://github.com/ShepherdSyncs/curly-waddle.git
   7e53cf8..d93d02d  main -> main
bthompson@Brads-MacBook-Air shepherdsync-main % touch src/lib/roles.js
bthompson@Brads-MacBook-Air shepherdsync-main % open -a TextEdit src/lib/roles.js
bthompson@Brads-MacBook-Air shepherdsync-main % >....                           
chat: [ROLES.GLOBAL_ADMIN, ROLES.CHURCH_ADMIN, ROLES.MINISTRY_STAFF, ROLES.CHURCH_STAFF],
view_directory: [ROLES.GLOBAL_ADMIN, ROLES.CHURCH_ADMIN, ROLES.MINISTRY_STAFF, ROLES.CHURCH_STAFF, ROLES.CHURCH_MEMBER],
};

export function hasPermission(userRole, permission) {  
if (!userRole ||!PERMISSIONS[permission]) return false;
return PERMISSIONS[permission].includes(userRole);
}

export function isGlobalAdmin(userRole) {
return userRole === ROLES.GLOBAL_ADMIN;
}

export function isChurchAdmin(userRole) {
return userRole === ROLES.CHURCH_ADMIN;
}

export function isAdmin(userRole) {                                       
return userRole === ROLES.GLOBAL_ADMIN || userRole === ROLES.CHURCH_ADMIN;
}

