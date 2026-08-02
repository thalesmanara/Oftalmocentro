import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node submit-n8n-create.mjs <list|detail>');
  process.exit(1);
}
const file = arg === 'list' ? 'for-mcp-list.json' : 'for-mcp-detail.json';
const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
fs.writeFileSync(path.join(dir, `submit-${arg}-payload.json`), JSON.stringify(payload));
console.log(JSON.stringify({ file, codeLen: payload.code.length, name: payload.name }));
