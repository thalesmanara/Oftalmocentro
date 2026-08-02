#!/usr/bin/env node
/**
 * Batch-generate update ops for all webhook workflow JSON files in tmp/n8n-workflows/
 * Usage: node scripts/n8n-batch-generate-ops.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WF_DIR = join(__dirname, '..', 'tmp', 'n8n-workflows');
const OPS_DIR = join(__dirname, '..', 'tmp', 'n8n-ops');
const SCRIPT = join(__dirname, 'n8n-tracking-ops.js');

mkdirSync(OPS_DIR, { recursive: true });

if (!existsSync(WF_DIR)) {
  console.error('Missing', WF_DIR);
  process.exit(1);
}

const files = readdirSync(WF_DIR).filter((f) => f.endsWith('.json'));
const summary = [];

for (const file of files) {
  const path = join(WF_DIR, file);
  try {
    execSync(`node "${SCRIPT}" "${path}" --mcp`, { stdio: 'inherit' });
    const id = file.replace('.json', '');
    const opsFile = join(OPS_DIR, `${id}.json`);
    if (existsSync(opsFile)) {
      const ops = JSON.parse(readFileSync(opsFile, 'utf8'));
      summary.push({ id, opCount: ops.operations?.length || 0, ok: true });
    } else {
      summary.push({ id, ok: false, error: 'ops file not created' });
    }
  } catch (e) {
    summary.push({ id: file.replace('.json', ''), ok: false, error: String(e.message || e) });
  }
}

writeFileSync(join(__dirname, '..', 'tmp', 'n8n-ops-summary.json'), JSON.stringify(summary, null, 2));
console.log('Summary:', JSON.stringify(summary, null, 2));
