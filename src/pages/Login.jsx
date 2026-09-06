import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Login() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [phone, setPhone] = useState('');
const [isSignUp, setIsSignUp] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [message, setMessage] = useState('');
const [churchName, setChurchName] = useState(null);
const { isAuthenticated } = useAuth();
const navigate = useNavigate();
const [searchParams] = useSearchParams();

useEffect(() => {
const hostname = window.location.hostname;
const mains = ['shepherdsyncs.com', 'app.shepherdsyncs.com', 'admin.shepherdsyncs.com', 'www.shepherdsyncs.com', 'localhost', 'curly-waddle-alpha.vercel.app'];
if (!mains.includes(hostname) && hostname.endsWith('.shepherdsyncs.com')) {
const sub = hostname.split('.')[0].toLowerCase();
supabase.from('churches').select('name').eq('subdomain', sub).maybeSingle().then(({ data }) => {
if (data) setChurchName(data.name);
});
}
}, []);

useEffect(() => {
document.documentElement.style.background = '#F8F9FA';
document.body.style.background = '#F8F9FA';
document.body.style.color = '#111827';
return () => {
document.documentElement.style.background = '';
document.body.style.background = '';
document.body.style.color = '';
};
}, []);

if (isAuthenticated) {
const redirect = searchParams.get('redirect') || '/';
navigate(redirect);
return null;
}

const handleLogin = async (e) => {
e.preventDefault();
setLoading(true);
setError('');
try {
const { error } = await supabase.auth.signInWithPassword({ email, password });
if (error) throw error;
const redirect = searchParams.get('redirect') || '/';
navigate(redirect);
} catch (err) {
setError(err.message);
} finally {
setLoading(false);
}
};

const handleSignUp = async (e) => {
e.preventDefault();
setLoading(true);
setError('');
setMessage('');
try {
const { data, error } = await supabase.auth.signUp({
email,
password,
options: { data: { full_name: email.split('@')[0] } },
});
if (error) throw error;
if (data.user) {
let churchId = null;
let matchedMember = null;

const hostname = window.location.hostname;
const MAIN_HOSTNAMES = ['shepherdsyncs.com', 'app.shepherdsyncs.com', 'admin.shepherdsyncs.com', 'www.shepherdsyncs.com', 'localhost', 'curly-waddle-alpha.vercel.app'];
const isSubdomain =!MAIN_HOSTNAMES.includes(hostname) && hostname.endsWith('.shepherdsyncs.com');

if (isSubdomain) {
const subdomain = hostname.split('.')[0].toLowerCase();
const { data: churchMatch } = await supabase.from('churches').select('id, name').eq('subdomain', subdomain).maybeSingle();
if (churchMatch) {
churchId = churchMatch.id;
}
}

if (churchId) {
const { data: emailMatch } = await supabase.from('church_members').select('id, church_id, first_name, last_name, display_name').eq('email', email).eq('church_id', churchId).maybeSingle();
matchedMember = emailMatch;
if (!matchedMember && phone) {
const cleanPhone = phone.replace(/\D/g, '');
if (cleanPhone.length >= 7) {
const { data: phoneMatches } = await supabase.from('church_members').select('id, church_id, first_name, last_name, display_name, phone').eq('church_id', churchId).not('phone', 'is', null);
matchedMember = phoneMatches?.find(m => m.phone && m.phone.replace(/\D/g, '') === cleanPhone) || null;
}
}
} else {
const { data: emailMatch } = await supabase.from('church_members').select('id, church_id, first_name, last_name, display_name').eq('email', email).maybeSingle();
matchedMember = emailMatch;
if (!matchedMember && phone) {
const cleanPhone = phone.replace(/\D/g, '');
if (cleanPhone.length >= 7) {
const { data: phoneMatches } = await supabase.from('church_members').select('id, church_id, first_name, last_name, display_name, phone').not('phone', 'is', null);
matchedMember = phoneMatches?.find(m => m.phone && m.phone.replace(/\D/g, '') === cleanPhone) || null;
}
}
if (matchedMember) { churchId = matchedMember.church_id; }
}

if (matchedMember) {
await supabase.from('users').insert({ id: data.user.id, email, full_name: matchedMember.display_name || (matchedMember.first_name || '') + ' ' + (matchedMember.last_name || ''), church_id: matchedMember.church_id, role: 'church_member', status: 'active' });
await supabase.from('church_members').update({ user_id: data.user.id }).eq('id', matchedMember.id);
setMessage('Account created and linked to your church.');
} else if (churchId) {
await supabase.from('users').insert({ id: data.user.id, email, full_name: email.split('@')[0], church_id: churchId, role: 'church_member', status: 'pending' });
setMessage('Account created and linked to your church. An admin will verify your membership.');
} else {
await supabase.from('users').insert({ id: data.user.id, email, full_name: email.split('@')[0], role: 'church_member', status: 'pending' });
setMessage('Account created. No church match found. A church admin will review your account.');
}
}
} catch (err) { setError(err.message); } finally { setLoading(false); }
};

const welcomeText = churchName? 'Welcome to ' + churchName + ' Utilizing ShepherdSyncs': 'Welcome to ShepherdSyncs';

return (<div style={{ minHeight: '100vh', background: '#F8F9FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
<div style={{ maxWidth: '440px', width: '100%', padding: '40px 32px', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', margin: '20px' }}>
<img src="/logo.png" alt="ShepherdSyncs" style={{ display: 'block', margin: '0 auto 24px', height: '80px' }} />
<h2 style={{ textAlign: 'center', marginBottom: '6px', fontSize: '22px', color: '#0D1B2A', fontWeight: '700' }}>{welcomeText}</h2>
<h3 style={{ textAlign: 'center', marginBottom: '28px', color: '#6B7280', fontWeight: '400', fontSize: '16px' }}>{isSignUp? 'Create Account': 'Sign In'}</h3>
{error && <div style={{ background: '#FEF2F2', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#B91C1C', fontSize: '14px' }}>{error}</div>}
{message && <div style={{ background: '#F0FDF4', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#166534', fontSize: '14px' }}>{message}</div>}
<form onSubmit={isSignUp? handleSignUp: handleLogin}>
<div style={{ marginBottom: '16px' }}>
<label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '500' }}>Email</label>
<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', fontSize: '15px', boxSizing: 'border-box' }} />
</div>
<div style={{ marginBottom: '16px' }}>
<label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '500' }}>Password</label>
<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', fontSize: '15px', boxSizing: 'border-box' }} />
</div>
{isSignUp && (<div style={{ marginBottom: '16px' }}>
<label style={{ display: 'block', marginBottom: '6px', color: '#374151', fontSize: '14px', fontWeight: '500' }}>Phone (optional)</label>
<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', color: '#111827', fontSize: '15px', boxSizing: 'border-box' }} />
</div>)}
<button type="submit" disabled={loading} style={{ width: '100%', padding: '11px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' }}>
{loading? 'Please wait...': isSignUp? 'Create Account': 'Sign In'}
</button>
</form>
<p style={{ textAlign: 'center', marginTop: '20px', color: '#6B7280', fontSize: '14px' }}>
{isSignUp? 'Already have an account?': "Don't have an account?"}{' '}
<button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: '#00B4D8', cursor: 'pointer', fontWeight: '500', padding: 0 }}>
{isSignUp? 'Sign In': 'Create Account'}
</button>
</p>
{!isSignUp && <p style={{ textAlign: 'center', marginTop: '8px', fontSize: '14px' }}><a href="/forgot-password" style={{ color: '#00B4D8', textDecoration: 'none' }}>Forgot Password?</a></p>}
</div>
</div>);
}
