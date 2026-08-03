#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// DATASET force to TESTE
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const v = n.parameters?.workflowInputs?.value;
    const blob = JSON.stringify(n.parameters || {});
    if (/forceContext|KdpEmEGHNlPICOa4|EXECUTAR TESTE/i.test(blob + n.name)) {
      console.log('DATASET', n.name);
      if (v) console.log('  force', v.forceContextFailureForTest, 'keys', Object.keys(v).filter((k) => /force|context/i.test(k)));
    }
  }
}

// Health aggregate snippet
{
  const { rows } = await client.query(`SELECT nodes, "versionId" FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
  console.log('health version', rows[0].versionId);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const agg = nodes.find((n) => n.name === 'Aggregate health');
  const i = agg.parameters.jsCode.indexOf('contextWindow');
  writeFileSync(new URL('./_c212-agg-cw-live.js', import.meta.url), agg.parameters.jsCode.slice(i, i + 1200));
  console.log(agg.parameters.jsCode.slice(i, i + 600));
  const prep = nodes.find((n) => n.name === 'Prepare checks');
  console.log('prep has contextDb', prep.parameters.jsCode.includes('contextDb'));
  const probe = nodes.find((n) => n.name === 'Probe database');
  console.log('probe has context_stats', probe.parameters.query.includes('context_stats'));
}

// Montar resposta full contextMeta map
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const m = nodes.find((n) => n.name === 'Montar resposta');
  writeFileSync(new URL('./_c212-consulta-Montar_resposta.js', import.meta.url), m.parameters.jsCode);
}

// How EXECUTAR TESTE persists context_fallback
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  for (const n of nodes) {
    const code = n.parameters?.jsCode || n.parameters?.query || '';
    if (/context_fallback|fallbackUsed|contextMeta/.test(code)) {
      console.log('\nTESTE persist', n.name);
      const idx = code.search(/context_fallback|fallbackUsed/);
      console.log(code.slice(Math.max(0, idx - 100), idx + 250));
    }
  }
}

await client.end();
