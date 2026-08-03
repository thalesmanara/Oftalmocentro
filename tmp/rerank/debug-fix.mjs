#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const versions = await client.query(
  `SELECT id, version_label, status, mode, created_at
   FROM ai_retrieval_config_versions ORDER BY created_at DESC LIMIT 10`,
);
const runs = await client.query(
  `SELECT id, status, overall_score, retrieval_mode, retrieval_config_version,
          mode_override_used, total_cases, started_at, duration_ms
   FROM ai_test_runs ORDER BY started_at DESC LIMIT 8`,
);

// Inspect update workflow nodes for draft check
const upd = await client.query(
  `SELECT nodes FROM workflow_entity WHERE id='Ci5BcAlkZCxOxdyA'`,
);
const nodes = typeof upd.rows[0].nodes === 'string' ? JSON.parse(upd.rows[0].nodes) : upd.rows[0].nodes;
const names = nodes.map((n) => n.name);

const create = await client.query(`SELECT nodes FROM workflow_entity WHERE id='RjQDc5gcWFYyBQJO'`);
const cNodes = typeof create.rows[0].nodes === 'string' ? JSON.parse(create.rows[0].nodes) : create.rows[0].nodes;

// Find Montar resposta / INSERT nodes
function codeOf(list, name) {
  const n = list.find((x) => x.name === name);
  return n?.parameters?.jsCode?.slice?.(0, 1500) || null;
}

const out = {
  versions: versions.rows,
  runs: runs.rows,
  updateNodeNames: names,
  updateCodes: Object.fromEntries(
    names
      .filter((n) => /carregar|draft|bloquear|montar|update|validar/i.test(n))
      .map((n) => [n, codeOf(nodes, n)]),
  ),
  createNodeNames: cNodes.map((n) => n.name),
  createMontar: codeOf(cNodes, 'Montar resposta') || codeOf(cNodes, 'Preparar sucesso'),
};

writeFileSync(new URL('./_debug-fix.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ versions: versions.rows.slice(0, 5), runs: runs.rows.slice(0, 5), updateNames: names }, null, 2));
await client.end();
