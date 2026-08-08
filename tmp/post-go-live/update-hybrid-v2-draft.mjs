import pg from 'pg';
import crypto from 'crypto';

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
    n.merge = {
      includeVectorOnly: !!body.merge.includeVectorOnly,
    };
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

const { rows } = await c.query(
  `SELECT id, configuration, content_hash, status FROM ai_retrieval_config_versions WHERE version_label='hybrid-v2'`,
);
if (!rows.length) {
  console.error('hybrid-v2 not found');
  process.exit(1);
}
const row = rows[0];
const updatedConfig = {
  ...row.configuration,
  merge: { includeVectorOnly: true },
  candidateLimit: 40,
  penalties: {
    ...row.configuration.penalties,
    expired: 0.12,
  },
};
const normalized = normalize(updatedConfig);
const newHash = hash(normalized);

const upd = await c.query(
  `UPDATE ai_retrieval_config_versions
      SET configuration = $1::jsonb,
          content_hash = $2
    WHERE version_label = 'hybrid-v2'
      AND status = 'DRAFT'
  RETURNING id, version_label, status, content_hash, configuration`,
  [JSON.stringify(updatedConfig), newHash],
);

console.log(JSON.stringify({
  success: true,
  oldHash: row.content_hash,
  newHash,
  normalized,
  updated: upd.rows[0],
}, null, 2));

await c.end();
