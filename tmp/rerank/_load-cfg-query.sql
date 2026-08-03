SELECT
  c.code,
  v.id AS version_id,
  v.version_label,
  v.version_number,
  v.status,
  v.mode,
  v.configuration,
  v.content_hash,
  v.published_at,
  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), v.mode) AS secret_mode,
  CASE WHEN NULLIF(TRIM('={{ $json.versionId || "" }}'), '') IS NOT NULL THEN true ELSE false END AS override_used
FROM ai_retrieval_configs c
JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
WHERE c.code = COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_config_code' LIMIT 1), 'AI_QUERY_RETRIEVAL')
  AND c.active = true
  AND (
    (NULLIF(TRIM('={{ $json.versionId || "" }}'), '') IS NOT NULL
      AND v.id = NULLIF(TRIM('={{ $json.versionId || "" }}'), '')::uuid
      AND v.status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED'))
    OR
    (NULLIF(TRIM('={{ $json.versionId || "" }}'), '') IS NULL AND v.status = 'PUBLISHED')
  )
ORDER BY CASE WHEN v.status='PUBLISHED' THEN 0 ELSE 1 END, v.published_at DESC NULLS LAST
LIMIT 1;