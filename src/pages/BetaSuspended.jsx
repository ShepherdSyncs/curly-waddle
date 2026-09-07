import React from 'react';
import { AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function BetaSuspended() {
return (<div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
<div className="max-w-md text-center space-y-6">
<div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
<AlertTriangle className="w-8 h-8 text-amber-600" />
</div>
<div>
<h1 className="text-2xl font-bold mb-2">Access Suspended</h1>
<p className="text-muted-foreground leading-relaxed">
Your ShepherdSyncs beta access has been paused because your monthly feedback was not submitted.
</p>
<p className="text-muted-foreground leading-relaxed mt-3">
As a beta partner, monthly feedback is required to keep your account active. This helps us understand how ShepherdSyncs is serving your church and what we can improve.
</p>
</div>
<div className="bg-white rounded-xl border p-6 space-y-3">
<p className="font-semibold">To restore your access:</p>
<p className="text-sm text-muted-foreground">
Contact our team and request reinstatement. We will review and respond as quickly as possible.
</p>
<Button className="w-full" asChild>
<a href="mailto:sales@shepherdsyncs.com?subject=Beta Access Reinstatement Request">
<Mail className="w-4 h-4 mr-2" />
Contact sales@shepherdsyncs.com
</a>
</Button>
</div>
<p className="text-xs text-muted-foreground">
ShepherdSyncs values every beta church. We look forward to hearing from you.
</p>
</div>
</div>);
}
