const fs = require('fs');
let content = fs.readFileSync('src/api/base44Client.js', 'utf8');

// Fix common issues from pasting
content = content.replace(/\}const entities/g, '}\n\nconst entities');
content = content.replace(/\}if \(sortBy\)/g, '}\nif (sortBy)');
content = content.replace(/ascending:\!desc/g, 'ascending:!desc');
content = content.replace(/ascending:!desc/g, 'ascending:!desc');
content = content.replace(/\}async filter/g, '},\n\nasync filter');
content = content.replace(/\}async list/g, '},\n\nasync list');
content = content.replace(/\}async create/g, '},\n\nasync create');
content = content.replace(/\}async update/g, '},\n\nasync update');
content = content.replace(/\}async delete/g, '},\n\nasync delete');
content = content.replace(/\}async bulkCreate/g, '},\n\nasync bulkCreate');
content = content.replace(/\}\nsubscribe/g, '},\n\nsubscribe');

// Move imports to top
let lines = content.split('\n');
let importLines = lines.filter(l => l.trim().startsWith('import '));
let otherLines = lines.filter(l =>!l.trim().startsWith('import '));
let fixed = [...importLines, '',...otherLines].join('\n');

fs.writeFileSync('src/api/base44Client.js', fixed);
console.log('Fixed base44Client.js');
