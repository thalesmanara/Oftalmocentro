/**
 * Emits a single-line JSON for CallMcpTool-style args: {code, name, description, projectId}
 * Usage: node emit-mcp-call.mjs <workflow-file> [name] [description]
 */
import { readFileSync } from 'fs';

const file = process.argv[2];
const name = process.argv[3] || '';
const description = process.argv[4] || '';
const code = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
const out = {
  code,
  name: name || undefined,
  description: description || undefined,
  projectId: 'WbvMM1wAedTR9qrk',
};
// Print to stdout as JSON so parent can consume
process.stdout.write(JSON.stringify(out));
