import React from 'react';
import { Button } from '@/components/ui/button';

export default class ErrorBoundary extends React.Component {
constructor(props) {
super(props);
this.state = { hasError: false, error: null, info: null };
}
static getDerivedStateFromError(error) {
return { hasError: true, error };
}
componentDidCatch(error, info) {
this.setState({ info });
console.error('ErrorBoundary caught:', error, info?.componentStack);
}
render() {
if (this.state.hasError) {
const stack = this.state.info?.componentStack || '';
const firstLine = stack.split('\n').find(l => l.trim()) || '';
return (<div style={{ padding: 32, maxWidth: 600, margin: '0 auto' }}>
<h2 style={{ color: '#dc2626', marginBottom: 8 }}>Something went wrong</h2>
<pre style={{ background: '#fef2f2', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 13, color: '#991b1b', whiteSpace: 'pre-wrap' }}>{this.state.error?.message}</pre>
<pre style={{ background: '#f8fafc', padding: 12, borderRadius: 8, overflow: 'auto', fontSize: 11, color: '#475569', marginTop: 12, whiteSpace: 'pre-wrap' }}>{firstLine}</pre>
<Button style={{ marginTop: 16 }} onClick={() => window.location.href = '/'}>Back to Dashboard</Button>
</div>);
}
return this.props.children;
}
}
