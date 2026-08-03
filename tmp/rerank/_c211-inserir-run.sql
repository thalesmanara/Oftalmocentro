=INSERT INTO ai_test_runs (status, triggered_by, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version, prompt_version_id, embedding_model, embedding_version, retrieval_mode, retrieval_config_version, retrieval_config_version_id, mode_override_used, context_config_version_id, context_mode_override_used)
SELECT
  'STARTED',
  NULLIF('{{ $json.triggeredBy || "" }}', '')::uuid,
  '{{ String($json.triggerMode || "dataset").replace(/'/g, "''") }}',
  COALESCE(
    CASE WHEN pv.id IS NOT NULL THEN pv.prompt_code || '@v' || pv.version_number || ':' || substring(pv.content_hash from 1 for 12) END,
    (SELECT value FROM app_secrets WHERE key='ai_eval_prompt_version' LIMIT 1),
    'unknown'
  ),
  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_model_name' LIMIT 1), 'unknown'),
  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_ocr_engine_version' LIMIT 1), 'n/a'),
  COALESCE((SELECT value FROM app_secrets WHERE key='ai_eval_tabular_engine_version' LIMIT 1), 'n/a'),
  pv.id,
  COALESCE((SELECT value FROM app_secrets WHERE key='embedding_model' LIMIT 1), 'unknown'),
  COALESCE((SELECT value FROM app_secrets WHERE key='embedding_engine_version' LIMIT 1), 'unknown'),
  CASE WHEN NULLIF(TRIM('{{ $json.retrievalConfigVersionId || "" }}'),'') IS NOT NULL THEN (SELECT mode FROM ai_retrieval_config_versions WHERE id=NULLIF(TRIM('{{ $json.retrievalConfigVersionId || "" }}'),'')::uuid) ELSE COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), 'HYBRID') END,
  CASE WHEN NULLIF(TRIM('{{ $json.retrievalConfigVersionId || "" }}'),'') IS NOT NULL THEN (SELECT version_label FROM ai_retrieval_config_versions WHERE id=NULLIF(TRIM('{{ $json.retrievalConfigVersionId || "" }}'),'')::uuid) ELSE COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1), 'hybrid-v1') END,
  NULLIF(TRIM('{{ $json.retrievalConfigVersionId || "" }}'),'')::uuid,
  (NULLIF(TRIM('{{ $json.retrievalConfigVersionId || "" }}'),'') IS NOT NULL)
FROM (SELECT 1) x
LEFT JOIN LATERAL (
  SELECT v.id, d.code AS prompt_code, v.version_number, v.content_hash
  FROM ai_prompt_versions v
  JOIN ai_prompt_definitions d ON d.id = v.prompt_definition_id
  WHERE NULLIF('{{ String($json.promptVersionId || "").replace(/'/g, "''") }}', '') IS NOT NULL
    AND v.id = NULLIF('{{ String($json.promptVersionId || "").replace(/'/g, "''") }}', '')::uuid
) pv ON true
 ,
  NULLIF(TRIM('{{ $json.contextConfigVersionId || "" }}'),'')::uuid,
  CASE WHEN NULLIF(TRIM('{{ $json.contextConfigVersionId || "" }}'),'') IS NOT NULL THEN true ELSE false END
RETURNING id, started_at, status, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version, triggered_by, prompt_version_id;