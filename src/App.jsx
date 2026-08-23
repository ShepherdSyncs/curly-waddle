import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import Login from '@/pages/Login';

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

const MAIN_HOSTNAMES = new Set([
'shepherdsyncs.com',
'app.shepherdsyncs.com',
'admin.shepherdsyncs.com',
'www.shepherdsyncs.com',
'curly-waddle-alpha.vercel.app',
'localhost',
]);

function isSubdomain() {
const hostname = window.location.hostname;
if (MAIN_HOSTNAMES.has(hostname)) return false;
if (hostname.endsWith('.shepherdsyncs.com')) return true;
return false;
}

const PUBLIC_PATHS = ['/live', '/give', '/pray', '/portal', '/signup', '/kiosk', '/event-signup', '/login'];

const AuthenticatedApp = () => {
const { isLoadingAuth, authError, isAuthenticated, authChecked, navigateToLogin } = useAuth();

if (isLoadingAuth) {
return (<div className="fixed inset-0 flex items-center justify-center">
<div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
</div>);
}

if (authError && authError.type === 'auth_required') {
navigateToLogin();
return null;
}

if (authError && authError.type === 'user_not_registered') {
return <UserNotRegisteredError />;
}

if (authChecked &&!isAuthenticated) {
const path = window.location.pathname;
const isPublicRoute = PUBLIC_PATHS.some(p => path.startsWith(p)) || path.startsWith('/c/');
if (!isPublicRoute) {
navigateToLogin();
return null;
}
}

return (<Routes>
<Route path="/login" element={<Login />} />
<Route path="/c/:slug" element={<ChurchHome />} />
<Route path="/c/:slug/:section" element={<ChurchSubpage />} />
<Route path="/live" element={<PublicLiveStream />} />
<Route path="/give" element={<PublicGiving />} />
<Route path="/pray" element={<PublicPrayer />} />
<Route path="/portal" element={<ChurchPortal />} />
<Route path="/signup" element={<PublicSignup />} />
<Route path="/kiosk" element={<KioskMode />} />
<Route path="/event-signup" element={<PublicEventSignup />} />
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
</Routes>);
};

function App() {
if (isSubdomain()) {
return <SubdomainApp />;
}

return (<ThemeProvider>
<AuthProvider>
<QueryClientProvider client={queryClientInstance}>
<Router>
<AuthenticatedApp />
</Router>
<Toaster />
</QueryClientProvider>
</AuthProvider>
</ThemeProvider>)
}

export default App;