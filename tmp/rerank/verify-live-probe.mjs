#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const r = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof r.rows[0].nodes === 'string' ? JSON.parse(r.rows[0].nodes) : r.rows[0].nodes;
const probe = nodes.find((n) => n.name === 'Probe database');
const q = probe.parameters.query;
writeFileSync(new URL('./_live-probe.sql', import.meta.url), q);
try {
  const x = await client.query(q);
  console.log('live probe ok', {
    mode: x.rows[0].retrieval_mode,
    qdrant: x.rows[0].qdrant_synced,
    emb: x.rows[0].embedding_valid,
  });
} catch (e) {
  console.error('live probe FAIL', e.message);
}

// Fix retrieval status to use ok instead of up (consistency)
const agg = nodes.find((n) => n.name === 'Aggregate health');
if (agg.parameters.jsCode.includes("status = 'up'")) {
  agg.parameters.jsCode = agg.parameters.jsCode.replace("let status = 'up';", "let status = 'ok';");
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='qAyYc9DrHIqe4L9i'`, [
    JSON.stringify(nodes),
  ]);
  console.log('normalized retrieval status to ok');
}
await client.end();
