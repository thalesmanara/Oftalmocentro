#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const ger = nodes.find((n) => n.name === 'Gerar relatório');
console.log(JSON.stringify(ger.parameters, null, 2));

const wfId = ger.parameters?.workflowId?.value || ger.parameters?.workflowId;
console.log('report wf', wfId);

if (wfId) {
  const r = await client.query(`SELECT name, nodes FROM workflow_entity WHERE id=$1`, [wfId]);
  console.log('name', r.rows[0]?.name);
  const ns = typeof r.rows[0].nodes === 'string' ? JSON.parse(r.rows[0].nodes) : r.rows[0].nodes;
  for (const n of ns) {
    const blob = (n.parameters?.jsCode || '') + (n.parameters?.query || '');
    if (/status|FAILED|SUCCESS|total_cases|UPDATE ai_test_runs/i.test(blob)) {
      console.log('HIT', n.name);
      writeFileSync(
        new URL(`./_c212-rep-${n.name.replace(/[^a-zA-Z0-9]+/g, '_')}.txt`, import.meta.url),
        blob,
      );
    }
  }
}

// Check Upsert métricas - maybe ON CONFLICT leaves zeros then update?
const upsert = await import('fs').then((f) => {
  try {
    return f.readFileSync(new URL('./_c212-calc-Upsert_m_tricas.sql', import.meta.url), 'utf8');
  } catch {
    return null;
  }
});
console.log('\nUpsert:', upsert?.slice(0, 800));

await client.end();
