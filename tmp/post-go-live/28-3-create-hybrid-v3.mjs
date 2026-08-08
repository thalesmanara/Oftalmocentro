/**
 * hybrid-v3 = hybrid-v1 + merge.includeVectorOnly + expired penalty
 * SEM lexicalExpansion (suspeita de ruído no teste cego da v2)
 */
import pg from 'pg';
import crypto from 'crypto';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});

function normalize(body) {
  const n = {
    mode: String(body.mode || 'HYBRID').toUpperCase(),
    candidateLimit: Number(body.candidateLimit ?? 30),
    finalLimit: Number(body.finalLimit ?? 12),
    maxChunksPerDocument: Number(body.maxChunksPerDocument ?? 2),
    enableNeighbors: !!body.enableNeighbors,
    weights: {
      semantic: Number.isFinite(Number(body.weights?.semantic)) ? Number(body.weights.semantic) : 0.65,
      lexical: Number.isFinite(Number(body.weights?.lexical)) ? Number(body.weights.lexical) : 0.35,
      hybridPrior: Number.isFinite(Number(body.weights?.hybridPrior)) ? Number(body.weights.hybridPrior) : 0,
    },
    boosts: Object.fromEntries(Object.entries(body.boosts || {}).map(([k, v]) => [k, Number(v)])),
    penalties: Object.fromEntries(Object.entries(body.penalties || {}).map(([k, v]) => [k, Number(v)])),
    normalization:
      body.normalization && typeof body.normalization === 'object'
        ? body.normalization
        : { vector: 'clip01', text: 'batchMax', hybrid: 'passthrough' },
    notes: typeof body.notes === 'string' ? body.notes.slice(0, 500) : '',
  };
  if (body.merge && typeof body.merge === 'object') {
    n.merge = { includeVectorOnly: !!body.merge.includeVectorOnly };
  }
  if (body.lexicalExpansion && typeof body.lexicalExpansion === 'object') {
    n.lexicalExpansion = {
      enabled: !!body.lexicalExpansion.enabled,
      maxSynonymsPerTerm: Number(body.lexicalExpansion.maxSynonymsPerTerm ?? 4),
      dictionary: Object.fromEntries(
        Object.entries(body.lexicalExpansion.dictionary || {}).map(([k, v]) => [
          String(k).toLowerCase(),
          (Array.isArray(v) ? v : []).map((s) => String(s)),
        ]),
      ),
    };
  }
  return n;
}

const hash = (o) => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');

await c.connect();
const v1 = (
  await c.query(`SELECT * FROM ai_retrieval_config_versions WHERE version_label='hybrid-v1' LIMIT 1`)
).rows[0];

const cfg = normalize({
  ...v1.configuration,
  candidateLimit: 40,
  penalties: { ...(v1.configuration.penalties || {}), expired: 0.12 },
  merge: { includeVectorOnly: true },
  notes: 'Etapa 28.3 hybrid-v3: includeVectorOnly + expired penalty; SEM lexicalExpansion',
});
// explicitly no lexicalExpansion key
delete cfg.lexicalExpansion;

const contentHash = hash(cfg);
const existing = await c.query(
  `SELECT id, status FROM ai_retrieval_config_versions WHERE version_label='hybrid-v3'`,
);
let versionId;
if (existing.rows.length) {
  await c.query(
    `UPDATE ai_retrieval_config_versions
     SET configuration=$2::jsonb, content_hash=$3, mode=$4, notes=$5, status='DRAFT', published_at=NULL
     WHERE id=$1`,
    [existing.rows[0].id, JSON.stringify(cfg), contentHash, cfg.mode, cfg.notes],
  );
  versionId = existing.rows[0].id;
} else {
  const ins = await c.query(
    `INSERT INTO ai_retrieval_config_versions
      (retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, notes)
     SELECT $1,
            (SELECT COALESCE(MAX(version_number),0)+1 FROM ai_retrieval_config_versions WHERE retrieval_config_id=$1),
            'hybrid-v3', 'DRAFT', $2, $3::jsonb, $4, $5
     RETURNING id`,
    [v1.retrieval_config_id, cfg.mode, JSON.stringify(cfg), contentHash, cfg.notes],
  );
  versionId = ins.rows[0].id;
}

writeFileSync(
  'tmp/post-go-live/28-3-hybrid-v3.json',
  JSON.stringify({ versionId, contentHash, cfg }, null, 2),
);
console.log({ versionId, contentHash });
await c.end();
