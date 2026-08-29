const fs = require('fs');
const content = `import { supabase } from '../supabaseClient';

let currentChurchId = null;
let isGlobalAdmin = false;

export function setSupabaseContext({ churchId, globalAdmin }) {
currentChurchId = churchId;
isGlobalAdmin = globalAdmin;
}

const entityTableMap = {
Church: 'churches',
User: 'users',
ChurchMember: 'church_members',
MemberProfile: 'member_profiles',
ChurchInvitation: 'church_invitations',
AttendanceRecord: 'attendance_records',
GivingRecord: 'giving_records',
SpiritualRecord: 'spiritual_records',
PaymentMethod: 'payment_methods',
MinistryGroup: 'ministry_groups',
MinistryGroupMember: 'ministry_group_members',
MinistrySchedule: 'ministry_schedules',
MinistryAttendance: 'ministry_attendance',
MinistryAnnouncement: 'ministry_announcements',
ChurchEvent: 'church_events',
EventRSVP: 'event_rsvps',
EventSignup: 'event_signups',
FamilyGroup: 'family_groups',
BibleStudy: 'bible_studies',
BibleStudyGuide: 'bible_study_guides',
ChurchChatMessage: 'church_chat_messages',
PastoralMessage: 'pastoral_messages',
LiveStream: 'live_streams',
StreamComment: 'stream_comments',
PrayerRequest: 'prayer_requests',
FollowUpTask: 'follow_up_tasks',
Sermon: 'sermons',
GroupJoinRequest: 'group_join_requests',
CustomRole: 'custom_roles',
FormIntegration: 'form_integrations',
ChurchSmsCredential: 'church_sms_credentials',
};

function createEntityHandler(tableName) {
return {
async filter(filters, sortBy, limit) {
let query = supabase.from(tableName).select('*');
if (filters) {
Object.entries(filters).forEach(([key, value]) => {
if (key === 'church_id' && isGlobalAdmin && currentChurchId === 'all') {
return;
}
if (value!== undefined && value!== null) {
query = query.eq(key, value);
}
});
}
if (sortBy) {
const desc = sortBy.startsWith('-');
const col = desc? sortBy.substring(1): sortBy;
query = query.order(col, { ascending:!desc });
}
if (limit) {
query = query.limit(limit);
}
const { data, error } = await query;
if (error) throw error;
return data || [];
},

async list(sortBy, limit) {
let query = supabase.from(tableName).select('*');
if (sortBy) {
const desc = sortBy.startsWith('-');
const col = desc? sortBy.substring(1): sortBy;
query = query.order(col, { ascending:!desc });
}
if (limit) {
query = query.limit(limit);
}
const { data, error } = await query;
if (error) throw error;
return data || [];
},

async create(record) {
const { data, error } = await supabase.from(tableName).insert(record).select().single();
if (error) throw error;
return data;
},

async update(id, record) {
const { data, error } = await supabase.from(tableName).update(record).eq('id', id).select().single();
if (error) throw error;
return data;
},

async delete(id) {
const { error } = await supabase.from(tableName).delete().eq('id', id);
if (error) throw error;
},

async bulkCreate(records) {
const { data, error } = await supabase.from(tableName).insert(records).select();
if (error) throw error;
return data || [];
},

subscribe(callback) {
const channel = supabase.channel(tableName + '-changes').on('postgres_changes', { event: '*', schema: 'public', table: tableName }, callback).subscribe();
return channel;
},
};
}

const entities = new Proxy({}, {
get(target, prop) {
const tableName = entityTableMap[prop];
if (tableName) {
return createEntityHandler(tableName);
}
console.warn('Unknown entity: ' + prop + ', mapping to ' + prop.toLowerCase() + 's');
return createEntityHandler(prop.toLowerCase() + 's');
},
});

const auth = {
async me() {
const { data: { session } } = await supabase.auth.getSession();
if (!session) return null;
const { data: profile } = await supabase.from('users').select('*').eq('email', session.user.email).maybeSingle();
return profile || session.user;
},
isAuthenticated() {
return supabase.auth.getSession().then(({ data: { session } }) =>!!session);
},
async logout() {
await supabase.auth.signOut();
},
redirectToLogin() {
window.location.href = '/login';
},
async updateMe(updates) {
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Not authenticated');
const { data, error } = await supabase.from('users').update(updates).eq('id', session.user.id).select().single();
if (error) throw error;
return data;
},
};

const functions = {
invoke(name, params) {
throw new Error('Function ' + name + ' needs to be implemented as a Supabase Edge Function');
},
};

const integrations = {
Core: {
UploadFile: {
async upload(file, path) {
const { data, error } = await supabase.storage.from('uploads').upload(path, file);
if (error) throw error;
const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path);
return { file_url: urlData.publicUrl };
},
},
SendEmail(params) {
throw new Error('SendEmail needs to be implemented as a Supabase Edge Function');
},
ExtractDataFromUploadedFile(params) {
throw new Error('ExtractDataFromUploadedFile needs to be implemented');
},
InvokeLLM(params) {
throw new Error('InvokeLLM needs to be implemented');
},
},
};

const agents = {
async createConversation(agentId, message) {
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Not authenticated');
const { data, error } = await supabase.from('ai_conversations').insert({
user_id: session.user.id,
agent_id: agentId,
messages: [{ role: 'user', content: message }],
}).select().single();
if (error) throw error;
return data;
},
};

export const base44 = {
entities,
auth,
functions,
integrations,
agents,
appId: '',
};

export default base44;
`;

fs.writeFileSync('src/api/base44Client.js', content);
console.log('base44Client.js rebuilt with email fix');
