import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';

export default function ResetPassword() {
const [password, setPassword] = useState('');
const [confirm, setConfirm] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);
const [success, setSuccess] = useState(false);
const navigate = useNavigate();

useEffect(() => {
supabase.auth.getSession().then(({ data: { session } }) => {
if (!session) navigate('/login');
});
}, [navigate]);

const handleSubmit = async (e) => {
e.preventDefault();
if (password!== confirm) { setError('Passwords do not match'); return; }
if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
setLoading(true);
setError('');
const { error } = await supabase.auth.updateUser({ password });
if (error) { setError(error.message); } else { setSuccess(true); setTimeout(() => navigate('/login'), 3000); }
setLoading(false);
};

if (success) {
return (<div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px', textAlign: 'center' }}>
<h2>Password Reset</h2>
<p>Your password has been updated. Redirecting to login...</p>
</div>);
}

return (<div style={{ maxWidth: '400px', margin: '100px auto', padding: '20px' }}>
<h2>Set New Password</h2>
<p style={{ color: '#666' }}>Enter your new password below.</p>
{error && <p style={{ color: 'red' }}>{error}</p>}
<form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="New password" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '8px' }} />
<input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required placeholder="Confirm password" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
<button type="submit" disabled={loading} style={{ width: '100%', padding: '10px', marginTop: '12px', background: '#0D1B2A', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
{loading? 'Saving...': 'Reset Password'}
</button>
</form>
<p style={{ marginTop: '16px' }}><Link to="/login" style={{ color: '#00B4D8' }}>Back to login</Link></p>
</div>);
}
