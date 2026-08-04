#!/usr/bin/env node
/**
 * Etapa 28 — correção bloqueadora: SyntaxError no nó "Avaliar e montar insert"
 * (string JS quebrada nas colunas de response_policy).
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const WF = 'KdpEmEGHNlPICOa4';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(
  `SELECT id, name, nodes, connections, "activeVersionId", "versionId", active FROM workflow_entity WHERE id=$1`,
  [WF],
);
const row = rows[0];
const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : structuredClone(row.nodes);
const node = nodes.find((n) => /Avaliar e montar insert/i.test(n.name));
if (!node?.parameters?.jsCode) throw new Error('node/code missing');

const before = node.parameters.jsCode;
const broken = `"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,
" +
"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,
" +
"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\\n" +`;

const fixed = `"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\\n" +
"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\\n" +
"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\\n" +`;

if (!before.includes('conflict_type,\n" +')) {
  // try alternate detection
  const alt =
    before.includes('conflict_type,') &&
    before.includes('response_policy_strategy') &&
    !before.includes('conflict_type,\\n" +');
  if (!alt && !before.includes(broken.split('\n')[0])) {
    console.log('pattern not found — dump fragment');
    const i = before.indexOf('conflict_type');
    console.log(JSON.stringify(before.slice(i, i + 280)));
    process.exit(1);
  }
}

let after = before;
if (before.includes(broken)) {
  after = before.replace(broken, fixed);
} else {
  // line-based repair
  after = before
    .replace(
      `"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\n" +\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\n" +\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\\n" +`,
      fixed,
    )
    .replace(
      /"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\n" \+\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\n" \+\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\\n" \+/,
      fixed,
    );
}

if (after === before) {
  // manual splice by line numbers around conflict_type
  const lines = before.split('\n');
  const idx = lines.findIndex((l) => l.includes('conflict_type') && !l.includes('\\n'));
  if (idx < 0) {
    console.error('unable to locate broken lines');
    process.exit(1);
  }
  // Expect idx, idx+1 (" +), idx+2 (response_policy...), idx+3 (" +), idx+4 (abstained...)
  console.log('repairing at', idx + 1, lines.slice(idx, idx + 5).map((l) => JSON.stringify(l)));
  lines.splice(
    idx,
    5,
    `"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\\n" +`,
    `"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\\n" +`,
    `"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\\n" +`,
  );
  after = lines.join('\n');
}

// Validate JS parses
try {
  new Function(after);
  console.log('JS parse OK');
} catch (e) {
  console.error('JS still invalid', e.message);
  writeFileSync(new URL('./_avaliar-fixed-bad.js', import.meta.url), after);
  process.exit(1);
}

node.parameters.jsCode = after;
const nodesJson = JSON.stringify(nodes);
const connJson = typeof row.connections === 'string' ? row.connections : JSON.stringify(row.connections);
const versionId = randomUUID();

await c.query('BEGIN');
await c.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa28-fix',$3::json,$4::json,$5,'Fix SyntaxError Avaliar e montar insert (response_policy cols)',false,NOW(),NOW())`,
  [versionId, WF, nodesJson, connJson, row.name],
);
await c.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [nodesJson, versionId, WF],
);
await c.query('COMMIT');

writeFileSync(
  new URL('./fix-avaliar.json', import.meta.url),
  JSON.stringify({ workflowId: WF, versionId, beforeLen: before.length, afterLen: after.length }, null, 2),
);
console.log(JSON.stringify({ ok: true, versionId, active: row.active }, null, 2));
await c.end();
