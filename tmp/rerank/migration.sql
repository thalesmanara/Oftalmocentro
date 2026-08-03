-- Etapa 20 — Retrieval / Re-ranking configs (idempotent)

CREATE TABLE IF NOT EXISTS ai_retrieval_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'AI_QUERY_RETRIEVAL',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_retrieval_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retrieval_config_id uuid NOT NULL REFERENCES ai_retrieval_configs(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED','REJECTED')),
  mode text NOT NULL CHECK (mode IN ('TEXT_ONLY','VECTOR_ONLY','HYBRID','HYBRID_RERANK')),
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text NOT NULL,
  validation_run_id uuid,
  validation_score numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  published_by uuid,
  UNIQUE (retrieval_config_id, version_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_retrieval_one_published
  ON ai_retrieval_config_versions (retrieval_config_id)
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_ai_retrieval_versions_status
  ON ai_retrieval_config_versions (status);

ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS retrieval_config_version text,
  ADD COLUMN IF NOT EXISTS retrieval_latency_ms integer,
  ADD COLUMN IF NOT EXISTS rerank_latency_ms integer,
  ADD COLUMN IF NOT EXISTS fallback_used boolean;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS candidates_retrieved integer,
  ADD COLUMN IF NOT EXISTS candidates_reranked integer,
  ADD COLUMN IF NOT EXISTS expected_document_rank integer,
  ADD COLUMN IF NOT EXISTS retrieval_latency_ms integer,
  ADD COLUMN IF NOT EXISTS rerank_latency_ms integer,
  ADD COLUMN IF NOT EXISTS final_context_count integer,
  ADD COLUMN IF NOT EXISTS retrieval_config_version text,
  ADD COLUMN IF NOT EXISTS fallback_used boolean,
  ADD COLUMN IF NOT EXISTS rerank_score double precision;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS recall_at_k numeric,
  ADD COLUMN IF NOT EXISTS precision_at_k numeric,
  ADD COLUMN IF NOT EXISTS mrr numeric,
  ADD COLUMN IF NOT EXISTS hit_rate numeric,
  ADD COLUMN IF NOT EXISTS avg_retrieval_latency_ms numeric,
  ADD COLUMN IF NOT EXISTS avg_rerank_latency_ms numeric,
  ADD COLUMN IF NOT EXISTS fallback_count integer;

INSERT INTO ai_retrieval_configs (code, purpose, description, active)
SELECT 'AI_QUERY_RETRIEVAL', 'AI_QUERY_RETRIEVAL', 'Configuração de recuperação e re-ranking da Consulta IA', true
WHERE NOT EXISTS (SELECT 1 FROM ai_retrieval_configs WHERE code = 'AI_QUERY_RETRIEVAL');

INSERT INTO app_secrets (key, value)
SELECT 'retrieval_active_mode', 'HYBRID'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'retrieval_active_mode');

INSERT INTO app_secrets (key, value)
SELECT 'retrieval_config_code', 'AI_QUERY_RETRIEVAL'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'retrieval_config_code');
