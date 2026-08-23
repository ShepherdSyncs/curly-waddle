import React, { useState } from 'react';
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
const { isAuthenticated } = useAuth();
const navigate = useNavigate();
const [searchParams] = useSearchParams();

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

if (matchedMember) {
churchId = matchedMember.church_id;
}
}

if (matchedMember) {
await supabase.from('users').insert({
id: data.user.id,
email: email,
full_name: matchedMember.display_name || (matchedMember.first_name || '') + ' ' + (matchedMember.last_name || ''),
church_id: matchedMember.church_id,
role: 'church_member',
status: 'active',
});
await supabase.from('church_members').update({ user_id: data.user.id }).eq('id', matchedMember.id);
setMessage('Account created and linked to your church.');
} else if (churchId) {
await supabase.from('users').insert({
id: data.user.id,
email: email,
full_name: email.split('@')[0],
church_id: churchId,
role: 'church_member',
status: 'pending',
});
setMessage('Account created and linked to your church. An admin will verify your membership.');
} else {
await supabase.from('users').insert({
id: data.user.id,
email: email,
full_name: email.split('@')[0],
role: 'church_member',
status: 'pending',
});
setMessage('Account created. No church match found. A church admin will review your account.');
}
}
} catch (err) {
setError(err.message);
} finally {
setLoading(false);
}
};

return (<div style={{ maxWidth: '400px', margin: '80px auto', padding: '20px' }}>
<h2 style={{ textAlign: 'center', marginBottom: '24px' }}>ShepherdSyncs</h2>
<h3 style={{ textAlign: 'center', marginBottom: '24px' }}>{isSignUp? 'Create Account': 'Sign In'}</h3>
{error && <div style={{ background: '#fee', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#c00' }}>{error}</div>}
{message && <div style={{ background: '#efe', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: '#060' }}>{message}</div>}
<form onSubmit={isSignUp? handleSignUp: handleLogin}>
<div style={{ marginBottom: '16px' }}>
<label style={{ display: 'block', marginBottom: '4px' }}>Email</label>
<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
</div>
<div style={{ marginBottom: '16px' }}>
<label style={{ display: 'block', marginBottom: '4px' }}>Password</label>
<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
</div>
{isSignUp && (<div style={{ marginBottom: '16px' }}>
<label style={{ display: 'block', marginBottom: '4px' }}>Phone (optional)</label>
<input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
</div>)}
<button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', background: '#00B4D8', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '16px' }}>
{loading? 'Please wait...': isSignUp? 'Create Account': 'Sign In'}
</button>
</form>
<p style={{ textAlign: 'center', marginTop: '16px' }}>
{isSignUp? 'Already have an account?': "Don't have an account?"}{' '}
<button onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: '#00B4D8', cursor: 'pointer', textDecoration: 'underline' }}>
{isSignUp? 'Sign In': 'Create Account'}
</button>
</p>
</div>);
}
export default Login;
