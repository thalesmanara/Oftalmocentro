#!/usr/bin/env node
/**
 * Apply tracking updates via n8n public API using MCP-equivalent node merges.
 * Reads tmp/n8n-mcp-payload/*.json and PUTs workflow, then POSTs publish.
 * Set N8N_API_KEY env var.
 */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const payloadDir = join(root, 'tmp', 'n8n-mcp-payload');
const wfDir = join(root, 'tmp', 'n8n-workflows');
const mergedDir = join(root, 'tmp', 'n8n-merged');
const baseUrl = process.env.N8N_BASE_URL || 'https://n8n.oftalmocentrouberaba.cloud';
const apiKey = process.env.N8N_API_KEY;
const skip = new Set(process.argv.slice(2));

if (!apiKey) {
  console.error('N8N_API_KEY required');
  process.exit(1);
}

async function getWorkflow(id) {
  const res = await fetch(`${baseUrl}/api/v1/workflows/${id}`, {
    headers: { 'X-N8N-API-KEY': apiKey },
  });
  if (!res.ok) throw new Error(`GET ${id}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function putWorkflow(id, body) {
  const res = await fetch(`${baseUrl}/api/v1/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${id}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function publish(id) {
  const res = await fetch(`${baseUrl}/api/v1/workflows/${id}/publish`, {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': apiKey },
  });
  if (!res.ok) throw new Error(`Publish ${id}: ${res.status} ${await res.text()}`);
  return res.json();
}

const results = [];
const files = readdirSync(payloadDir).filter((f) => f.endsWith('.json'));

for (const f of files) {
  const { workflowId, operations } = JSON.parse(readFileSync(join(payloadDir, f), 'utf8'));
  if (skip.has(workflowId)) continue;
  const merged = JSON.parse(readFileSync(join(mergedDir, `${workflowId}.json`), 'utf8'));
  const name = merged.name;
  try {
    const current = await getWorkflow(workflowId);
    await putWorkflow(workflowId, {
      name: current.name,
      nodes: merged.nodes,
      connections: current.connections,
      settings: current.settings || {},
    });
    const pub = await publish(workflowId);
    results.push({
      workflowId,
      name,
      status: 'ok',
      activeVersionId: pub.activeVersionId || pub.versionId,
      opCount: operations.length,
    });
    console.log(`OK ${name}`);
  } catch (e) {
    results.push({ workflowId, name, status: 'error', error: e.message, opCount: operations.length });
    console.error(`FAIL ${workflowId}: ${e.message}`);
  }
}

writeFileSync(join(root, 'tmp', 'n8n-apply-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
