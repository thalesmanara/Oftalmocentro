#!/usr/bin/env node
/**
 * End-to-end batch: fetch workflow details via n8n REST API, build tracking ops,
 * update workflow, publish workflow.
 *
 * Requires env: N8N_BASE_URL, N8N_API_KEY
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildOps } from './n8n-tracking-ops.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const opsDir = join(root, 'tmp', 'n8n-ops');
const resultsPath = join(root, 'tmp', 'n8n-batch-results.json');
mkdirSync(wfDir, { recursive: true });
mkdirSync(opsDir, { recursive: true });

const BASE = process.env.N8N_BASE_URL || 'https://n8n.oftalmocentrouberaba.cloud';
const API_KEY = process.env.N8N_API_KEY || process.env.N8N_MCP_API_KEY || '';

const ALL_IDS = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      'OJZNWxBCkVXaysmf', '8EXk5RkFW5cxnenL', 'ukDndCZDzemWsOMk', 'vymsco8fVdIvgW4b',
      'vNDpCzOdR7ATnHDP', 'sofpi7zCHMCJkvfI', 'Y0MuWEEdoMFts7ay', 'WLlD1eqbFmKDK9ow',
      '0ieW448wLfITZSlD', 'T6CGZB4oxlzXlTQZ', 'ZckYIZpMtw6HEtIs', 'FaSIMuXIHeiVJe29',
      '4BnWd26yROvl0Ots', '6ZZlCncPKX4fGVmI', 'WMj1pu9mllQsZk2x', 'eyRMMc4qCzGf9naj',
      'oyTndr1NgGRbbsTt', 'a7EsJH9zcj7SMEnM', 'z63rJlQKqheFBw4u', 'gCEgRsZzch3l7mfD',
      '2cfvB59nVeJ91wii', '0S1YXMDF4gHHrTbK', 'XTEYFVPc26o3loMu', 'T7nHP1laYHDqwSPm',
      'ziXSdzv5ySslNeos', '5VMmNgSU76d9gZye', 'WCwJqtFRROwoToik', 'Oyt4aCpmjStLdYvO',
      'DYWXrIK8nGvzzWJ6',
    ];

async function n8nFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (API_KEY) headers['X-N8N-API-KEY'] = API_KEY;
  const res = await fetch(`${BASE.replace(/\/$/, '')}${path}`, { ...opts, headers });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${opts.method || 'GET'} ${path} -> ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  return body;
}

async function getWorkflowDetails(id) {
  // Try MCP-style endpoint first, then standard API
  try {
    return await n8nFetch(`/api/v1/workflows/${id}`);
  } catch (e) {
    throw e;
  }
}

async function updateWorkflow(id, operations) {
  // n8n MCP uses a different endpoint; try REST patch with nodes if ops API unavailable
  // Fallback: use workflow update via PUT with merged nodes from operations
  throw new Error('Direct REST update not implemented - use MCP');
}

const results = [];

for (const id of ALL_IDS) {
  const entry = { workflowId: id, name: null, status: 'pending' };
  try {
    let raw;
    const localFile = join(wfDir, `${id}.json`);
    if (existsSync(localFile)) {
      raw = readFileSync(localFile, 'utf8');
    } else if (API_KEY) {
      const wf = await getWorkflowDetails(id);
      raw = JSON.stringify({ workflow: wf });
      writeFileSync(localFile, raw);
    } else {
      entry.status = 'skipped';
      entry.note = 'No local JSON and no N8N_API_KEY';
      results.push(entry);
      continue;
    }

    const data = JSON.parse(raw);
    const built = buildOps(data);
    const name = data.workflow?.name || data.name || id;
    entry.name = name;

    if (built.note) {
      entry.status = 'skipped';
      entry.note = built.note;
      results.push(entry);
      continue;
    }
    if (!built.ops.length) {
      entry.status = 'skipped';
      entry.note = 'No operations (already updated?)';
      results.push(entry);
      continue;
    }

    writeFileSync(join(opsDir, `${id}.json`), JSON.stringify({ workflowId: id, operations: built.ops }));
    entry.status = 'ops_ready';
    entry.opCount = built.ops.length;
    results.push(entry);
  } catch (err) {
    entry.status = 'error';
    entry.note = String(err.message || err);
    results.push(entry);
  }
}

writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
