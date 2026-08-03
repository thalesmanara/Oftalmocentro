#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

await client.query(`
ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS recall_at_k numeric,
  ADD COLUMN IF NOT EXISTS precision_at_k numeric,
  ADD COLUMN IF NOT EXISTS mrr numeric,
  ADD COLUMN IF NOT EXISTS hit_rate numeric,
  ADD COLUMN IF NOT EXISTS expected_document_rank integer,
  ADD COLUMN IF NOT EXISTS expected_chunk_rank integer,
  ADD COLUMN IF NOT EXISTS final_context_count integer,
  ADD COLUMN IF NOT EXISTS rerank_latency_ms numeric,
  ADD COLUMN IF NOT EXISTS fallback_used boolean,
  ADD COLUMN IF NOT EXISTS source_precision numeric;
`);

const cols = await client.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='ai_test_results'
    AND column_name IN ('recall_at_k','precision_at_k','mrr','hit_rate','expected_document_rank',
      'candidates_retrieved','candidates_reranked','retrieval_ranked_document_ids','source_precision','source_recall')
  ORDER BY column_name
`);
console.log('result cols', cols.rows);

// Check Avaliar INSERT in EXECUTAR TESTE
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const avaliar = nodes.find((n) => /Avaliar|montar insert|Insert result/i.test(n.name));
console.log('avaliar node', avaliar?.name);
const js = avaliar?.parameters?.jsCode || '';
console.log('has recallAtK calc', /recallAtK|recall_at_k/.test(js));
console.log('has rankedDocumentIds', /rankedDocumentIds|retrieval_ranked/.test(js));
// show snippet around recall
const idx = js.indexOf('recall');
console.log(js.slice(Math.max(0, idx - 100), idx + 400));

await client.end();
