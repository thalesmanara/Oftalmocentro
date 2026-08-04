-- Etapa 24 — Response Quality Layer governance + lab metrics

CREATE TABLE IF NOT EXISTS ai_response_quality_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'AI_QUERY_RESPONSE_QUALITY',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_response_quality_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_quality_config_id uuid NOT NULL REFERENCES ai_response_quality_configs(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED','REJECTED')),
  mode text NOT NULL CHECK (mode IN ('DISABLED','PASSTHROUGH','VALIDATE','VALIDATE_STRICT')),
  environment text NOT NULL DEFAULT 'PRODUCTION',
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_hash text,
  validation_run_id uuid,
  validation_score numeric,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_by uuid,
  published_at timestamptz,
  archived_at timestamptz,
  UNIQUE (response_quality_config_id, version_number),
  UNIQUE (response_quality_config_id, version_label)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_response_quality_one_published
  ON ai_response_quality_config_versions (response_quality_config_id)
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_ai_response_quality_versions_status
  ON ai_response_quality_config_versions (status, created_at DESC);

-- Lab metrics (idempotent)
ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS response_quality_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS response_quality_config_version text,
  ADD COLUMN IF NOT EXISTS response_quality_mode text,
  ADD COLUMN IF NOT EXISTS quality_score numeric,
  ADD COLUMN IF NOT EXISTS quality_grade text,
  ADD COLUMN IF NOT EXISTS evidence_coverage numeric,
  ADD COLUMN IF NOT EXISTS source_coverage numeric,
  ADD COLUMN IF NOT EXISTS consistency_status text,
  ADD COLUMN IF NOT EXISTS conflict_detected boolean,
  ADD COLUMN IF NOT EXISTS hallucination_flag boolean,
  ADD COLUMN IF NOT EXISTS missing_sources boolean,
  ADD COLUMN IF NOT EXISTS citation_quality numeric,
  ADD COLUMN IF NOT EXISTS response_quality_latency_ms integer;

ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS response_quality_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS response_quality_mode_override_used boolean DEFAULT false;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS avg_quality_score numeric,
  ADD COLUMN IF NOT EXISTS avg_evidence_coverage numeric,
  ADD COLUMN IF NOT EXISTS avg_source_coverage numeric,
  ADD COLUMN IF NOT EXISTS consistency_ok_rate numeric,
  ADD COLUMN IF NOT EXISTS conflict_rate numeric,
  ADD COLUMN IF NOT EXISTS hallucination_rate numeric,
  ADD COLUMN IF NOT EXISTS missing_sources_rate numeric,
  ADD COLUMN IF NOT EXISTS avg_citation_quality numeric,
  ADD COLUMN IF NOT EXISTS avg_response_quality_latency_ms numeric;
