#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, ['KdpEmEGHNlPICOa4']);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
let code = nodes.find((n) => n.name === 'Avaliar e montar insert').parameters.jsCode;

// Find values that feed the retrieval metric columns
const markers = [
  'candidatesRetrieved',
  'candidatesReranked',
  'expectedDocumentRank',
  'retrievalLatencyMs',
  'rerankLatencyMs',
  'finalContextCount',
  'retrievalConfigVersion',
  'fallbackUsed',
];
for (const m of markers) {
  const re = new RegExp(`.{0,40}${m}.{0,80}`, 'g');
  const hits = [...code.matchAll(re)].slice(0, 5).map((x) => x[0]);
  console.log('\n' + m + ':', hits.length);
  hits.forEach((h) => console.log(' ', h.replace(/\n/g, '\\n')));
}

// Look for old variables that might still be in SQL VALUES for those columns
const idx = code.indexOf('candidatesRetrieved == null');
console.log('\nNEAR candidatesRetrieved null check:\n', code.slice(idx, idx + 900));

await c.end();
