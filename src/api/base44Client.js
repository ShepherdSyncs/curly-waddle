let currentChurchId = null;
let isGlobalAdmin = false;

import { supabase } from '../supabaseClient';

const entityTableMap = {
Church: 'churches',
ChurchMember: 'church_members',
AttendanceRecord: 'attendance_records',
GivingRecord: 'giving_records',
SpiritualRecord: 'spiritual_records',
MinistryGroup: 'ministry_groups',
MinistryGroupMember: 'ministry_group_members',
MinistrySchedule: 'ministry_schedules',
MinistryAttendance: 'ministry_attendance',
MinistryAnnouncement: 'ministry_announcements',
FollowUpTask: 'follow_up_tasks',
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
MemberProfile: 'member_profiles',
User: 'users',
ChurchInvitation: 'church_invitations',
ChurchSmsCredentials: 'church_sms_credentials',
CustomRole: 'custom_roles',
FormIntegration: 'form_integrations',
PaymentMethod: 'payment_methods',
Sermon: 'sermons',
GroupJoinRequest: 'group_join_requests',
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

async create(data) {
const { data: result, error } = await supabase.from(tableName).insert(data).select().single();
if (error) throw error;
return result;
},

async update(id, data) {
const { data: result, error } = await supabase.from(tableName).update(data).eq('id', id).select().single();
if (error) throw error;
return result;
},

async delete(id) {
const { data: result, error } = await supabase.from(tableName).delete().eq('id', id).select().single();
if (error) throw error;
return result;
},

async bulkCreate(records) {
const { data, error } = await supabase.from(tableName).insert(records).select();
if (error) throw error;
return data || [];
},

subscribe(callback) {
const channel = supabase.channel(`${tableName}-changes`).on('postgres_changes', { event: '*', schema: 'public', table: tableName }, callback).subscribe();
return channel;
},
};
}const entities = new Proxy({}, {
get(target, prop) {
const tableName = entityTableMap[prop];
if (tableName) {
return createEntityHandler(tableName);
}
console.warn(`Unknown entity: ${prop}, mapping to ${prop.toLowerCase()}s`);
return createEntityHandler(prop.toLowerCase() + 's');
}
});

const auth = {
async me() {
const { data: { user }, error } = await supabase.auth.getUser();
if (error) throw error;
if (!user) throw new Error('Not authenticated');
const { data: memberProfile } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle();
return {
id: user.id,
email: user.email,
full_name: user.user_metadata?.full_name || memberProfile?.full_name || user.email,
church_id: memberProfile?.church_id || user.user_metadata?.church_id,
role: memberProfile?.role || user.user_metadata?.role || 'member',
extra_permissions: memberProfile?.extra_permissions || [],...memberProfile,...user.user_metadata,
};
},

async isAuthenticated() {
const { data: { session } } = await supabase.auth.getSession();
return!!session;
},

async logout(returnUrl) {
await supabase.auth.signOut();
if (returnUrl) {
window.location.href = returnUrl;
}
},

async redirectToLogin(returnUrl) {
const currentUrl = returnUrl || window.location.href;
window.location.href = `/login?redirect=${encodeURIComponent(currentUrl)}`;
},

async updateMe(data) {
const { data: { user }, error } = await supabase.auth.updateUser({
data: data
});
if (error) throw error;
return user;
},
};

const functions = {
async invoke(functionName, params) {
console.warn(`Base44 function "${functionName}" called but not yet migrated to Supabase Edge Functions. Params:`, params);
switch (functionName) {
case 'sendChurchSMS':
case 'sendFollowUpAssignmentEmail':
case 'sendChurchAdminNotification':
case 'welcomeChurchAdmin':
case 'syncPastoralStaff':
case 'syncMyChurchId':
case 'fourWeekAbsenceAlert':
case 'flagInactiveMembers':
case 'monthlyAttendanceSummary':
case 'weeklyBirthdayDigest':
case 'ministryMailer':
case 'absenceFollowUp':
case 'ministryReminderSweep':
case 'createCheckoutSession':
case 'updateChurchTier':
case 'getMyGivingRecords':
case 'getHouseholdMessages':
case 'streamManager':
case 'inviteChurchUser':
case 'listPublicChurches':
case 'formWebhook':
throw new Error(`Function "${functionName}" needs to be implemented as a Supabase Edge Function`);
default:
throw new Error(`Unknown function: ${functionName}`);
}
},
};
const integrations = {
Core: {
async SendEmail(params) {
console.warn('SendEmail called - needs implementation with email service like Resend');
throw new Error('SendEmail needs to be implemented with an email provider');
},
async UploadFile({ file }) {
const fileName = `${Date.now()}-${file.name}`;
const { data, error } = await supabase.storage.from('uploads').upload(fileName, file);
if (error) throw error;
const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
return { file_url: urlData.publicUrl };
},
async ExtractDataFromUploadedFile(params) {
console.warn('ExtractDataFromUploadedFile called - needs custom implementation');
throw new Error('ExtractDataFromUploadedFile needs custom implementation');
},
async InvokeLLM(params) {
console.warn('InvokeLLM called - needs implementation with OpenAI/Claude API');
throw new Error('InvokeLLM needs to be implemented with an AI provider');
},
},
};

const agents = {
async listConversations({ agent_name }) {
const { data, error } = await supabase.from('ai_conversations').select('*').eq('agent_name', agent_name).order('created_at', { ascending: false });
if (error) throw error;
return data || [];
},

async createConversation(params) {
const { data, error } = await supabase.from('ai_conversations').insert({
agent_name: params.agent_name,
title: params.title || 'New Conversation',
messages: [],
}).select().single();
if (error) throw error;
return data;
},

async addMessage(conversation, message) {
const { data, error } = await supabase.from('ai_conversations').update({
messages: [...(conversation.messages || []), message],
}).eq('id', conversation.id).select().single();
if (error) throw error;
return data;
},

subscribeToConversation(conversationId, callback) {
const channel = supabase.channel(`conversation-${conversationId}`).on('postgres_changes', {
event: 'UPDATE',
schema: 'public',
table: 'ai_conversations',
filter: `id=eq.${conversationId}`,
}, callback).subscribe();
return channel;
},
};

export function setSupabaseContext({ churchId, globalAdmin }) {
currentChurchId = churchId;
isGlobalAdmin = globalAdmin;
}
export const base44 = {
entities,
auth,
functions,
integrations,
agents,
appId: '',
};
