#!/usr/bin/env node
/**
 * Etapa 21.2 — diagnose force flag path + publish status + production state
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const ids = [
  ['CWM', 'e95a92295d7c4deb'],
  ['Consulta', '8EXk5RkFW5cxnenL'],
  ['EXECUTAR TESTE', 'KdpEmEGHNlPICOa4'],
  ['EXECUTAR DATASET', '12t0Ol6zWQJgAKPC'],
  ['HEALTH', 'qAyYc9DrHIqe4L9i'],
];

for (const [label, id] of ids) {
  const { rows } = await client.query(
    `SELECT id, name, active, "versionId",
      (SELECT COUNT(*) FROM workflow_history wh WHERE wh."workflowId"=$1) AS hist
     FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const r = rows[0];
  console.log(`${label}: active=${r.active} versionId=${r.versionId} hist=${r.hist}`);
}

// CWM force-related nodes
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='e95a92295d7c4deb'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const code = n.parameters?.jsCode || '';
    if (/forceContext|labForce|TEST_INJECTED|fallbackUsed/i.test(code) || n.name?.includes('Preparar') || n.name?.includes('Montar') || n.name?.includes('Após')) {
      if (/forceContext|labForce|TEST_INJECTED|Após carregar|Preparar entrada|Montar janela/.test(n.name + code.slice(0, 200))) {
        console.log(`\n=== CWM node: ${n.name} ===`);
        if (code) {
          const idx = code.search(/forceContext|labForce|TEST_INJECTED/);
          if (idx >= 0) console.log(code.slice(Math.max(0, idx - 80), idx + 350));
          else console.log(code.slice(0, 200));
        }
      }
    }
  }
  // executeWorkflow inputs on callers? CWM is callee
}

// Consulta CWM call inputs
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const cwmCall = nodes.find(
    (n) =>
      n.type === 'n8n-nodes-base.executeWorkflow' &&
      (JSON.stringify(n.parameters || {}).includes('e95a92295d7c4deb') ||
        /contexto|context|janela/i.test(n.name || '')),
  );
  console.log('\n=== Consulta CWM call ===', cwmCall?.name);
  const v = cwmCall?.parameters?.workflowInputs?.value || {};
  console.log('force expr:', v.forceContextFailureForTest);
  console.log('keys:', Object.keys(v).sort().join(', '));
}

// Production context state
{
  const { rows } = await client.query(`
    SELECT version_label, status, mode, id
    FROM ai_context_config_versions
    ORDER BY
      CASE status WHEN 'PUBLISHED' THEN 0 WHEN 'DRAFT' THEN 1 ELSE 2 END,
      updated_at DESC NULLS LAST
    LIMIT 15
  `);
  console.log('\n=== context versions ===');
  for (const r of rows) console.log(r.status, r.mode, r.version_label, r.id);
}

{
  const { rows } = await client.query(`
    SELECT key, value FROM app_secrets
    WHERE key LIKE '%context%' OR key LIKE '%retrieval%'
    ORDER BY key
  `);
  console.log('\n=== secrets ===');
  for (const r of rows) console.log(r.key, '=', String(r.value).slice(0, 80));
}

{
  const { rows } = await client.query(`
    SELECT action, created_at
    FROM audit_logs
    WHERE action LIKE 'AI_CONTEXT%'
    ORDER BY created_at DESC
    LIMIT 12
  `);
  console.log('\n=== recent context audit ===');
  for (const r of rows) console.log(r.created_at?.toISOString?.() || r.created_at, r.action);
}

await client.end();
