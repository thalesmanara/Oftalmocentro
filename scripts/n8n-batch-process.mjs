#!/usr/bin/env node
/**
 * Process saved workflow JSON files: build ops and print manifest for MCP updates.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const workflowsDir = join(root, 'tmp', 'n8n-workflows');
const opsDir = join(root, 'tmp', 'n8n-ops');
const manifestPath = join(root, 'tmp', 'n8n-batch-manifest.json');

mkdirSync(opsDir, { recursive: true });

const ids = process.argv.slice(2);
const files = ids.length
  ? ids.map((id) => join(workflowsDir, `${id}.json`))
  : readdirSync(workflowsDir).filter((f) => f.endsWith('.json')).map((f) => join(workflowsDir, f));

const manifest = [];

for (const file of files) {
  if (!existsSync(file)) {
    const id = file.replace(/.*[\\/]/, '').replace('.json', '');
    manifest.push({ workflowId: id, error: 'Workflow JSON file not found' });
    continue;
  }

  const id = file.replace(/.*[\\/]/, '').replace('.json', '');
  try {
    const out = execSync(`node "${join(__dirname, 'n8n-tracking-ops.js')}" "${file}" --mcp`, {
      encoding: 'utf8',
      cwd: root,
    });
    const result = JSON.parse(out);
    const opsFile = join(opsDir, `${id}.json`);
    const opsData = existsSync(opsFile) ? JSON.parse(readFileSync(opsFile, 'utf8')) : { operations: [] };

    let name = '';
    try {
      const wf = JSON.parse(readFileSync(file, 'utf8'));
      name = wf.workflow?.name || wf.name || '';
    } catch (_) {}

    manifest.push({
      workflowId: id,
      name,
      opCount: opsData.operations?.length ?? result.ops?.length ?? 0,
      note: result.note,
      skip: Boolean(result.note) || (opsData.operations?.length ?? 0) === 0,
    });
  } catch (err) {
    manifest.push({ workflowId: id, error: String(err.message || err) });
  }
}

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
