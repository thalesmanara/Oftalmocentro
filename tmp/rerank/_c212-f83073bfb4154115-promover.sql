WITH pub AS (
  UPDATE ai_context_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      published_by=NULLIF('{{ $('Avaliar run').first().json.userId || "" }}','')::uuid,
      validation_run_id=NULLIF('{{ $('Avaliar run').first().json.validationRunId || "" }}','')::uuid
  WHERE v.id = NULLIF('{{ $('Avaliar run').first().json.versionId }}','')::uuid
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='retrieval_active_version')
SELECT * FROM pub;