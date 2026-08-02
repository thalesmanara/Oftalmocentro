#!/usr/bin/env node
/** Apply update+publish for all pending workflows via n8n REST if N8N_API_KEY set, else print ops paths. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const queuePath = join(root, 'tmp', 'n8n-apply-queue.json');
const resultsPath = join(root, 'tmp', 'n8n-apply-results.json');

const BASE = (process.env.N8N_BASE_URL || 'https://n8n.oftalmocentrouberaba.cloud').replace(/\/$/, '');
const API_KEY = process.env.N8N_API_KEY || process.env.N8N_MCP_API_KEY || '';

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (API_KEY) headers['X-N8N-API-KEY'] = API_KEY;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

const queue = JSON.parse(readFileSync(queuePath, 'utf8'));
const pending = queue.filter((q) => q.status === 'pending');
const results = [];

if (!API_KEY) {
  console.error('N8N_API_KEY not set; cannot auto-apply via REST.');
  for (const q of pending) {
    console.log(JSON.stringify({ workflowId: q.workflowId, opsFile: join(opsDir, `${q.workflowId}.json`) }));
  }
  process.exit(1);
}

for (const q of pending) {
  const opsFile = join(opsDir, `${q.workflowId}.json`);
  const entry = { workflowId: q.workflowId, name: q.name, status: 'failed' };
  try {
    if (!existsSync(opsFile)) throw new Error('ops file missing');
    const { operations } = JSON.parse(readFileSync(opsFile, 'utf8'));
    // n8n REST API doesn't support atomic ops batch; skip REST path
    throw new Error('REST update_workflow ops not supported - use MCP');
  } catch (err) {
    entry.error = String(err.message || err);
    results.push(entry);
  }
}

writeFileSync(resultsPath, JSON.stringify(results, null, 2));
