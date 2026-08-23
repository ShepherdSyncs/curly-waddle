const fs = require('fs');
let content = fs.readFileSync('src/api/base44Client.js', 'utf8');
content = content.replace(/desc\? sortBy/g, 'desc? sortBy');
content = content.replace(/ascending:!desc/g, 'ascending:!desc');
fs.writeFileSync('src/api/base44Client.js', content);
console.log('Fixed');
