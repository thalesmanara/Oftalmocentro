WITH t0 AS (SELECT clock_timestamp() AS started),
cfg AS (
  SELECT
    (SELECT COUNT(*)::int FROM settings) AS settings_count,
    EXISTS(
      SELECT 1 FROM app_secrets
      WHERE key = 'jwt_hs256_secret' AND COALESCE(length(value), 0) > 0
    ) AS jwt_ok,
    EXISTS(
      SELECT 1 FROM app_secrets
      WHERE key = 'session_ttl_seconds' AND COALESCE(length(value), 0) > 0
    ) AS ttl_ok
),
sess AS (
  SELECT COUNT(*)::int AS active_count
  FROM user_sessions
  WHERE COALESCE(revoked, false) = false
    AND expires_at > NOW()
),
doc_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND processing_status = 'processing')::int AS processing,
    COUNT(*) FILTER (
      WHERE deleted_at IS NULL AND processing_status IN ('error', 'failed')
    )::int AS errors,
    COUNT(*) FILTER (
      WHERE deleted_at IS NULL AND (file_path IS NULL OR btrim(file_path) = '')
    )::int AS missing_files,
    COUNT(*) FILTER (
      WHERE deleted_at IS NULL
        AND processing_status = 'processed'
        AND NOT EXISTS (
          SELECT 1 FROM document_chunks dc WHERE dc.document_id = documents.id
        )
    )::int AS processed_without_chunks
  FROM documents
),
ver_stats AS (
  SELECT
    (
      SELECT COUNT(*)::int
      FROM document_versions dv
      JOIN documents d ON d.id = dv.document_id
      WHERE d.deleted_at IS NULL
    ) AS versions_total,
    (
      SELECT COUNT(*)::int
      FROM document_chunks dc
      WHERE dc.document_version_id IS NULL
    ) AS orphan_chunks,
    (
      SELECT COUNT(*)::int
      FROM (
        SELECT document_id
        FROM document_versions
        WHERE is_current = true
        GROUP BY document_id
        HAVING COUNT(*) > 1
      ) multi
    ) AS multi_current
),
file_cfg AS (
  SELECT
    (SELECT value FROM app_secrets WHERE key = 'max_upload_size_bytes') AS max_upload_size_bytes,
    (SELECT value FROM app_secrets WHERE key = 'allowed_file_extensions') AS allowed_file_extensions
),
file_stats AS (
  SELECT
    COUNT(*) FILTER (
      WHERE dv.validation_status = 'INVALID'
        AND COALESCE(dv.validated_at, dv.created_at) >= NOW() - interval '24 hours'
    )::int AS invalid_recent_24h,
    COUNT(*) FILTER (
      WHERE dv.validation_status = 'VALIDATING'
    )::int AS pending_validating,
    COUNT(*) FILTER (
      WHERE (dv.validation_status = 'VALID' OR dv.validation_status IS NULL)
        AND dv.processing_status IN ('processing', 'pending')
    )::int AS valid_unprocessed,
    COUNT(*) FILTER (
      WHERE dv.validation_status = 'VALIDATING'
        AND COALESCE(dv.validated_at, dv.created_at) < NOW() - interval '30 minutes'
    )::int AS stuck_validating
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id
  WHERE d.deleted_at IS NULL
),
ocr_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE dv.ocr_status = 'PROCESSING')::int AS ocr_processing,
    COUNT(*) FILTER (WHERE dv.ocr_status = 'FAILED')::int AS ocr_failed,
    COUNT(*) FILTER (WHERE dv.ocr_status IN ('REQUIRED','OCR_REQUIRED'))::int AS ocr_pending,
    COUNT(*) FILTER (WHERE dv.ocr_status = 'MANUAL_REVIEW')::int AS ocr_manual_review,
    COUNT(*) FILTER (
      WHERE dv.ocr_status = 'PROCESSING'
        AND dv.ocr_started_at IS NOT NULL
        AND dv.ocr_started_at < NOW() - interval '10 minutes'
    )::int AS ocr_stuck,
    ROUND(AVG(dv.ocr_duration_ms) FILTER (
      WHERE dv.ocr_status = 'SUCCESS'
        AND dv.ocr_finished_at >= NOW() - interval '24 hours'
    ))::int AS ocr_avg_duration_ms,
    ROUND(AVG(dv.ocr_quality_score) FILTER (WHERE dv.ocr_quality_score IS NOT NULL))::int AS ocr_quality_avg_score,
    COUNT(*) FILTER (WHERE dv.ocr_quality_grade = 'EXCELLENT')::int AS ocr_quality_excellent,
    COUNT(*) FILTER (WHERE dv.ocr_quality_grade = 'GOOD')::int AS ocr_quality_good,
    COUNT(*) FILTER (WHERE dv.ocr_quality_grade = 'ACCEPTABLE')::int AS ocr_quality_acceptable,
    COUNT(*) FILTER (WHERE dv.ocr_quality_grade = 'POOR')::int AS ocr_quality_poor,
    ROUND(AVG(dv.ocr_attempts) FILTER (WHERE dv.ocr_attempts > 0)::numeric, 2) AS ocr_avg_attempts
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id
  WHERE d.deleted_at IS NULL
),
audit_probe AS (
  SELECT true AS ok FROM audit_logs LIMIT 1
),
backup_probe AS (
  SELECT backup_type, status, finished_at
  FROM backup_runs
  WHERE status IN ('SUCCESS', 'PARTIAL', 'VERIFIED')
    AND backup_type IN ('DATABASE', 'FULL')
    AND finished_at IS NOT NULL
  ORDER BY finished_at DESC
  LIMIT 1
),
tables AS (
  SELECT COUNT(*)::int AS tables_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = ANY(ARRAY[
      'users','documents','document_chunks','categories','subcategories',
      'sectors','settings','user_sessions','audit_logs'
    ])
),
ai_eval_stats AS (
  SELECT
    (SELECT COUNT(*)::int FROM ai_test_cases WHERE status = 'active') AS cases_count,
    (SELECT overall_score FROM ai_test_runs WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1) AS last_score,
    (SELECT started_at FROM ai_test_runs ORDER BY started_at DESC LIMIT 1) AS last_run_at,
    (SELECT status FROM ai_test_runs ORDER BY started_at DESC LIMIT 1) AS last_run_status,
    (SELECT avg_duration_ms FROM ai_test_metrics m
      JOIN ai_test_runs r ON r.id = m.run_id
      ORDER BY r.started_at DESC LIMIT 1) AS avg_duration_ms
),
ai_prompt_stats AS (
  SELECT
    pub.version_number AS ai_prompt_version_number,
    pub.model_name AS ai_prompt_model_name,
    pub.published_at AS ai_prompt_published_at,
    pub.validation_score AS ai_prompt_validation_score,
    (SELECT COUNT(*)::int FROM ai_prompt_versions v WHERE v.prompt_definition_id = d.id AND v.status IN ('DRAFT','VALIDATING')) AS ai_prompt_draft_count,
    (SELECT COUNT(*)::int FROM ai_prompt_versions v WHERE v.prompt_definition_id = d.id AND v.status = 'PUBLISHED') AS ai_prompt_published_count
  FROM ai_prompt_definitions d
  LEFT JOIN LATERAL (
    SELECT version_number, model_name, published_at, validation_score
    FROM ai_prompt_versions v
    WHERE v.prompt_definition_id = d.id AND v.status = 'PUBLISHED' AND v.environment = 'PRODUCTION'
    ORDER BY v.published_at DESC NULLS LAST
    LIMIT 1
  ) pub ON true
  WHERE d.code = 'AI_QUERY_MAIN'
  LIMIT 1
),
tabular_stats AS (
  SELECT
    (
      SELECT COUNT(*)::int
      FROM document_versions dv5
      JOIN documents d5 ON d5.id = dv5.document_id
      WHERE d5.deleted_at IS NULL AND dv5.extraction_method = 'tabular'
    ) AS tabular_processed_count,
    (
      SELECT COUNT(*)::int
      FROM audit_logs
      WHERE action = 'TABLE_PROCESS_FAILED'
    ) AS tabular_fail_count,
    (
      SELECT ROUND(AVG((metadata->>'durationMs')::numeric))::int
      FROM audit_logs
      WHERE action = 'TABLE_CHUNKED' AND metadata->>'durationMs' IS NOT NULL
    ) AS tabular_avg_duration_ms,
    (
      SELECT COALESCE(SUM(dv6.sheet_count), 0)::int
      FROM document_versions dv6
      JOIN documents d6 ON d6.id = dv6.document_id
      WHERE d6.deleted_at IS NULL AND dv6.extraction_method = 'tabular'
    ) AS tabular_sheet_count,
    (
      SELECT COALESCE(SUM(dv7.table_row_count), 0)::int
      FROM document_versions dv7
      JOIN documents d7 ON d7.id = dv7.document_id
      WHERE d7.deleted_at IS NULL AND dv7.extraction_method = 'tabular'
    ) AS tabular_row_count,
    (
      SELECT COUNT(*)::int
      FROM document_chunks
      WHERE chunk_kind = 'tabular'
    ) AS tabular_chunk_count
)
SELECT
  1 AS ping_ok,
  ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - t0.started)) * 1000)::int AS duration_ms,
  tables.tables_count,
  cfg.settings_count,
  cfg.jwt_ok,
  cfg.ttl_ok,
  sess.active_count,
  doc_stats.total AS documents_total,
  doc_stats.processing AS documents_processing,
  doc_stats.errors AS documents_errors,
  doc_stats.missing_files AS documents_missing_files,
  doc_stats.processed_without_chunks AS documents_processed_without_chunks,
  ver_stats.versions_total,
  ver_stats.orphan_chunks,
  ver_stats.multi_current,
  file_cfg.max_upload_size_bytes,
  file_cfg.allowed_file_extensions,
  file_stats.invalid_recent_24h,
  file_stats.pending_validating,
  file_stats.valid_unprocessed,
  file_stats.stuck_validating,
  ocr_stats.ocr_processing,
  ocr_stats.ocr_failed,
  ocr_stats.ocr_pending,
  ocr_stats.ocr_manual_review,
  ocr_stats.ocr_stuck,
  ocr_stats.ocr_avg_duration_ms,
  ocr_stats.ocr_quality_avg_score,
  ocr_stats.ocr_quality_excellent,
  ocr_stats.ocr_quality_good,
  ocr_stats.ocr_quality_acceptable,
  ocr_stats.ocr_quality_poor,
  ocr_stats.ocr_avg_attempts,
  COALESCE(audit_probe.ok, true) AS audit_accessible,
  backup_probe.finished_at AS backup_last_finished_at,
  backup_probe.status AS backup_last_status,
  backup_probe.backup_type AS backup_last_type,
  tabular_stats.tabular_processed_count,
  tabular_stats.tabular_fail_count,
  tabular_stats.tabular_avg_duration_ms,
  tabular_stats.tabular_sheet_count,
  tabular_stats.tabular_row_count,
  tabular_stats.tabular_chunk_count,
  ai_eval_stats.cases_count AS ai_eval_cases_count,
  ai_eval_stats.last_score AS ai_eval_last_score,
  ai_eval_stats.last_run_at AS ai_eval_last_run_at,
  ai_eval_stats.last_run_status AS ai_eval_last_run_status,
  ai_eval_stats.avg_duration_ms AS ai_eval_avg_duration_ms,
  ai_prompt_stats.ai_prompt_version_number,
  ai_prompt_stats.ai_prompt_model_name,
  ai_prompt_stats.ai_prompt_published_at,
  ai_prompt_stats.ai_prompt_validation_score,
  ai_prompt_stats.ai_prompt_draft_count,
  ai_prompt_stats.ai_prompt_published_count
FROM t0
CROSS JOIN tables
CROSS JOIN cfg
CROSS JOIN sess
CROSS JOIN doc_stats
CROSS JOIN ver_stats
CROSS JOIN file_cfg
CROSS JOIN file_stats
CROSS JOIN ocr_stats
CROSS JOIN tabular_stats
CROSS JOIN ai_eval_stats
LEFT JOIN ai_prompt_stats ON true
LEFT JOIN audit_probe ON true
LEFT JOIN backup_probe ON true;