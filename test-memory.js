import fs from 'fs';
const text = fs.readFileSync('test.csv', 'utf8');
const rows = text.split('\n');
console.log(rows.length);
