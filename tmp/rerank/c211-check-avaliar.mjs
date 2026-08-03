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

// Find sql construction end
const m = code.match(/contextUtilizationRate[\s\S]{0,900}/);
console.log('MATCH1:\n', m ? m[0] : 'NONE');

const m2 = code.match(/relevantContextRate[\s\S]{0,400}/);
console.log('\nMATCH2:\n', m2 ? m2[0] : 'NONE');

// Count placeholders / column vs value issues - find VALUES closing
const insertStart = code.indexOf('INSERT INTO ai_test_results');
const insertEnd = code.indexOf('") VALUES (', insertStart);
const cols = code.slice(insertStart, insertEnd + 200);
console.log('\nCOL->VAL transition:\n', cols.slice(-500));

// Find the end of VALUES string building - look for contextUtilizationRate in values
let idx = 0;
let n = 0;
while ((idx = code.indexOf('contextUtilizationRate', idx)) !== -1) {
  console.log('\nOcc', ++n, 'at', idx, ':', code.slice(idx, idx + 350));
  idx += 20;
  if (n > 5) break;
}

await client.end();
