-- Etapa 25 — Response Policy metrics (extends Response Quality; no new policy tables)

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS response_policy_strategy text,
  ADD COLUMN IF NOT EXISTS response_policy_reason_codes jsonb,
  ADD COLUMN IF NOT EXISTS response_policy_warning boolean,
  ADD COLUMN IF NOT EXISTS response_policy_modified boolean,
  ADD COLUMN IF NOT EXISTS response_policy_abstained boolean,
  ADD COLUMN IF NOT EXISTS response_policy_declined boolean,
  ADD COLUMN IF NOT EXISTS response_policy_clarification_required boolean,
  ADD COLUMN IF NOT EXISTS response_policy_latency_ms integer;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS response_policy_warning_rate numeric,
  ADD COLUMN IF NOT EXISTS response_policy_limitation_rate numeric,
  ADD COLUMN IF NOT EXISTS response_policy_clarification_rate numeric,
  ADD COLUMN IF NOT EXISTS response_policy_abstention_rate numeric,
  ADD COLUMN IF NOT EXISTS response_policy_decline_rate numeric,
  ADD COLUMN IF NOT EXISTS response_policy_conflict_explanation_rate numeric,
  ADD COLUMN IF NOT EXISTS response_policy_low_confidence_handling_rate numeric,
  ADD COLUMN IF NOT EXISTS avg_response_policy_latency_ms numeric;
