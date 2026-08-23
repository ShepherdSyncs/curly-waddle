const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const crypto = require('crypto');

const supabaseUrl = 'https://nzodqfzbowhyrnuauzzr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im56b2RxZnpib3doeXJudWF1enpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MDU2OTMsImV4cCI6MjEwMjk4MTY5M30.kIFNgPa9ZEYJYuwBLgXYDKMFcCwJHGLnTIcfN3NXYgQ';
const supabase = createClient(supabaseUrl, supabaseKey);

const rawData = JSON.parse(fs.readFileSync('./shepherd-syncs-export-2026-08-23.json', 'utf8'));

const idMap = {};

function toUUID(oldId) {
if (!oldId) return null;
if (idMap[oldId]) return idMap[oldId];
const newId = crypto.randomUUID();
idMap[oldId] = newId;
return newId;
}

function toSnakeCase(str) {
return str.replace(/([A-Z])/g, '_$1').toLowerCase();
}

function mapRecord(record, fieldMap) {
const mapped = {};
for (const [key, value] of Object.entries(record)) {
const snakeKey = toSnakeCase(key);
if (fieldMap && fieldMap[snakeKey] === null) continue;
if (fieldMap && fieldMap[snakeKey]) {
mapped[fieldMap[snakeKey]] = value;
} else {
mapped[snakeKey] = value;
}
}
return mapped;
}

async function insertBatch(table, records) {
if (!records || records.length === 0) {
console.log(`Skipping ${table}: no records`);
return;
}
const batchSize = 50;
for (let i = 0; i < records.length; i += batchSize) {
const batch = records.slice(i, i + batchSize);
const { data, error } = await supabase.from(table).insert(batch).select();
if (error) {
console.error(`Error inserting ${table} batch ${i}:`, error.message);
} else {
console.log(`Inserted ${table}: ${i + batch.length} / ${records.length}`);
}
}
}

async function migrate() {
console.log('Starting migration...');
console.log('Found entities:', Object.keys(rawData));

// 1. Churches
console.log('\nMigrating churches...');
const churches = (rawData.churches || []).map(r => {
const id = toUUID(r.id);
return {
id,
old_id: r.id,
name: r.name,
subdomain: r.subdomain,
status: r.status || 'active',
city: r.city,
state: r.state,
address: r.address,
phone: r.phone,
email: r.email,
pastor_name: r.pastor_name,
logo_url: r.logo_url,
church_code: r.church_code,
slug: r.slug,
sms_enabled: r.sms_enabled || false,
sms_provider: r.sms_provider,
twilio_account_sid: r.twilio_account_sid,
twilio_auth_token: r.twilio_auth_token,
twilio_from_number: r.twilio_from_number,
livestream_enabled: r.livestream_enabled || false,
ai_chat_enabled: r.ai_chat_enabled || false,
ai_chat_description: r.ai_chat_description,
online_giving_url: r.online_giving_url,
online_giving_platform: r.online_giving_platform,
subscription_status: r.subscription_status,
subscription_tier: r.subscription_tier,
billing_cycle: r.billing_cycle,
subscription_started_at: r.subscription_started_at,
trial_days: r.trial_days,
trial_start_date: r.trial_start_date,
trial_end_date: r.trial_end_date,
admin_email: r.admin_email,
admin_emails: r.admin_emails || [],
stripe_customer_id: r.stripe_customer_id,
stripe_subscription_id: r.stripe_subscription_id,
is_sample: r.is_sample || false,
created_by: r.created_by,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
};
});
const { data: existingChurches } = await supabase.from('churches').select('subdomain');
const existingSubdomains = new Set((existingChurches || []).map(c => c.subdomain));
const newChurches = churches.filter(c =>!existingSubdomains.has(c.subdomain));
await insertBatch('churches', newChurches);

// 2. Users
console.log('\nMigrating users...');
const users = (rawData.users || []).map(r => {
const id = toUUID(r.id);
return {
id,
old_id: r.id,
email: r.email,
full_name: r.full_name || r.email?.split('@')[0],
church_id: r.church_id? toUUID(r.church_id): null,
role: r.role || 'church_member',
extra_permissions: r.extra_permissions || [],
status: 'active',
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
};
});
const { data: existingUsers } = await supabase.from('users').select('email');
const existingEmails = new Set((existingUsers || []).map(u => u.email));
const newUsers = users.filter(u =>!existingEmails.has(u.email));
await insertBatch('users', newUsers);

// 3. Church Members
console.log('\nMigrating church_members...');
const churchMembers = (rawData.churchMembers || rawData.church_members || []).map(r => {
const id = toUUID(r.id);
return {
id,
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
user_id: r.user_id? toUUID(r.user_id): null,
first_name: r.first_name,
last_name: r.last_name,
email: r.email,
phone: r.phone,
address: r.address,
status: r.status || 'active',
display_name: r.display_name,
show_in_directory: r.show_in_directory!== false,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
};
});
await insertBatch('church_members', churchMembers);

// 4. Member Profiles
console.log('\nMigrating member_profiles...');
const memberProfiles = (rawData.memberProfiles || rawData.member_profiles || []).map(r => {
const id = toUUID(r.id);
return {
id,
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
user_email: r.user_email,
display_name: r.display_name,
phone: r.phone,
address: r.address,
show_in_directory: r.show_in_directory!== false,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
};
});
await insertBatch('member_profiles', memberProfiles);
// 5. Attendance Records
console.log('\nMigrating attendance_records...');
const attendanceRecords = (rawData.attendanceRecords || rawData.attendance_records || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
member_id: r.member_id? toUUID(r.member_id): null,
date: r.date,
present: r.present || false,
age_group: r.age_group,
member_email: r.member_email,
created_by_id: r.created_by_id,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('attendance_records', attendanceRecords);

// 6. Giving Records
console.log('\nMigrating giving_records...');
const givingRecords = (rawData.givingRecords || rawData.giving_records || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
member_id: r.member_id? toUUID(r.member_id): null,
date: r.date,
amount: r.amount,
fund: r.fund || r.fund_type,
payment_method: r.payment_method,
member_email: r.member_email,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('giving_records', givingRecords);

// 7. Spiritual Records
console.log('\nMigrating spiritual_records...');
const spiritualRecords = (rawData.spiritualRecords || rawData.spiritual_records || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
member_id: r.member_id? toUUID(r.member_id): null,
date: r.date,
type: r.type,
notes: r.notes,
member_email: r.member_email,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('spiritual_records', spiritualRecords);

// 8. Ministry Groups
console.log('\nMigrating ministry_groups...');
const ministryGroups = (rawData.ministryGroups || rawData.ministry_groups || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
name: r.name,
description: r.description,
is_active: r.is_active!== false,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('ministry_groups', ministryGroups);

// 9. Ministry Group Members
console.log('\nMigrating ministry_group_members...');
const ministryGroupMembers = (rawData.ministryGroupMembers || rawData.ministry_group_members || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
group_id: r.group_id? toUUID(r.group_id): null,
member_email: r.member_email,
display_name: r.display_name,
member_role: r.member_role || r.role || 'member',
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('ministry_group_members', ministryGroupMembers);

// 10. Ministry Schedules
console.log('\nMigrating ministry_schedules...');
const ministrySchedules = (rawData.ministrySchedules || rawData.ministry_schedules || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
group_id: r.group_id? toUUID(r.group_id): null,
date: r.date,
assignees: r.assignees || [],
assignee_emails: r.assignee_emails || [],
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('ministry_schedules', ministrySchedules);

// 11. Ministry Attendance
console.log('\nMigrating ministry_attendance...');
const ministryAttendance = (rawData.ministryAttendance || rawData.ministry_attendance || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
schedule_id: r.schedule_id? toUUID(r.schedule_id): null,
present: r.present || false,
date: r.date,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('ministry_attendance', ministryAttendance);

// 12. Ministry Announcements
console.log('\nMigrating ministry_announcements...');
const ministryAnnouncements = (rawData.ministryAnnouncements || rawData.ministry_announcements || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
group_id: r.group_id? toUUID(r.group_id): null,
church_id: r.church_id? toUUID(r.church_id): null,
content: r.content || r.message,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('ministry_announcements', ministryAnnouncements);

// 13. Church Events
console.log('\nMigrating church_events...');
const churchEvents = (rawData.churchEvents || rawData.church_events || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
title: r.title,
description: r.description,
date: r.date,
end_date: r.end_date,
location: r.location,
is_published: r.is_published || false,
enable_signup_form: r.enable_signup_form || false,
rsvp_count: r.rsvp_count || 0,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('church_events', churchEvents);

// 14. Event RSVPs
console.log('\nMigrating event_rsvps...');
const eventRsvps = (rawData.eventRSVPs || rawData.event_rsvps || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
event_id: r.event_id? toUUID(r.event_id): null,
member_email: r.member_email,
status: r.status,
created_at: r.created_date || new Date().toISOString(),
}));
await insertBatch('event_rsvps', eventRsvps);

// 15. Event Signups
console.log('\nMigrating event_signups...');
const eventSignups = (rawData.eventSignups || rawData.event_signups || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
event_id: r.event_id? toUUID(r.event_id): null,
name: r.name,
email: r.email,
phone: r.phone,
notes: r.notes,
created_at: r.created_date || new Date().toISOString(),
}));
await insertBatch('event_signups', eventSignups);

// 16. Family Groups
console.log('\nMigrating family_groups...');
const familyGroups = (rawData.familyGroups || rawData.family_groups || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
name: r.name,
members: r.members || [],
member_emails: r.member_emails || [],
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('family_groups', familyGroups);

// 17. Bible Studies
console.log('\nMigrating bible_studies...');
const bibleStudies = (rawData.bibleStudies || rawData.bible_studies || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
title: r.title,
description: r.description,
date: r.date,
status: r.status || 'draft',
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('bible_studies', bibleStudies);

// 18. Bible Study Guides
console.log('\nMigrating bible_study_guides...');
const bibleStudyGuides = (rawData.bibleStudyGuides || rawData.bible_study_guides || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
title: r.title,
content: r.content,
file_url: r.file_url,
status: r.status || 'pending',
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('bible_study_guides', bibleStudyGuides);

// 19. Prayer Requests
console.log('\nMigrating prayer_requests...');
const prayerRequests = (rawData.prayerRequests || rawData.prayer_requests || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
email: r.email || r.member_email,
content: r.content || r.request,
status: r.status || 'active',
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('prayer_requests', prayerRequests);

// 20. Follow Up Tasks
console.log('\nMigrating follow_up_tasks...');
const followUpTasks = (rawData.followUpTasks || rawData.follow_up_tasks || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
member_id: r.member_id? toUUID(r.member_id): null,
assigned_to: r.assigned_to,
task: r.task || r.description,
status: r.status || 'pending',
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('follow_up_tasks', followUpTasks);
// 21. Sermons
console.log('\nMigrating sermons...');
const sermons = (rawData.sermons || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
title: r.title,
description: r.description,
date: r.date,
video_url: r.video_url,
speaker: r.speaker || r.pastor_name,
is_published: r.is_published!== false,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('sermons', sermons);

// 22. Live Streams
console.log('\nMigrating live_streams...');
const liveStreams = (rawData.liveStreams || rawData.live_streams || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
title: r.title,
description: r.description,
stream_key: r.stream_key,
stream_url: r.stream_url,
thumbnail_url: r.thumbnail_url,
destination_urls: r.destination_urls || [],
is_archived: r.is_archived || false,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('live_streams', liveStreams);

// 23. Stream Comments
console.log('\nMigrating stream_comments...');
const streamComments = (rawData.streamComments || rawData.stream_comments || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
stream_id: r.stream_id? toUUID(r.stream_id): null,
church_id: r.church_id? toUUID(r.church_id): null,
user_email: r.user_email,
content: r.content || r.message,
created_at: r.created_date || new Date().toISOString(),
}));
await insertBatch('stream_comments', streamComments);

// 24. Pastoral Messages
console.log('\nMigrating pastoral_messages...');
const pastoralMessages = (rawData.pastoralMessages || rawData.pastoral_messages || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
sender_email: r.sender_email || r.from_email,
subject: r.subject,
content: r.content || r.message,
created_at: r.created_date || new Date().toISOString(),
}));
await insertBatch('pastoral_messages', pastoralMessages);

// 25. Church Chat Messages
console.log('\nMigrating church_chat_messages...');
const churchChatMessages = (rawData.churchChatMessages || rawData.church_chat_messages || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
group_id: r.group_id? toUUID(r.group_id): null,
sender_email: r.sender_email,
content: r.content || r.message,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('church_chat_messages', churchChatMessages);

// 26. Church Invitations
console.log('\nMigrating church_invitations...');
const churchInvitations = (rawData.churchInvitations || rawData.church_invitations || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
church_name: r.church_name,
user_email: r.user_email || r.email,
status: r.status || 'pending',
created_at: r.created_date || new Date().toISOString(),
}));
await insertBatch('church_invitations', churchInvitations);

// 27. Custom Roles
console.log('\nMigrating custom_roles...');
const customRoles = (rawData.customRoles || rawData.custom_roles || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
name: r.name,
permissions: r.permissions || [],
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('custom_roles', customRoles);

// 28. Form Integrations
console.log('\nMigrating form_integrations...');
const formIntegrations = (rawData.formIntegrations || rawData.form_integrations || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
type: r.type,
config: r.config || {},
webhook_token: r.webhook_token,
is_active: r.is_active!== false,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('form_integrations', formIntegrations);

// 29. Church SMS Credentials
console.log('\nMigrating church_sms_credentials...');
const churchSmsCredentials = (rawData.churchSmsCredentials || rawData.church_sms_credentials || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
provider: r.provider || 'twilio',
account_sid: r.account_sid || r.twilio_account_sid,
auth_token: r.auth_token || r.twilio_auth_token,
from_number: r.from_number || r.twilio_from_number,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('church_sms_credentials', churchSmsCredentials);

// 30. Payment Methods
console.log('\nMigrating payment_methods...');
const paymentMethods = (rawData.paymentMethods || rawData.payment_methods || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
name: r.name,
is_active: r.is_active!== false,
sort_order: r.sort_order || 0,
created_at: r.created_date || new Date().toISOString(),
updated_at: r.updated_date || new Date().toISOString(),
}));
await insertBatch('payment_methods', paymentMethods);

// 31. Group Join Requests
console.log('\nMigrating group_join_requests...');
const groupJoinRequests = (rawData.groupJoinRequests || rawData.group_join_requests || []).map(r => ({
id: toUUID(r.id),
old_id: r.id,
church_id: r.church_id? toUUID(r.church_id): null,
group_id: r.group_id? toUUID(r.group_id): null,
user_email: r.user_email || r.email,
status: r.status || 'pending',
created_at: r.created_date || new Date().toISOString(),
}));
await insertBatch('group_join_requests', groupJoinRequests);

console.log('\nMigration complete!');
console.log('ID mappings saved for reference.');
}

migrate().catch(console.error);