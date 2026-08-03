#!/usr/bin/env node
/**
 * Etapa 21 (CWM) — migration + seed context-v1 (LEGACY PUBLISHED) + context-budget-v1 (DRAFT)
 */
import pg from 'pg';
import { createHash, randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

await client.query(`
CREATE TABLE IF NOT EXISTS ai_context_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'AI_QUERY_CONTEXT',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_context_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  context_config_id uuid NOT NULL REFERENCES ai_context_configs(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED','REJECTED')),
  mode text NOT NULL CHECK (mode IN ('LEGACY','BUDGETED','BUDGETED_WITH_NEIGHBORS')),
  environment text NOT NULL DEFAULT 'PRODUCTION',
  model_name text,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  validation_run_id uuid,
  validation_score numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_by uuid,
  published_at timestamptz,
  UNIQUE (context_config_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_context_one_published
  ON ai_context_config_versions (context_config_id)
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_ai_context_versions_status
  ON ai_context_config_versions (status, created_at DESC);

-- Dataset columns (idempotent)
ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS context_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS context_config_version text,
  ADD COLUMN IF NOT EXISTS context_mode text,
  ADD COLUMN IF NOT EXISTS model_context_limit integer,
  ADD COLUMN IF NOT EXISTS available_context_tokens integer,
  ADD COLUMN IF NOT EXISTS estimated_context_tokens integer,
  ADD COLUMN IF NOT EXISTS included_chunk_count integer,
  ADD COLUMN IF NOT EXISTS excluded_chunk_count integer,
  ADD COLUMN IF NOT EXISTS included_document_count integer,
  ADD COLUMN IF NOT EXISTS redundancy_removed_count integer,
  ADD COLUMN IF NOT EXISTS neighbors_added_count integer,
  ADD COLUMN IF NOT EXISTS context_build_latency_ms integer,
  ADD COLUMN IF NOT EXISTS context_fallback_used boolean,
  ADD COLUMN IF NOT EXISTS insufficient_context boolean,
  ADD COLUMN IF NOT EXISTS conflict_detected boolean,
  ADD COLUMN IF NOT EXISTS context_utilization_rate numeric,
  ADD COLUMN IF NOT EXISTS relevant_context_rate numeric;

ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS context_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS context_mode_override_used boolean DEFAULT false;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS avg_available_context_tokens numeric,
  ADD COLUMN IF NOT EXISTS avg_estimated_context_tokens numeric,
  ADD COLUMN IF NOT EXISTS avg_context_utilization_rate numeric,
  ADD COLUMN IF NOT EXISTS avg_included_chunks numeric,
  ADD COLUMN IF NOT EXISTS avg_excluded_chunks numeric,
  ADD COLUMN IF NOT EXISTS context_overflow_count integer,
  ADD COLUMN IF NOT EXISTS empty_context_count integer,
  ADD COLUMN IF NOT EXISTS context_fallback_count integer,
  ADD COLUMN IF NOT EXISTS insufficient_context_count integer,
  ADD COLUMN IF NOT EXISTS avg_context_build_latency_ms numeric;
`);

const legacyConfig = {
  mode: 'LEGACY',
  modelName: 'gpt-4.1-mini',
  contextLimitTokens: 32000,
  maxInputTokens: 28000,
  reservedResponseTokens: 1200,
  reservedSystemTokens: 2000,
  safetyMarginTokens: 800,
  maxChunks: 12,
  maxChunksPerDocument: 4,
  minChunkScore: 0,
  enableNeighbors: false,
  maxNeighborsPerChunk: 0,
  enableRedundancyRemoval: false,
  redundancyThreshold: 0.92,
  enableConflictPreservation: true,
  tokenizer: 'conservative_char_div_3',
  notes: 'Seed LEGACY — equivalente à montagem atual, com orçamento medido sem corte agressivo.',
};

const budgetConfig = {
  mode: 'BUDGETED',
  modelName: 'gpt-4.1-mini',
  contextLimitTokens: 32000,
  maxInputTokens: 28000,
  reservedResponseTokens: 1200,
  reservedSystemTokens: 2000,
  safetyMarginTokens: 800,
  maxChunks: 12,
  maxChunksPerDocument: 4,
  minChunkScore: 0,
  enableNeighbors: false,
  maxNeighborsPerChunk: 1,
  enableRedundancyRemoval: true,
  redundancyThreshold: 0.92,
  enableConflictPreservation: true,
  tokenizer: 'conservative_char_div_3',
  notes: 'Candidato BUDGETED — seleção por orçamento + redundância. Vizinhos desativados.',
};

function hash(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 32);
}

let defId;
const existing = await client.query(
  `SELECT id FROM ai_context_configs WHERE code='AI_QUERY_CONTEXT' LIMIT 1`,
);
if (existing.rows[0]) {
  defId = existing.rows[0].id;
} else {
  defId = randomUUID();
  await client.query(
    `INSERT INTO ai_context_configs (id, code, purpose, description, active)
     VALUES ($1,'AI_QUERY_CONTEXT','AI_QUERY_CONTEXT','Governança da janela de contexto da Consulta IA',true)`,
    [defId],
  );
}

async function ensureVersion(label, mode, status, configuration, versionNumber) {
  const found = await client.query(
    `SELECT id, status FROM ai_context_config_versions
     WHERE context_config_id=$1 AND version_label=$2 LIMIT 1`,
    [defId, label],
  );
  if (found.rows[0]) {
    await client.query(
      `UPDATE ai_context_config_versions
       SET mode=$1, configuration=$2::jsonb, content_hash=$3, status=COALESCE(status, $4), updated_at=NOW()
       WHERE id=$5`,
      [mode, JSON.stringify(configuration), hash(configuration), status, found.rows[0].id].slice(0, 5).concat
        ? undefined
        : undefined,
    ).catch(async () => {
      await client.query(
        `UPDATE ai_context_config_versions
         SET mode=$1, configuration=$2::jsonb, content_hash=$3
         WHERE id=$4`,
        [mode, JSON.stringify(configuration), hash(configuration), found.rows[0].id],
      );
    });
    return found.rows[0].id;
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO ai_context_config_versions (
      id, context_config_id, version_number, version_label, status, mode, environment,
      model_name, configuration, content_hash, published_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'PRODUCTION',$7,$8::jsonb,$9,$10)`,
    [
      id,
      defId,
      versionNumber,
      label,
      status,
      mode,
      configuration.modelName,
      JSON.stringify(configuration),
      hash(configuration),
      status === 'PUBLISHED' ? new Date() : null,
    ],
  );
  return id;
}

// Fix ensureVersion update - the catch path is messy. Rewrite cleanly:
async function upsertVersion(label, mode, status, configuration, versionNumber) {
  const found = await client.query(
    `SELECT id, status FROM ai_context_config_versions
     WHERE context_config_id=$1 AND version_label=$2 LIMIT 1`,
    [defId, label],
  );
  if (found.rows[0]) {
    await client.query(
      `UPDATE ai_context_config_versions
       SET mode=$1, configuration=$2::jsonb, content_hash=$3, model_name=$4
       WHERE id=$5`,
      [mode, JSON.stringify(configuration), hash(configuration), configuration.modelName, found.rows[0].id],
    );
    return { id: found.rows[0].id, status: found.rows[0].status, created: false };
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO ai_context_config_versions (
      id, context_config_id, version_number, version_label, status, mode, environment,
      model_name, configuration, content_hash, published_at
    ) VALUES ($1,$2,$3,$4,$5,$6,'PRODUCTION',$7,$8::jsonb,$9,$10)`,
    [
      id,
      defId,
      versionNumber,
      label,
      status,
      mode,
      configuration.modelName,
      JSON.stringify(configuration),
      hash(configuration),
      status === 'PUBLISHED' ? new Date() : null,
    ],
  );
  return { id, status, created: true };
}

const legacy = await upsertVersion('context-v1', 'LEGACY', 'PUBLISHED', legacyConfig, 1);
const budget = await upsertVersion('context-budget-v1', 'BUDGETED', 'DRAFT', budgetConfig, 2);

const check = await client.query(
  `SELECT version_label, mode, status FROM ai_context_config_versions WHERE context_config_id=$1 ORDER BY version_number`,
  [defId],
);

writeFileSync(
  new URL('./_cwm-migration.json', import.meta.url),
  JSON.stringify({ defId, legacy, budget, versions: check.rows }, null, 2),
);
console.log(JSON.stringify({ defId, legacy, budget, versions: check.rows }, null, 2));
await client.end();
