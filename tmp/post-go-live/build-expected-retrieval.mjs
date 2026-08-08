import { readFileSync, writeFileSync } from 'fs';

const src = 'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/f1b5c231-e84c-4e2c-80c1-4b92f111777d.txt';
const wf = JSON.parse(readFileSync(src, 'utf8')).workflow;
const q = String(wf.nodes.find((n) => n.name === 'Buscar chunks relevantes').parameters.query);

const ANCHOR = [
  '  WHERE d.deleted_at IS NULL',
  "    AND COALESCE(dv.processing_status, d.processing_status) = 'processed'",
].join('\n');

const REPLACEMENT = [
  '  WHERE d.deleted_at IS NULL',
  '    AND COALESCE(d.is_active, TRUE) = TRUE',
  '    AND (',
  '      COALESCE(dv.expiration_date, d.expiration_date) IS NULL',
  '      OR COALESCE(dv.expiration_date, d.expiration_date) >= CURRENT_DATE',
  '    )',
  "    AND COALESCE(dv.processing_status, d.processing_status) = 'processed'",
].join('\n');

const count = q.split(ANCHOR).length - 1;
if (count !== 1) throw new Error(`anchor found ${count} times`);

const patched = q.replace(ANCHOR, REPLACEMENT);
writeFileSync('tmp/post-go-live/_expected-retrieval-query.txt', patched, 'utf8');
console.log('original starts with "=":', q.startsWith('='));
console.log('original length:', q.length, 'patched length:', patched.length);
console.log('--- patched WHERE block ---');
const i = patched.indexOf('  WHERE d.deleted_at');
console.log(patched.slice(i, i + 620));
