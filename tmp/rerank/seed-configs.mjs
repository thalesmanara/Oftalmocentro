#!/usr/bin/env node
/** Seed AI_QUERY_RETRIEVAL versions: HYBRID published + HYBRID_RERANK draft */
import crypto from 'crypto';
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    process.env.APP_PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const hybridConfig = {
  mode: 'HYBRID',
  candidateLimit: 30,
  finalLimit: 12,
  maxChunksPerDocument: 4,
  enableNeighbors: false,
  weights: {
    semantic: 0.65,
    lexical: 0.35,
  },
  boosts: {
    subcategoryMatch: 0.15,
    categoryMatch: 0.1,
    titleMatch: 0.08,
    exactIdentifier: 0.2,
    tabularStructure: 0.08,
    ocrGood: 0.03,
    isCurrent: 0.05,
    recentVigency: 0.04,
  },
  penalties: {
    redundancyPerExtraChunk: 0.06,
    staleDocument: 0.05,
  },
  normalization: {
    vector: 'clip01',
    text: 'batchMax',
    hybrid: 'passthrough',
  },
  notes: 'Produção atual — ranking híbrido sem re-ranking avançado',
};

const rerankConfig = {
  mode: 'HYBRID_RERANK',
  candidateLimit: 30,
  finalLimit: 8,
  maxChunksPerDocument: 2,
  enableNeighbors: false,
  weights: {
    semantic: 0.45,
    lexical: 0.25,
    hybridPrior: 0.15,
  },
  boosts: {
    subcategoryMatch: 0.12,
    categoryMatch: 0.08,
    titleMatch: 0.1,
    exactIdentifier: 0.22,
    tabularStructure: 0.1,
    ocrGood: 0.03,
    isCurrent: 0.05,
    recentVigency: 0.06,
    exactPhrase: 0.08,
  },
  penalties: {
    redundancyPerExtraChunk: 0.1,
    staleDocument: 0.06,
    lowUsefulLength: 0.03,
  },
  normalization: {
    vector: 'clip01',
    text: 'batchMax',
    hybrid: 'batchMinMax',
  },
  notes: 'Candidato — re-ranking determinístico explicável (não publicado)',
};

function hash(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

const { rows: cfg } = await client.query(
  `SELECT id FROM ai_retrieval_configs WHERE code='AI_QUERY_RETRIEVAL' LIMIT 1`,
);
if (!cfg[0]) throw new Error('config missing — run migration first');
const configId = cfg[0].id;

const { rows: existing } = await client.query(
  `SELECT version_label, status, mode FROM ai_retrieval_config_versions WHERE retrieval_config_id=$1 ORDER BY version_number`,
  [configId],
);
console.log('existing versions', existing);

async function ensureVersion(versionNumber, versionLabel, status, mode, configuration) {
  const { rows } = await client.query(
    `SELECT id FROM ai_retrieval_config_versions WHERE retrieval_config_id=$1 AND version_label=$2`,
    [configId, versionLabel],
  );
  if (rows[0]) {
    console.log('exists', versionLabel, rows[0].id);
    return rows[0].id;
  }
  const { rows: ins } = await client.query(
    `INSERT INTO ai_retrieval_config_versions
      (retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, published_at)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7, CASE WHEN $4='PUBLISHED' THEN now() ELSE NULL END)
     RETURNING id`,
    [configId, versionNumber, versionLabel, status, mode, JSON.stringify(configuration), hash(configuration)],
  );
  console.log('created', versionLabel, ins[0].id, status);
  return ins[0].id;
}

await ensureVersion(1, 'hybrid-v1', 'PUBLISHED', 'HYBRID', hybridConfig);
await ensureVersion(2, 'hybrid-rerank-v1', 'DRAFT', 'HYBRID_RERANK', rerankConfig);

await client.query(
  `INSERT INTO app_secrets (key, value) SELECT 'retrieval_active_version', 'hybrid-v1'
   WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key='retrieval_active_version')`,
);
await client.query(
  `UPDATE app_secrets SET value='hybrid-v1' WHERE key='retrieval_active_version'`,
);
await client.query(
  `UPDATE app_secrets SET value='HYBRID' WHERE key='retrieval_active_mode'`,
);

const { rows: pub } = await client.query(
  `SELECT version_label, mode, status FROM ai_retrieval_config_versions WHERE retrieval_config_id=$1 ORDER BY version_number`,
  [configId],
);
console.log('final', pub);
await client.end();
