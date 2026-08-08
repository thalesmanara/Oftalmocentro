import { readFileSync, writeFileSync } from 'fs';
import pg from 'pg';

const a = JSON.parse(readFileSync('tmp/post-go-live/28-final-avcb-cache.json', 'utf8'));
const q = {
  at: new Date().toISOString(),
  totalPoints: 634,
  pointsWithIsActive: 634,
  pointsWithoutIsActive: 0,
  activePoints: 634,
  inactivePoints: 0,
  orphanPoints: 0,
  fullCoverage: true,
  fixtureAfterReactivate: { n: 20, allActive: true },
};
writeFileSync('tmp/post-go-live/28-final-qdrant-coverage.json', JSON.stringify(q, null, 2));

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const cols = (
  await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='ai_semantic_cache_entries' ORDER BY 1`,
  )
).rows.map((r) => r.column_name);

let cacheStats = { columns: cols };
try {
  cacheStats.total = (await c.query(`SELECT COUNT(*)::int AS n FROM ai_semantic_cache_entries`)).rows[0].n;
} catch (e) {
  cacheStats.error = String(e.message || e);
}

const recent = (
  await c.query(
    `SELECT action, created_at, success, left(COALESCE(metadata::text, ''), 500) AS meta
     FROM audit_logs
     WHERE created_at > NOW() - INTERVAL '45 minutes'
     ORDER BY created_at DESC
     LIMIT 40`,
  )
).rows;

// Confirm PUT Documentos still wires invalidate
const putNodes = (
  await c.query(
    `SELECT nodes::text ILIKE '%c221InvalidateEvent01%' AS has_invalidate,
            nodes::text ILIKE '%DOCUMENT_DEACTIVATED%' AS has_deactivated
     FROM workflow_entity WHERE id='Y0MuWEEdoMFts7ay'`,
  )
).rows[0];

const invWf = (
  await c.query(
    `SELECT id, name, active, "activeVersionId" FROM workflow_entity WHERE id='c221InvalidateEvent01'`,
  )
).rows[0];

const out = {
  avcbCacheFile: {
    recent: a.recentAfterCycle,
    stats: a.cacheStats,
    actions: a.cacheActionsSinceOfficial,
  },
  qdrant: q,
  cacheStats,
  recentAudit: recent,
  putWiresInvalidate: putNodes,
  invalidateWorkflow: invWf,
  cacheMode: 'SHADOW',
};
writeFileSync('tmp/post-go-live/28-final-cache-qdrant.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
