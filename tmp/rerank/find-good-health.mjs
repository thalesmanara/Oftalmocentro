#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT "versionId", "updatedAt",
     length(nodes::text) AS len
   FROM workflow_history
   WHERE "workflowId"='qAyYc9DrHIqe4L9i'
   ORDER BY "updatedAt" DESC
   LIMIT 10`,
);
console.log(rows);

for (const h of rows) {
  const { rows: full } = await client.query(
    `SELECT nodes FROM workflow_history WHERE "workflowId"='qAyYc9DrHIqe4L9i' AND "versionId"=$1`,
    [h.versionId],
  );
  const nodes = typeof full[0].nodes === 'string' ? JSON.parse(full[0].nodes) : full[0].nodes;
  const probe = nodes.find((n) => n.name === 'Probe database');
  const q = probe?.parameters?.query || '';
  const flags = {
    versionId: h.versionId,
    updatedAt: h.updatedAt,
    mangled: q.includes('FROM settings) AS settings_count') || q.includes('(SELECT COUNT(*)::int   retrieval'),
    qdrant: q.includes('qdrant_sync_stats'),
    embedding: q.includes('embedding_stats'),
    aiEval: q.includes('ai_eval_stats'),
    retrievalCte: q.includes('retrieval_stats AS'),
    retrievalSelect: q.includes('retrieval_stats.retrieval_mode'),
    len: q.length,
  };
  console.log(JSON.stringify(flags));
  if (flags.qdrant && flags.embedding && !flags.mangled && !flags.retrievalCte) {
    writeFileSync(new URL('./_health-good-base.sql', import.meta.url), q);
    console.log('WROTE good base', h.versionId);
    break;
  }
  if (flags.qdrant && !flags.mangled && flags.retrievalCte && flags.retrievalSelect) {
    writeFileSync(new URL('./_health-already-good.sql', import.meta.url), q);
    console.log('already good', h.versionId);
  }
}
await client.end();
