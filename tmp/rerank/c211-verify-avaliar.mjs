#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const av = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof av.rows[0].nodes === 'string' ? JSON.parse(av.rows[0].nodes) : av.rows[0].nodes;
const code = nodes.find((x) => x.name === 'Avaliar e montar insert').parameters.jsCode;

const vars = [
  'const contextConfigVersionId',
  'const modelContextLimit',
  'const availableContextTokens',
  'const estimatedContextTokens',
  'const includedChunkCount',
  'const insufficientContext',
  'const conflictDetected',
  'const sourceCount',
  'const overflowDetected',
  'const emptyContext',
  'const redundancyRate',
  'const contextUtilizationRate',
];
for (const v of vars) {
  let c = 0, i = 0;
  while ((i = code.indexOf(v, i)) !== -1) { c++; i += v.length; }
  console.log(c, v);
}

const needle = `'" + j(rankedDocumentIds)`;
const i = code.indexOf(needle);
console.log('\nVALUES+context:\n', code.slice(i, i + 1200));
await client.end();
