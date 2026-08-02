import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const files = [
  'auditoria-registrar.workflow.js',
  'get-audit-list.workflow.js',
  'get-audit-detail.workflow.js',
];

const out = {};
for (const f of files) {
  const code = readFileSync(join(dir, f), 'utf8');
  out[f] = { code, len: code.length };
}
writeFileSync(join(dir, 'workflow-codes.json'), JSON.stringify(out));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,v.len]))));
