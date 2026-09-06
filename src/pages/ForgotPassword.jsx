import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';

export default function ForgotPassword() {
const [email, setEmail] = useState('');
const [sent, setSent] = useState(false);
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const handleSubmit = async (e) => {
e.preventDefault();
setLoading(true);
setError('');
const { error } = await supabase.auth.resetPasswordForEmail(email, {
redirectTo: window.location.origin + '/reset-password',
});
if (error) { setError(error.message); } else { setSent(true); }
setLoading(false);
};

if (sent) {
return (<div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
<div style={{ textAlign: 'center', marginBottom: '20px' }}>
<Mail style={{ width: '48px', height: '48px', color: '#00B4D8', margin: '0 auto' }} />
</div>
<h2 style={{ textAlign: 'center' }}>Check your email</h2>
<p style={{ color: '#666', textAlign: 'center' }}>We sent a password reset link to <strong>{email}</strong>. Click it to set a new password.</p>
<p style={{ marginTop: '16px', textAlign: 'center' }}><Link to="/login" style={{ color: '#00B4D8' }}>Back to login</Link></p>
</div>);
}

return (<div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
<h2>Forgot Password</h2>
<p style={{ color: '#666' }}>Enter your email and we'll send you a link to reset your password.</p>
{error && <p style={{ color: 'red' }}>{error}</p>}
<form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Your email" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
<button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', marginTop: '12px', background: '#0D1B2A', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
{loading? 'Sending...': 'Send Reset Link'}
</button>
</form>
<p style={{ marginTop: '16px' }}><Link to="/login" style={{ color: '#00B4D8', display: 'flex', alignItems: 'center', gap: '4px' }}><ArrowLeft style={{ width: '14px', height: '14px' }} />Back to login</Link></p>
</div>);
}
