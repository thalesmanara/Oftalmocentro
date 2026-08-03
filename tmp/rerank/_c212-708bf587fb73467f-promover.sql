WITH pub AS (
  UPDATE ai_context_config_versions v
  SET status='PUBLISHED', published_at=NOW(),
      notes = COALESCE(notes,'') || ' | rollback: ' || '{{ String($('Preparar rollback').first().json.reason || "").replace(/'/g, "''") }}'
  WHERE v.id = NULLIF('{{ $('Preparar rollback').first().json.targetVersionId }}','')::uuid
  RETURNING v.id, v.version_label, v.mode, v.status, v.published_at, v.configuration, v.content_hash, v.version_number
), s1 AS (UPDATE app_secrets SET value=(SELECT mode FROM pub), updated_at=NOW() WHERE key='retrieval_active_mode'),
s2 AS (UPDATE app_secrets SET value=(SELECT version_label FROM pub), updated_at=NOW() WHERE key='retrieval_active_version')
SELECT * FROM pub;