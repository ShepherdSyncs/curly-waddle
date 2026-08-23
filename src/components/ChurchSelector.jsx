import React from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function ChurchSelector() {
const { user, availableChurches, selectedChurchId, switchChurch, isGlobalAdmin } = useAuth();

if (!isGlobalAdmin) return null;

const containerStyle = {
padding: '8px 16px',
background: '#0D1B2A',
borderBottom: '1px solid #1B3A5C',
display: 'flex',
alignItems: 'center',
gap: '12px',
};

const labelStyle = {
color: '#C4CED8',
fontSize: '13px',
fontWeight: 600,
};

const selectStyle = {
padding: '6px 12px',
borderRadius: '6px',
border: '1px solid #1B3A5C',
background: '#1B2838',
color: '#F8F9FA',
fontSize: '14px',
minWidth: '220px',
};

const badgeStyle = {
background: '#00B4D8',
color: '#fff',
padding: '2px 8px',
borderRadius: '4px',
fontSize: '11px',
fontWeight: 700,
};

return (<div style={containerStyle}>
<span style={badgeStyle}>ADMIN</span>
<span style={labelStyle}>Viewing:</span>
<select
style={selectStyle}
value={selectedChurchId || 'all'}
onChange={(e) => switchChurch(e.target.value === 'all'? null: e.target.value)}
>
<option value="all">All Churches</option>
{availableChurches.map((church) => (<option key={church.id} value={church.id}>
{church.name}
</option>))}
</select>
</div>);
}

