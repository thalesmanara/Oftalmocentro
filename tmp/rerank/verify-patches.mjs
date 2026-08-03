#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const avaliar = nodes.find((n) => n.name === 'Avaliar e montar insert');
const js = avaliar.parameters.jsCode;
writeFileSync(new URL('./_avaliar-full.js', import.meta.url), js);
console.log({
  hasCandidatesCol: js.includes('candidates_retrieved'),
  hasRankedIds: js.includes('rankedDocumentIds'),
  hasRetrievalMeta: js.includes('retrievalMeta'),
  hasInsertCols: /candidates_retrieved/.test(js),
  sqlSnippet: js.includes('INSERT INTO ai_test_results'),
  len: js.length,
});
// Extract SQL template roughly
const m = js.match(/const sql = "INSERT[\s\S]*?RETURNING[\s\S]*?;"/);
if (m) writeFileSync(new URL('./_avaliar-sql.txt', import.meta.url), m[0].slice(0, 3000));
else console.log('no sql match');

// Check LOAD_CFG query
const load = await client.query(`SELECT nodes FROM workflow_entity WHERE id='sClDEVNVS0TGG2uq'`);
const ln = typeof load.rows[0].nodes === 'string' ? JSON.parse(load.rows[0].nodes) : load.rows[0].nodes;
const pgNode = ln.find((n) => n.type === 'n8n-nodes-base.postgres');
writeFileSync(new URL('./_load-cfg-query.sql', import.meta.url), pgNode.parameters.query);
console.log('load cfg node', pgNode.name);

// Check metrics agg
const met = await client.query(`SELECT nodes FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`);
const mn = typeof met.rows[0].nodes === 'string' ? JSON.parse(met.rows[0].nodes) : met.rows[0].nodes;
const agg = mn.find((n) => (n.parameters?.jsCode || '').includes('aggregateMetrics'));
console.log('metrics has recall_at_k', agg?.parameters.jsCode.includes('recall_at_k'));
console.log('metrics has recallAtK var', agg?.parameters.jsCode.includes('recallAtK'));
await client.end();
