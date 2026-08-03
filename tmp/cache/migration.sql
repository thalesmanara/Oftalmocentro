-- Etapa 22 — Cache Semântico (idempotente)
-- Produção inicia em SHADOW / cache-shadow-v1 (não serve resposta do cache)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_cache_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'AI_QUERY_CACHE',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_cache_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_config_id uuid NOT NULL REFERENCES ai_cache_configs(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED','REJECTED')),
  mode text NOT NULL CHECK (mode IN ('DISABLED','SHADOW','EXACT_ONLY','NORMALIZED','SEMANTIC')),
  environment text NOT NULL DEFAULT 'production',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  validation_run_id uuid,
  validation_score numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid,
  archived_at timestamptz,
  UNIQUE (cache_config_id, version_number),
  UNIQUE (version_label)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_cache_one_published
  ON ai_cache_config_versions (cache_config_id)
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_ai_cache_versions_status ON ai_cache_config_versions (status);
CREATE INDEX IF NOT EXISTS idx_ai_cache_versions_mode ON ai_cache_config_versions (mode);

CREATE TABLE IF NOT EXISTS ai_semantic_cache_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key_hash varchar NOT NULL,
  question_hash varchar NOT NULL,
  normalized_question text NOT NULL,
  question_embedding jsonb NULL,
  question_embedding_model varchar NULL,
  question_embedding_dimensions integer NULL,
  scope_hash varchar NOT NULL,
  classification_hash varchar NULL,
  prompt_version_id uuid NOT NULL,
  prompt_hash varchar NOT NULL,
  retrieval_config_version_id uuid NULL,
  retrieval_config_hash varchar NULL,
  context_config_version_id uuid NULL,
  context_config_hash varchar NULL,
  model_name varchar NOT NULL,
  model_parameters_hash varchar NOT NULL DEFAULT '',
  source_fingerprint varchar NOT NULL,
  document_version_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_document_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification jsonb NULL,
  response_hash varchar NOT NULL,
  status varchar NOT NULL DEFAULT 'VALID'
    CHECK (status IN ('VALID','EXPIRED','INVALIDATED','QUARANTINED','ERROR')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_hit_at timestamptz NULL,
  hit_count bigint NOT NULL DEFAULT 0,
  validation_count bigint NOT NULL DEFAULT 0,
  invalidated_at timestamptz NULL,
  invalidation_reason varchar NULL,
  conflict_detected boolean NOT NULL DEFAULT false,
  insufficient_context boolean NOT NULL DEFAULT false,
  contains_sensitive_data boolean NOT NULL DEFAULT false,
  cache_config_version_id uuid NULL REFERENCES ai_cache_config_versions(id),
  metadata jsonb NULL,
  UNIQUE (cache_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_question_hash ON ai_semantic_cache_entries (question_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_scope_hash ON ai_semantic_cache_entries (scope_hash);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_expires_at ON ai_semantic_cache_entries (expires_at);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_status ON ai_semantic_cache_entries (status);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_prompt ON ai_semantic_cache_entries (prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_retrieval ON ai_semantic_cache_entries (retrieval_config_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_context ON ai_semantic_cache_entries (context_config_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_fingerprint ON ai_semantic_cache_entries (source_fingerprint);
CREATE INDEX IF NOT EXISTS idx_ai_cache_entries_last_hit ON ai_semantic_cache_entries (last_hit_at);

CREATE TABLE IF NOT EXISTS ai_semantic_cache_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_entry_id uuid NOT NULL REFERENCES ai_semantic_cache_entries(id) ON DELETE CASCADE,
  document_id uuid NULL,
  document_version_id uuid NULL,
  content_hash varchar NULL,
  dependency_type varchar NOT NULL DEFAULT 'DOCUMENT_VERSION',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_cache_deps_entry ON ai_semantic_cache_dependencies (cache_entry_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_deps_doc ON ai_semantic_cache_dependencies (document_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_deps_docver ON ai_semantic_cache_dependencies (document_version_id);

CREATE TABLE IF NOT EXISTS ai_cache_metrics_daily (
  day date PRIMARY KEY,
  lookups bigint NOT NULL DEFAULT 0,
  hits bigint NOT NULL DEFAULT 0,
  misses bigint NOT NULL DEFAULT 0,
  exact_hits bigint NOT NULL DEFAULT 0,
  normalized_hits bigint NOT NULL DEFAULT 0,
  semantic_hits bigint NOT NULL DEFAULT 0,
  shadow_candidates bigint NOT NULL DEFAULT 0,
  shadow_agreements bigint NOT NULL DEFAULT 0,
  false_hits bigint NOT NULL DEFAULT 0,
  saves bigint NOT NULL DEFAULT 0,
  invalidations bigint NOT NULL DEFAULT 0,
  estimated_tokens_saved bigint NOT NULL DEFAULT 0,
  estimated_latency_saved_ms bigint NOT NULL DEFAULT 0,
  lookup_latency_sum_ms bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lab columns
ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS cache_config_version text,
  ADD COLUMN IF NOT EXISTS cache_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS cache_mode text;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS cache_mode text,
  ADD COLUMN IF NOT EXISTS cache_config_version text,
  ADD COLUMN IF NOT EXISTS cache_lookup_latency_ms integer,
  ADD COLUMN IF NOT EXISTS cache_hit boolean,
  ADD COLUMN IF NOT EXISTS cache_hit_type text,
  ADD COLUMN IF NOT EXISTS cache_miss_reason text,
  ADD COLUMN IF NOT EXISTS cache_semantic_similarity double precision,
  ADD COLUMN IF NOT EXISTS cache_entry_age_seconds integer,
  ADD COLUMN IF NOT EXISTS answer_from_cache boolean,
  ADD COLUMN IF NOT EXISTS source_fingerprint_match boolean,
  ADD COLUMN IF NOT EXISTS cache_answer_agreement boolean,
  ADD COLUMN IF NOT EXISTS cache_source_agreement boolean,
  ADD COLUMN IF NOT EXISTS cache_estimated_tokens_saved integer,
  ADD COLUMN IF NOT EXISTS cache_estimated_cost_saved numeric,
  ADD COLUMN IF NOT EXISTS cache_estimated_latency_saved_ms integer,
  ADD COLUMN IF NOT EXISTS cache_shadow_candidate boolean;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS cache_hit_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_exact_hit_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_semantic_hit_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_false_hit_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_miss_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_cacheable_query_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_avg_lookup_latency_ms numeric,
  ADD COLUMN IF NOT EXISTS cache_estimated_tokens_saved numeric,
  ADD COLUMN IF NOT EXISTS cache_estimated_cost_saved numeric,
  ADD COLUMN IF NOT EXISTS cache_estimated_latency_saved_ms numeric,
  ADD COLUMN IF NOT EXISTS cache_answer_agreement_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_source_agreement_rate numeric,
  ADD COLUMN IF NOT EXISTS cache_shadow_candidate_count integer;

-- Definition + SHADOW seed
INSERT INTO ai_cache_configs (code, purpose, description, active)
SELECT 'AI_QUERY_CACHE', 'AI_QUERY_CACHE', 'Cache semântico da Consulta IA', true
WHERE NOT EXISTS (SELECT 1 FROM ai_cache_configs WHERE code = 'AI_QUERY_CACHE');

INSERT INTO ai_cache_config_versions (
  cache_config_id, version_number, version_label, status, mode, environment,
  configuration, content_hash, notes, published_at
)
SELECT
  c.id,
  1,
  'cache-shadow-v1',
  'PUBLISHED',
  'SHADOW',
  'production',
  jsonb_build_object(
    'mode', 'SHADOW',
    'exactEnabled', true,
    'normalizedEnabled', true,
    'semanticEnabled', false,
    'semanticThreshold', 0.92,
    'ttlSeconds', 86400,
    'maxEntries', 5000,
    'maxEntriesPerScope', 500,
    'cacheNegativeAnswers', false,
    'cacheInsufficientContext', false,
    'cacheConflictResponses', false,
    'cacheSensitiveQueries', false,
    'requireSameSources', true,
    'requireSameDocumentVersions', true,
    'requireSamePromptVersion', true,
    'requireSameRetrievalVersion', true,
    'requireSameContextVersion', true,
    'requireSameModel', true,
    'scopeMode', 'PERMISSION_SET',
    'cacheSchemaVersion', 'v1',
    'qdrantCollection', 'oftalmocentro_query_cache'
  ),
  'seed-cache-shadow-v1',
  'Seed Etapa 22 — SHADOW (não serve resposta do cache)',
  NOW()
FROM ai_cache_configs c
WHERE c.code = 'AI_QUERY_CACHE'
  AND NOT EXISTS (
    SELECT 1 FROM ai_cache_config_versions v WHERE v.version_label = 'cache-shadow-v1'
  );

INSERT INTO app_secrets (key, value, updated_at)
SELECT 'cache_active_mode', 'SHADOW', NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'cache_active_mode');

INSERT INTO app_secrets (key, value, updated_at)
SELECT 'cache_active_version', 'cache-shadow-v1', NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'cache_active_version');

UPDATE app_secrets SET value = 'SHADOW', updated_at = NOW() WHERE key = 'cache_active_mode';
UPDATE app_secrets SET value = 'cache-shadow-v1', updated_at = NOW() WHERE key = 'cache_active_version';
