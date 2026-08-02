#!/usr/bin/env node
/**
 * Read saved workflow JSON files, build tracking ops, write per-workflow ops files.
 * Usage: node scripts/n8n-apply-all-tracking.mjs [workflowId ...]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const workflowsDir = join(root, 'tmp', 'n8n-workflows');
const opsDir = join(root, 'tmp', 'n8n-ops');
const resultsPath = join(root, 'tmp', 'n8n-tracking-results.json');

mkdirSync(opsDir, { recursive: true });

const ALL_IDS = [
  'OJZNWxBCkVXaysmf', '8EXk5RkFW5cxnenL', 'ukDndCZDzemWsOMk', 'vymsco8fVdIvgW4b',
  'vNDpCzOdR7ATnHDP', 'sofpi7zCHMCJkvfI', 'Y0MuWEEdoMFts7ay', 'WLlD1eqbFmKDK9ow',
  '0ieW448wLfITZSlD', 'T6CGZB4oxlzXlTQZ', 'ZckYIZpMtw6HEtIs', 'FaSIMuXIHeiVJe29',
  '4BnWd26yROvl0Ots', '6ZZlCncPKX4fGVmI', 'WMj1pu9mllQsZk2x', 'eyRMMc4qCzGf9naj',
  'oyTndr1NgGRbbsTt', 'a7EsJH9zcj7SMEnM', 'z63rJlQKqheFBw4u', 'gCEgRsZzch3l7mfD',
  '2cfvB59nVeJ91wii', '0S1YXMDF4gHHrTbK', 'XTEYFVPc26o3loMu', 'T7nHP1laYHDqwSPm',
  'ziXSdzv5ySslNeos', '5VMmNgSU76d9gZye', 'WCwJqtFRROwoToik', 'Oyt4aCpmjStLdYvO',
  'DYWXrIK8nGvzzWJ6',
];

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ALL_IDS;
const results = [];

for (const id of ids) {
  const file = join(workflowsDir, `${id}.json`);
  if (!existsSync(file)) {
    results.push({ workflowId: id, status: 'missing_json', note: 'Workflow JSON not saved yet' });
    continue;
  }
  try {
    const out = execSync(
      `node "${join(__dirname, 'n8n-tracking-ops.js')}" "${file}" --mcp`,
      { encoding: 'utf8', cwd: root }
    );
    const parsed = JSON.parse(out);
    const wf = JSON.parse(readFileSync(file, 'utf8'));
    const name = wf.workflow?.name || wf.name || '';
    const opsFile = join(opsDir, `${id}.json`);
    const opsData = existsSync(opsFile)
      ? JSON.parse(readFileSync(opsFile, 'utf8'))
      : { operations: parsed.ops || [] };

    if (parsed.note) {
      results.push({ workflowId: id, name, status: 'skipped', note: parsed.note, opCount: 0 });
    } else if (!opsData.operations?.length) {
      results.push({ workflowId: id, name, status: 'skipped', note: 'No operations generated (already updated?)', opCount: 0 });
    } else {
      results.push({ workflowId: id, name, status: 'ready', opCount: opsData.operations.length, note: null });
    }
  } catch (err) {
    results.push({ workflowId: id, status: 'error', note: String(err.message || err) });
  }
}

writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
