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

// Find conflictDetected / contextUtilizationRate in VALUES SQL builder
const patterns = [
  'conflictDetected',
  'contextUtilizationRate',
  'relevantContextRate',
  'overflowDetected',
  'emptyContext',
  'conflictType',
  'insufficient_context',
];
for (const p of patterns) {
  let idx = 0;
  let n = 0;
  while ((idx = code.indexOf(p, idx)) !== -1) {
    n++;
    if (n <= 3) console.log(`\n=== ${p} #${n} @${idx} ===\n`, code.slice(Math.max(0, idx - 80), idx + 200));
    idx += p.length;
  }
  console.log(`${p} total=${n}`);
}

// Dump last 2500 chars of jsCode (usually SQL assembly)
console.log('\n=== TAIL ===\n', code.slice(-3500));
await client.end();
