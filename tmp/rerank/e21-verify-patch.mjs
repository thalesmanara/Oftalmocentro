#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='bae8872eeb164a27'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const montar = nodes.find((n) => n.name === 'Montar contexto atual');
const code = montar.parameters.jsCode;
console.log('chunkId SQL', nodes.find((n)=>n.name==='Buscar chunks relevantes').parameters.query.includes('AS "chunkId"'));
console.log('rankedChunkIds synthetic', code.includes('documentId}:'));
console.log('fallbackReason IIFE', code.includes('pipelineMeta.fallbackReason'));
console.log('rerank_fallback count', (code.match(/rerank_fallback/g)||[]).length);
console.log('fallbackReason snippets:');
const idx = code.indexOf('fallbackReason');
console.log(code.slice(idx, idx + 350));
await client.end();
