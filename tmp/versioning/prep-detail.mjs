import fs from 'fs';
const code = fs.readFileSync(new URL('./get-version-detail.workflow.js', import.meta.url), 'utf8');
fs.writeFileSync(new URL('./detail-for-mcp.json', import.meta.url), JSON.stringify({ code }));
console.log('written', code.length);
