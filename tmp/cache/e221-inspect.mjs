#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const out = { at: new Date().toISOString() };
out.secrets = (await client.query(`SELECT key,value FROM app_secrets WHERE key LIKE '%active%' OR key LIKE 'cache_%' ORDER BY 1`)).rows;
out.cacheVersions = (await client.query(`SELECT id, version_label, status, mode FROM ai_cache_config_versions ORDER BY created_at`)).rows;
out.entries = (await client.query(`SELECT status, COUNT(*)::int AS n FROM ai_semantic_cache_entries GROUP BY status`)).rows;
out.deps = (await client.query(`SELECT COUNT(*)::int AS n FROM ai_semantic_cache_dependencies`)).rows[0];
out.metrics = (await client.query(`SELECT * FROM ai_cache_metrics_daily ORDER BY day DESC LIMIT 7`)).rows;
out.depCols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_semantic_cache_dependencies' ORDER BY 1`)).rows.map((r) => r.column_name);
out.entryCols = (await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name='ai_semantic_cache_entries' ORDER BY 1`)).rows.map((r) => r.column_name);
out.sampleEntry = (await client.query(`SELECT id, cache_key_hash, source_fingerprint, status, hit_count, expires_at, left(coalesce(metadata::text,''),200) AS metadata FROM ai_semantic_cache_entries ORDER BY created_at DESC LIMIT 1`)).rows[0];
out.prod = {
  context: (await client.query(`SELECT version_label,status,mode FROM ai_context_config_versions WHERE status IN ('PUBLISHED','DRAFT')`)).rows,
  retrieval: (await client.query(`SELECT version_label,status,mode FROM ai_retrieval_config_versions WHERE status IN ('PUBLISHED','DRAFT')`)).rows,
};
writeFileSync(new URL('./_e221-inspect.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
