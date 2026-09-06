self.addEventListener('push', (event) => {
let data = { title: 'ShepherdSyncs', body: 'You have a new update.' };
if (event.data) { try { data = event.data.json(); } catch (e) { data.body = event.data.text(); } }
event.waitUntil(self.registration.showNotification(data.title, {
body: data.body,
icon: data.icon || '/favicon.ico',
data: { url: data.url || '/' }
}));
});

self.addEventListener('notificationclick', (event) => {
event.notification.close();
const url = event.notification.data?.url || '/';
event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
for (const c of list) { if (c.url === url && 'focus' in c) return c.focus(); }
return clients.openWindow(url);
}));
});
