const fs = require('fs');
let content = fs.readFileSync('src/api/base44Client.js', 'utf8');
content = content.replace(".eq('id', session.user.id).maybeSingle()",
".eq('email', session.user.email).maybeSingle()");
fs.writeFileSync('src/api/base44Client.js', content);
console.log('Fixed auth.me to query by email');
