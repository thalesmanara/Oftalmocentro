#!/usr/bin/env node
import pg from 'pg';
import { createHash } from 'crypto';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const e = await c.query(`
  SELECT id, left(normalized_question,60) AS q, left(question_hash,16) AS qh,
         left(cache_key_hash,16) AS key, status, created_at, last_hit_at
  FROM ai_semantic_cache_entries
  ORDER BY created_at DESC
  LIMIT 15`);
console.log(e.rows);

// compute expected hash with new normalize
const normalize = (raw) => {
  let q = String(raw || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
  q = q.replace(/[?!.,;:]+$/g, '');
  q = q.replace(/[^\p{L}\p{N}\s\-./@]+/gu, ' ');
  return q.replace(/\s+/g, ' ').trim();
};
const q = 'Quem aparece na relação de funcionários em Excel?';
const nq = normalize(q);
const qh = createHash('sha256').update(nq).digest('hex');
console.log({ nq, qh });
const m = await c.query(
  `SELECT id, status, left(cache_key_hash,16) FROM ai_semantic_cache_entries WHERE question_hash=$1`,
  [qh],
);
console.log('entries with new qh', m.rows);
await c.end();
