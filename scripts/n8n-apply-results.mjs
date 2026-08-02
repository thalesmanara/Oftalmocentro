#!/usr/bin/env node
/**
 * Apply all pending workflow ops via n8n MCP HTTP (uses Cursor remote MCP session cookies unavailable).
 * Instead: read ops files and write shell commands manifest for assistant MCP apply.
 * Also records results when --record id status versionId is passed.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const resultsPath = join(root, 'tmp', 'n8n-apply-results.json');

const args = process.argv.slice(2);
if (args[0] === '--record' && args[1] && args[2]) {
  mkdirSync(join(root, 'tmp'), { recursive: true });
  const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
  results.push({
    workflowId: args[1],
    status: args[2],
    versionId: args[3] || null,
    error: args[4] || null,
    at: new Date().toISOString(),
  });
  writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  process.exit(0);
}

const queuePath = join(root, 'tmp', 'n8n-apply-queue.json');
const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
const pending = queue.filter((q) => q.status === 'pending');

const manifest = pending.map((q) => {
  const opsFile = join(opsDir, `${q.workflowId}.json`);
  const ops = existsSync(opsFile) ? JSON.parse(readFileSync(opsFile, 'utf8')) : null;
  return {
    workflowId: q.workflowId,
    name: q.name,
    opCount: ops?.operations?.length ?? 0,
    hasOps: Boolean(ops?.operations?.length),
  };
});

writeFileSync(join(root, 'tmp', 'n8n-apply-manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
