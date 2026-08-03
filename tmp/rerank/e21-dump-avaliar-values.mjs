#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, ['KdpEmEGHNlPICOa4']);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const code = nodes.find((n) => n.name === 'Avaliar e montar insert').parameters.jsCode;
const i = code.indexOf('candidates_retrieved');
console.log(code.slice(i, i + 1500));
console.log('\n--- vars ---');
console.log({
  finalContextCountDecl: code.includes('const finalContextCount'),
  retrievalLatencyMsDecl: code.includes('const retrievalLatencyMs'),
  usesFinalInSql: /finalContextCount/.test(code.slice(code.indexOf('VALUES'))),
  usesRetrievalLatencyInSql: /retrievalLatencyMs/.test(code.slice(code.indexOf('VALUES'))),
});
await c.end();
