-- Etapa 23 — Evidence Layer governance + lab metrics

CREATE TABLE IF NOT EXISTS ai_evidence_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  purpose text NOT NULL DEFAULT 'AI_QUERY_EVIDENCE',
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_evidence_config_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_config_id uuid NOT NULL REFERENCES ai_evidence_configs(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_label text NOT NULL,
  status text NOT NULL CHECK (status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED','REJECTED')),
  mode text NOT NULL CHECK (mode IN ('DISABLED','PASSTHROUGH','STRUCTURED','STRUCTURED_STRICT')),
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
  UNIQUE (evidence_config_id, version_number),
  UNIQUE (evidence_config_id, version_label)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_evidence_one_published
  ON ai_evidence_config_versions (evidence_config_id)
  WHERE status = 'PUBLISHED';

CREATE INDEX IF NOT EXISTS idx_ai_evidence_versions_status
  ON ai_evidence_config_versions (status, created_at DESC);

-- Lab metrics (idempotent)
ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS evidence_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS evidence_config_version text,
  ADD COLUMN IF NOT EXISTS evidence_mode text,
  ADD COLUMN IF NOT EXISTS evidence_count integer,
  ADD COLUMN IF NOT EXISTS average_evidence_score numeric,
  ADD COLUMN IF NOT EXISTS highest_evidence_score numeric,
  ADD COLUMN IF NOT EXISTS evidence_conflict_count integer,
  ADD COLUMN IF NOT EXISTS evidence_redundancy_count integer,
  ADD COLUMN IF NOT EXISTS evidence_coverage_rate numeric,
  ADD COLUMN IF NOT EXISTS evidence_confidence_avg numeric,
  ADD COLUMN IF NOT EXISTS evidence_diversity_score numeric,
  ADD COLUMN IF NOT EXISTS evidence_build_latency_ms integer;

ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS evidence_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS evidence_mode_override_used boolean DEFAULT false;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS avg_evidence_score numeric,
  ADD COLUMN IF NOT EXISTS avg_evidence_count numeric,
  ADD COLUMN IF NOT EXISTS evidence_conflict_rate numeric,
  ADD COLUMN IF NOT EXISTS evidence_redundancy_rate numeric,
  ADD COLUMN IF NOT EXISTS avg_evidence_coverage numeric,
  ADD COLUMN IF NOT EXISTS avg_evidence_confidence numeric,
  ADD COLUMN IF NOT EXISTS avg_evidence_diversity numeric,
  ADD COLUMN IF NOT EXISTS avg_evidence_build_latency_ms numeric;
