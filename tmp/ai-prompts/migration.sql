-- Etapa 17: Governança corporativa de prompts (idempotente)
BEGIN;

CREATE TABLE IF NOT EXISTS ai_prompt_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  purpose text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_definitions_purpose ON ai_prompt_definitions(purpose);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_definitions_active ON ai_prompt_definitions(active);

CREATE TABLE IF NOT EXISTS ai_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_definition_id uuid NOT NULL REFERENCES ai_prompt_definitions(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  status text NOT NULL,
  environment text NOT NULL DEFAULT 'PRODUCTION',
  content text NOT NULL,
  model_name text NOT NULL,
  temperature numeric(4,3),
  max_tokens integer,
  top_p numeric(4,3),
  response_format jsonb,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_summary text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid,
  published_at timestamptz,
  archived_at timestamptz,
  based_on_version_id uuid REFERENCES ai_prompt_versions(id) ON DELETE SET NULL,
  content_hash text NOT NULL,
  validation_run_id uuid,
  validation_score numeric(5,2),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ai_prompt_versions_status_chk CHECK (
    status IN ('DRAFT', 'VALIDATING', 'PUBLISHED', 'ARCHIVED', 'REJECTED')
  ),
  CONSTRAINT ai_prompt_versions_env_chk CHECK (
    environment IN ('PRODUCTION', 'STAGING')
  ),
  CONSTRAINT ai_prompt_versions_content_nonempty_chk CHECK (length(btrim(content)) > 0),
  UNIQUE (prompt_definition_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_def ON ai_prompt_versions(prompt_definition_id);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_status ON ai_prompt_versions(status);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_env ON ai_prompt_versions(environment);
CREATE INDEX IF NOT EXISTS idx_ai_prompt_versions_hash ON ai_prompt_versions(content_hash);

-- Apenas uma PUBLISHED por definição + ambiente
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_prompt_one_published
  ON ai_prompt_versions (prompt_definition_id, environment)
  WHERE status = 'PUBLISHED';

-- Dataset: vincular versão formal (compatível com prompt_version texto legado)
ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid REFERENCES ai_prompt_versions(id) ON DELETE SET NULL;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS prompt_version_id uuid REFERENCES ai_prompt_versions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ai_test_runs_prompt_version_id ON ai_test_runs(prompt_version_id);
CREATE INDEX IF NOT EXISTS idx_ai_test_results_prompt_version_id ON ai_test_results(prompt_version_id);

-- Allowlist de modelos / limites (configuração operacional)
INSERT INTO app_secrets (key, value)
SELECT 'ai_prompt_allowed_models', 'gpt-4.1-mini,gpt-4.1,gpt-4o-mini,gpt-4o'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'ai_prompt_allowed_models');

INSERT INTO app_secrets (key, value)
SELECT 'ai_prompt_max_temperature', '1.0'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'ai_prompt_max_temperature');

INSERT INTO app_secrets (key, value)
SELECT 'ai_prompt_max_tokens_limit', '4096'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'ai_prompt_max_tokens_limit');

INSERT INTO app_secrets (key, value)
SELECT 'ai_prompt_regression_threshold', '2'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'ai_prompt_regression_threshold');

COMMIT;
