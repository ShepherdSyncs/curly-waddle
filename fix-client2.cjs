const fs = require('fs');
let content = fs.readFileSync('src/api/base44Client.js', 'utf8');
let lines = content.split('\n');

// Find and remove duplicate code block after filter method
let newLines = [];
let skipMode = false;
for (let i = 0; i < lines.length; i++) {
// Look for the pattern: after "return data || [];" and ",",
// if next line starts with "if (sortBy)" it's duplicate code
// Skip until we hit the "async list" method
if (i > 0 && lines[i-1].trim() === ',' && lines[i].trim().startsWith('if (sortBy)')) {
skipMode = true;
}
if (skipMode && lines[i].trim().startsWith('async list')) {
skipMode = false;
}
if (!skipMode) {
newLines.push(lines[i]);
}
}

fs.writeFileSync('src/api/base44Client.js', newLines.join('\n'));
console.log('Removed duplicate code');
