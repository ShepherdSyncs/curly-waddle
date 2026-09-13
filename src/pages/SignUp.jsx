import { useState } from 'react';
import { supabase } from '@/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function SignUp() {
const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [loading, setLoading] = useState(false);
const [sent, setSent] = useState(false);

const handleSignUp = async (e) => {
e.preventDefault();
if (!email ||!password) { toast.error('Please fill in all fields'); return; }
setLoading(true);
try {
const { error } = await supabase.auth.signUp({ email, password });
if (error) throw error;
setSent(true);
toast.success('Check your email to confirm your account');
} catch (err) {
toast.error(err.message || 'Sign up failed');
} finally {
setLoading(false);
}
};

if (sent) return (<div className="min-h-screen flex items-center justify-center bg-background">
<div className="max-w-md w-full text-center p-8">
<h1 className="text-2xl font-bold mb-2">Check your email</h1>
<p className="text-muted-foreground">We sent a confirmation link to {email}. Click it to activate your account.</p>
<a href="/login" className="text-primary underline mt-4 inline-block">Back to login</a>
</div>
</div>);

return (<div className="min-h-screen flex items-center justify-center bg-background">
<div className="max-w-md w-full p-8">
<h1 className="text-2xl font-bold text-center mb-2">Create your account</h1>
<p className="text-muted-foreground text-center mb-6">Start managing your church with ShepherdSyncs</p>
<form onSubmit={handleSignUp} className="space-y-4">
<div className="space-y-2">
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@church.org" required />
</div>
<div className="space-y-2">
<Label htmlFor="password">Password</Label>
<Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a password" required minLength={6} />
</div>
<Button type="submit" className="w-full" disabled={loading}>{loading? 'Creating...': 'Sign Up'}</Button>
</form>
<p className="text-sm text-muted-foreground text-center mt-4">Already have an account? <a href="/login" className="text-primary underline">Log in</a></p>
</div>
</div>);
}
