#!/usr/bin/env node
/** Apply audit-instrument ops to workflow_entity via Postgres, then publish via MCP HTTP if auth available. */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'tmp', 'audit-instrument');
const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const MCP_URL = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
const MCP_AUTH = process.env.N8N_MCP_AUTH || process.env.CURSOR_MCP_AUTH || '';

function applyOps(workflow, operations) {
  const nodes = [...workflow.nodes];
  const connections = JSON.parse(JSON.stringify(workflow.connections || {}));

  for (const op of operations) {
    switch (op.type) {
      case 'addNode': {
        if (nodes.some((n) => n.name === op.node.name)) throw new Error(`Node exists: ${op.node.name}`);
        nodes.push({ ...op.node });
        break;
      }
      case 'removeNode': {
        const idx = nodes.findIndex((n) => n.name === op.nodeName);
        if (idx < 0) throw new Error(`Node not found: ${op.nodeName}`);
        nodes.splice(idx, 1);
        for (const [src, outs] of Object.entries(connections)) {
          connections[src] = {
            main: (outs.main || [])
              .map((arr) => arr.filter((c) => c.node !== op.nodeName))
              .filter((arr) => arr.length > 0),
          };
          if (!connections[src].main?.length) delete connections[src];
        }
        delete connections[op.nodeName];
        break;
      }
      case 'setNodeSettings': {
        const n = nodes.find((x) => x.name === op.nodeName);
        if (!n) throw new Error(`Node not found: ${op.nodeName}`);
        n.onError = op.settings.onError ?? n.onError;
        n.alwaysOutputData = op.settings.alwaysOutputData ?? n.alwaysOutputData;
        break;
      }
      case 'removeConnection': {
        const src = op.source;
        if (!connections[src]?.main) throw new Error(`No connections from ${src}`);
        connections[src].main = connections[src].main
          .map((outputs, si) => {
            if (op.sourceIndex != null && si !== op.sourceIndex) return outputs;
            return outputs.filter((c) => {
              if (c.node !== op.target) return true;
              if (op.targetIndex != null && c.index !== op.targetIndex) return true;
              return false;
            });
          })
          .filter((arr) => arr.length > 0);
        if (!connections[src].main.length) delete connections[src];
        break;
      }
      case 'addConnection': {
        const src = op.source;
        const si = op.sourceIndex ?? 0;
        const ti = op.targetIndex ?? 0;
        if (!connections[src]) connections[src] = { main: [] };
        while (connections[src].main.length <= si) connections[src].main.push([]);
        connections[src].main[si].push({ node: op.target, type: op.connectionType || 'main', index: ti });
        break;
      }
      default:
        throw new Error(`Unsupported op: ${op.type}`);
    }
  }
  return { nodes, connections };
}

async function mcpCall(toolName, args) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: toolName, arguments: args },
  };
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (MCP_AUTH) headers.Authorization = MCP_AUTH.startsWith('Bearer ') ? MCP_AUTH : `Bearer ${MCP_AUTH}`;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) throw new Error(`MCP ${toolName} HTTP ${res.status}: ${text.slice(0, 400)}`);
  if (parsed.error) throw new Error(`MCP ${toolName}: ${JSON.stringify(parsed.error)}`);
  const content = parsed.result?.content?.[0]?.text;
  if (content) {
    try {
      return JSON.parse(content);
    } catch {
      return content;
    }
  }
  return parsed.result ?? parsed;
}

const batchArg = process.argv[2];
const ids = batchArg
  ? batchArg.split(',')
  : JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).map((x) => x.id);

const client = new pg.Client({ connectionString: conn });
await client.connect();
const results = [];

for (const id of ids) {
  const payload = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  const entry = { id, name: null, status: 'failed', opCount: payload.operations.length };
  try {
    const { rows } = await client.query(
      `SELECT name, nodes, connections FROM workflow_entity WHERE id = $1`,
      [id]
    );
    if (!rows[0]) throw new Error('workflow not found');
    entry.name = rows[0].name;
    const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
    const connections =
      typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
    const updated = applyOps({ nodes, connections }, payload.operations);
    await client.query(
      `UPDATE workflow_entity SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW() WHERE id = $3`,
      [JSON.stringify(updated.nodes), JSON.stringify(updated.connections), id]
    );
    entry.status = 'updated_db';
    if (MCP_AUTH) {
      const pub = await mcpCall('publish_workflow', { workflowId: id });
      entry.status = 'published';
      entry.versionId = pub?.activeVersionId ?? pub?.versionId ?? pub?.workflow?.activeVersionId ?? null;
    }
    console.log(`OK ${entry.name} (${id}) ops=${entry.opCount} status=${entry.status}`);
  } catch (err) {
    entry.error = String(err.message || err);
    console.error(`FAIL ${id}: ${entry.error}`);
  }
  results.push(entry);
}

await client.end();
writeFileSync(join(dir, 'apply-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
