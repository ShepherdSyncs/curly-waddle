
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { setSupabaseContext } from '@/api/base44Client';
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
const [user, setUser] = useState(null);
const [isAuthenticated, setIsAuthenticated] = useState(false);
const [isLoadingAuth, setIsLoadingAuth] = useState(true);
const [authError, setAuthError] = useState(null);
const [authChecked, setAuthChecked] = useState(false);
const [selectedChurchId, setSelectedChurchId] = useState(null);
const [availableChurches, setAvailableChurches] = useState([]);

useEffect(() => {
checkUserAuth();
const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
if (session) {
loadUserProfile(session.user);
} else {
setUser(null);
setIsAuthenticated(false);
}
});
return () => subscription.unsubscribe();
}, []);

useEffect(() => {
if (user) {
const isGA = user.role === 'global_admin';
let churchId;
if (isGA &&!selectedChurchId) {
churchId = 'all';
} else {
churchId = selectedChurchId || user.church_id || null;
}
setSupabaseContext({
churchId,
globalAdmin: isGA,
});
}
}, [user, selectedChurchId]);

const loadAllChurches = async () => {
const { data } = await supabase.from('churches').select('id, name, subdomain').order('name');
setAvailableChurches(data || []);
};
useEffect(() => {
if (user) {
setSupabaseContext({
churchId: selectedChurchId || user.church_id || null,
globalAdmin: user.role === 'global_admin',
});
}
}, [user, selectedChurchId]);

const loadUserProfile = async (authUser) => {
try {
const { data: profile } = await supabase.from('users').select('*').eq('email', authUser.email).maybeSingle();
setUser({
id: authUser.id,
email: authUser.email,
full_name: authUser.user_metadata?.full_name || authUser.email,
church_id: profile?.church_id || authUser.user_metadata?.church_id,
role: profile?.role || authUser.user_metadata?.role || 'member',
extra_permissions: profile?.extra_permissions || [],...profile,
});
setIsAuthenticated(true);
if (profile?.role === 'global_admin' &&!selectedChurchId && profile?.church_id) {
setSelectedChurchId(profile.church_id);
} else if (profile?.church_id) {
setSelectedChurchId(profile.church_id);
}
} catch (error) {
console.error('Error loading user profile:', error);
setUser({
id: authUser.id,
email: authUser.email,
full_name: authUser.user_metadata?.full_name || authUser.email,
});
setIsAuthenticated(true);
}
};

const switchChurch = (churchId) => {
setSelectedChurchId(churchId);
};

const getEffectiveChurchId = () => {
if (user?.role === 'global_admin') {
return selectedChurchId || null;
}
return user?.church_id || null;
};

const checkUserAuth = async () => {
try {
setIsLoadingAuth(true);
const { data: { session } } = await supabase.auth.getSession();
if (session) {
await loadUserProfile(session.user);
} else {
setUser(null);
setIsAuthenticated(false);
}
} catch (error) {
console.error('Auth check failed:', error);
setAuthError({ type: 'unknown', message: error.message });
setIsAuthenticated(false);
} finally {
setIsLoadingAuth(false);
setAuthChecked(true);
}
};

const logout = (shouldRedirect = true) => {
supabase.auth.signOut();
setUser(null);
setIsAuthenticated(false);
setSelectedChurchId(null);
if (shouldRedirect) {
window.location.href = '/login';
}
};

const navigateToLogin = (returnUrl) => {
const url = returnUrl? `/login?redirect=${encodeURIComponent(returnUrl)}`: '/login';
window.location.href = url;
};

return (<AuthContext.Provider value={{
user,
isAuthenticated,
isLoadingAuth,
isLoadingPublicSettings: false,
authError,
appPublicSettings: null,
authChecked,
logout,
navigateToLogin,
checkUserAuth,
selectedChurchId,
availableChurches,
switchChurch,
getEffectiveChurchId,
isGlobalAdmin: user?.role === 'global_admin',
}}>
{children}
</AuthContext.Provider>);
};

export const useAuth = () => {
const context = useContext(AuthContext);
if (!context) {
throw new Error('useAuth must be used within an AuthProvider');
}
return context;
};
