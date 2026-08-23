import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../lib/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function Login() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
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
full_name: matchedMember.display_name || `${matchedMember.first_name || ''} ${matchedMember.last_name || ''}`.trim(),
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

