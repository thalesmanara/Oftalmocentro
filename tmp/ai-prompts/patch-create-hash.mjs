import { readFileSync, writeFileSync } from 'fs';

const p = new URL('./post-ai-prompts-create.workflow.js', import.meta.url);
let s = readFileSync(p, 'utf8');

if (s.includes("crypto.createHash('sha256')")) {
  console.log('Already patched');
  process.exit(0);
}

const marker = 'const newVersionNumber = Number(row.maxVersion || 0) + 1;\nreturn [{ json: {';
const replacement =
  "const newVersionNumber = Number(row.maxVersion || 0) + 1;\n" +
  "const crypto = require('crypto');\n" +
  "const contentHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');\n" +
  'return [{ json: {';

const normalized = s.replace(/\r\n/g, '\n');
if (!normalized.includes(marker)) {
  console.log('marker snippet nearby:', JSON.stringify(normalized.slice(normalized.indexOf('newVersionNumber'), normalized.indexOf('newVersionNumber') + 120)));
  throw new Error('marker not found');
}
s = normalized.replace(marker, replacement);

const basedMarker = '  basedOnVersionId,\n  userId,\n  requestId: norm.requestId,';
const basedRepl = '  basedOnVersionId,\n  contentHash,\n  userId,\n  requestId: norm.requestId,';
if (!s.includes(basedMarker)) throw new Error('basedOn marker not found');
s = s.replace(basedMarker, basedRepl);

const digestMarker = `encode(digest('" + esc(ctx.content) + "', 'sha256'), 'hex')`;
const digestRepl = `'" + esc(ctx.contentHash) + "'`;
if (!s.includes(digestMarker)) throw new Error('digest marker not found: ' + s.includes('encode(digest'));
s = s.replace(digestMarker, digestRepl);

writeFileSync(p, s);
console.log('OK: create workflow hashes in Code node');
