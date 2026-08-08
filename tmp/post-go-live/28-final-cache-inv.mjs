import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const inv = (
  await c.query(`
    SELECT status, invalidation_reason, invalidated_at, left(cache_key_hash,12) AS kh
    FROM ai_semantic_cache_entries
    WHERE invalidated_at IS NOT NULL
    ORDER BY invalidated_at DESC NULLS LAST
    LIMIT 15
  `)
).rows;

const byReason = (
  await c.query(`
    SELECT COALESCE(invalidation_reason,'(null)') AS reason, COUNT(*)::int AS n
    FROM ai_semantic_cache_entries
    WHERE invalidated_at IS NOT NULL
    GROUP BY 1 ORDER BY n DESC
  `)
).rows;

const statusDist = (
  await c.query(`
    SELECT status, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE invalidated_at IS NOT NULL)::int AS invalidated
    FROM ai_semantic_cache_entries
    GROUP BY 1 ORDER BY n DESC
  `)
).rows;

const served = (
  await c.query(`
    SELECT COALESCE(SUM(served_hit_count),0)::int AS served_hits,
           COALESCE(SUM(shadow_candidate_count),0)::int AS shadow_candidates,
           COALESCE(SUM(hit_count),0)::int AS hits
    FROM ai_semantic_cache_entries
  `)
).rows[0];

writeFileSync(
  'tmp/post-go-live/28-final-cache-invalidation.json',
  JSON.stringify({ at: new Date().toISOString(), inv, byReason, statusDist, served }, null, 2),
);
console.log(JSON.stringify({ byReason, statusDist, served, sample: inv.slice(0, 5) }, null, 2));
await c.end();
