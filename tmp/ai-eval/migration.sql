-- Etapa 16: Framework de validação da IA (idempotente)
BEGIN;

CREATE TABLE IF NOT EXISTS ai_test_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  group_name text NOT NULL,
  test_type text NOT NULL,
  category_name text,
  subcategory_name text,
  expected_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  expected_document_ids uuid[] DEFAULT '{}',
  question text NOT NULL,
  expected_answer text,
  required_words text[] NOT NULL DEFAULT '{}',
  forbidden_words text[] NOT NULL DEFAULT '{}',
  required_source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  min_score numeric(5,2) NOT NULL DEFAULT 70,
  expect_no_answer boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'active',
  version integer NOT NULL DEFAULT 1,
  depends_on_missing_docs boolean NOT NULL DEFAULT false,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  updated_at timestamp without time zone NOT NULL DEFAULT now(),
  UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_ai_test_cases_group ON ai_test_cases(group_name);
CREATE INDEX IF NOT EXISTS idx_ai_test_cases_status ON ai_test_cases(status);
CREATE INDEX IF NOT EXISTS idx_ai_test_cases_type ON ai_test_cases(test_type);

CREATE TABLE IF NOT EXISTS ai_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamp without time zone NOT NULL DEFAULT now(),
  finished_at timestamp without time zone,
  duration_ms integer,
  status text NOT NULL DEFAULT 'STARTED',
  triggered_by uuid,
  trigger_mode text NOT NULL DEFAULT 'dataset',
  total_cases integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  overall_score numeric(5,2),
  prompt_version text,
  model_name text,
  ocr_engine_version text,
  tabular_engine_version text,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_test_runs_started ON ai_test_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_test_runs_status ON ai_test_runs(status);

CREATE TABLE IF NOT EXISTS ai_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES ai_test_runs(id) ON DELETE CASCADE,
  case_id uuid NOT NULL REFERENCES ai_test_cases(id) ON DELETE CASCADE,
  case_code text,
  question text NOT NULL,
  answer text,
  duration_ms integer,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  chunk_refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  classification jsonb,
  matched_document boolean,
  matched_category boolean,
  matched_subcategory boolean,
  required_words_hit integer NOT NULL DEFAULT 0,
  required_words_total integer NOT NULL DEFAULT 0,
  forbidden_words_hit integer NOT NULL DEFAULT 0,
  sources_correct boolean,
  sources_incorrect boolean,
  is_hallucination boolean NOT NULL DEFAULT false,
  is_empty_answer boolean NOT NULL DEFAULT false,
  is_internal_error boolean NOT NULL DEFAULT false,
  score numeric(5,2),
  verdict text NOT NULL,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction_method text,
  ocr_quality_grade text,
  ocr_used boolean,
  sheet_name text,
  headers_json jsonb,
  prompt_version text,
  model_name text,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_test_results_run ON ai_test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_ai_test_results_case ON ai_test_results(case_id);
CREATE INDEX IF NOT EXISTS idx_ai_test_results_verdict ON ai_test_results(verdict);

CREATE TABLE IF NOT EXISTS ai_test_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES ai_test_runs(id) ON DELETE CASCADE,
  precision numeric(5,2),
  recall numeric(5,2),
  document_coverage numeric(5,2),
  category_coverage jsonb NOT NULL DEFAULT '{}'::jsonb,
  avg_duration_ms numeric(12,2),
  min_duration_ms integer,
  max_duration_ms integer,
  sources_correct_count integer NOT NULL DEFAULT 0,
  sources_incorrect_count integer NOT NULL DEFAULT 0,
  document_correct_count integer NOT NULL DEFAULT 0,
  category_correct_count integer NOT NULL DEFAULT 0,
  subcategory_correct_count integer NOT NULL DEFAULT 0,
  hallucination_count integer NOT NULL DEFAULT 0,
  empty_answer_count integer NOT NULL DEFAULT 0,
  internal_error_count integer NOT NULL DEFAULT 0,
  passed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  total_count integer NOT NULL DEFAULT 0,
  overall_score numeric(5,2),
  top_errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  score_formula text,
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

INSERT INTO app_secrets (key, value)
SELECT 'ai_eval_prompt_version', 'consulta-ia-v1-inline-2026-08-03'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key='ai_eval_prompt_version');

INSERT INTO app_secrets (key, value)
SELECT 'ai_eval_model_name', 'gpt-4.1-mini'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key='ai_eval_model_name');

INSERT INTO app_secrets (key, value)
SELECT 'ai_eval_max_latency_ms', '30000'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key='ai_eval_max_latency_ms');

INSERT INTO app_secrets (key, value)
SELECT 'ai_eval_refusal_phrase', 'Não encontrei essa informação na base documental disponível.'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key='ai_eval_refusal_phrase');

COMMIT;
