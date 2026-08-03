/**
 * Decode base64 workflow source and write plain code to stdout / file for MCP.
 * Usage: node mcp-from-b64.mjs post-ai-prompts-publish
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = dirname(fileURLToPath(import.meta.url));
const key = process.argv[2];
const b64 = readFileSync(join(dir, `_b64-${key}.txt`), 'utf8').trim();
const code = Buffer.from(b64, 'base64').toString('utf8');
writeFileSync(join(dir, `_code-${key}.js`), code);
console.log(JSON.stringify({ ok: true, key, length: code.length, head: code.slice(0, 60) }));
