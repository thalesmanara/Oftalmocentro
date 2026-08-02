#!/usr/bin/env node
/**
 * Apply all tracking ops via n8n REST API (PATCH workflow) when N8N_API_KEY is set.
 * Falls back to printing instructions.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildOps } from './n8n-tracking-ops.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const opsDir = join(root, 'tmp', 'n8n-ops');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const baseUrl = process.env.N8N_BASE_URL || 'https://n8n.oftalmocentrouberaba.cloud';
const apiKey = process.env.N8N_API_KEY;

const results = [];
const skipIds = new Set(['DYWXrIK8nGvzzWJ6']); // already applied

async function applyNodeParams(workflowId, operations) {
  const wfPath = join(wfDir, `${workflowId}.json`);
  const wfData = JSON.parse(readFileSync(wfPath, 'utf8'));
  const nodes = wfData.workflow.nodes;

  for (const op of operations) {
    if (op.type !== 'updateNodeParameters') throw new Error(`Unsupported op: ${op.type}`);
    const node = nodes.find((n) => n.name === op.nodeName);
    if (!node) throw new Error(`Node not found: ${op.nodeName}`);
    node.parameters = deepMerge(node.parameters || {}, op.parameters);
  }

  const res = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify({
      name: wfData.workflow.name,
      nodes,
      connections: wfData.workflow.connections,
      settings: wfData.workflow.settings || {},
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PUT ${workflowId}: ${res.status} ${text}`);
  }
  return res.json();
}

async function publish(workflowId) {
  const res = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}/publish`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': apiKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Publish ${workflowId}: ${res.status} ${text}`);
  }
  return res.json();
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      out[k] = deepMerge(target[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

const files = readdirSync(opsDir).filter((f) => f.endsWith('.json'));

if (!apiKey) {
  console.error('N8N_API_KEY not set — cannot apply via REST');
  process.exit(1);
}

for (const f of files) {
  const { workflowId, operations } = JSON.parse(readFileSync(join(opsDir, f), 'utf8'));
  if (skipIds.has(workflowId) || operations.length === 0) continue;
  const name = JSON.parse(readFileSync(join(wfDir, `${workflowId}.json`), 'utf8')).workflow.name;
  try {
    await applyNodeParams(workflowId, operations);
    const pub = await publish(workflowId);
    results.push({
      workflowId,
      name,
      status: 'ok',
      activeVersionId: pub.activeVersionId || pub.versionId || pub.id,
      opCount: operations.length,
    });
    console.log(`OK ${workflowId} ${name}`);
  } catch (e) {
    results.push({ workflowId, name, status: 'error', error: e.message, opCount: operations.length });
    console.error(`FAIL ${workflowId}: ${e.message}`);
  }
}

writeFileSync(join(root, 'tmp', 'n8n-apply-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
