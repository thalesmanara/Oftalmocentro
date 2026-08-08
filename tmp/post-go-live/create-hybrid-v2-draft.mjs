import pg from 'pg';
import crypto from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});

// Mirrors the normalization performed by "IA - VALIDAR RETRIEVAL CONFIG" (NhWUkmzGhlttJC9S)
// so the stored content_hash matches what a re-validation of this configuration produces.
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

const { rows: v1rows } = await c.query(
  `SELECT id, retrieval_config_id, version_label, mode, configuration, content_hash
     FROM ai_retrieval_config_versions
    WHERE version_label='hybrid-v1'`,
);
const v1 = v1rows[0];
console.log('hybrid-v1 stored hash :', v1.content_hash);
console.log('hybrid-v1 recomputed  :', hash(normalize(v1.configuration)));

const LEXICAL_EXPANSION = {
  enabled: true,
  maxSynonymsPerTerm: 4,
  dictionary: {
    equipamento: ['máquina', 'aparelho'],
    máquina: ['equipamento', 'aparelho'],
    aparelho: ['equipamento', 'máquina'],
    funcionário: ['colaborador', 'empregado'],
    colaborador: ['funcionário', 'empregado'],
    comprar: ['adquirir', 'aquisição'],
    adquirir: ['comprar', 'aquisição'],
    manutenção: ['reparo', 'conserto'],
    reparo: ['manutenção', 'conserto'],
    conserto: ['manutenção', 'reparo'],
    remarcar: ['reagendar', 'alterar agendamento'],
    reagendar: ['remarcar', 'alterar agendamento'],
  },
};

const v2config = normalize({
  ...v1.configuration,
  notes:
    'Candidato hybrid-v2 — hybrid-v1 + expansão léxica por sinônimos (DRAFT, requer A/B antes de publicar)',
  lexicalExpansion: LEXICAL_EXPANSION,
});
const v2hash = hash(v2config);
console.log('hybrid-v2 hash        :', v2hash);

const existing = await c.query(
  `SELECT id, status FROM ai_retrieval_config_versions
    WHERE retrieval_config_id=$1 AND version_label='hybrid-v2'`,
  [v1.retrieval_config_id],
);
if (existing.rows.length) {
  console.log('hybrid-v2 already exists:', existing.rows);
  await c.end();
  process.exit(0);
}

const ins = await c.query(
  `INSERT INTO ai_retrieval_config_versions
     (retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, notes)
   SELECT $1,
          (SELECT COALESCE(MAX(version_number),0)+1 FROM ai_retrieval_config_versions WHERE retrieval_config_id=$1),
          'hybrid-v2', 'DRAFT', $2, $3::jsonb, $4,
          'Etapa 28.1 — candidato de expansao lexica. NAO publicar sem A/B.'
   RETURNING id, version_number, version_label, status, mode, content_hash, created_at`,
  [v1.retrieval_config_id, v2config.mode, JSON.stringify(v2config), v2hash],
);
console.log('inserted:', ins.rows[0]);

const check = await c.query(
  `SELECT version_label, status, published_at FROM ai_retrieval_config_versions
    WHERE status='PUBLISHED'`,
);
console.log('published rows (must stay hybrid-v1 only):', check.rows);
const secrets = await c.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE 'retrieval_active%'`,
);
console.log('app_secrets:', secrets.rows);

await c.end();
