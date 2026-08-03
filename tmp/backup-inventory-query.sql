SELECT d.id, d.title, d.file_name, d.file_type, d.file_size, d.processing_status,
       regexp_replace(COALESCE(dv.file_path, d.file_path), '^.*/', '') AS storage_key,
       dv.ocr_status,
       dv.extraction_method,
       dv.ocr_engine,
       dv.ocr_languages,
       dv.ocr_attempts,
       dv.ocr_duration_ms,
       (dv.ocr_derived_file_path IS NOT NULL) AS has_ocr_derived_file,
       COALESCE(
         dv.ocr_derived_file_name,
         NULLIF(regexp_replace(dv.ocr_derived_file_path, '^.*/', ''), '')
       ) AS ocr_derived_file_name,
       dv.ocr_derived_checksum,
       dv.sheet_count,
       dv.table_row_count,
       dv.table_column_count,
       (SELECT COUNT(*)::int FROM document_sheets ds WHERE ds.document_version_id = dv.id) AS actual_sheet_count,
       (SELECT COUNT(*)::int FROM document_table_rows dtr WHERE dtr.document_version_id = dv.id) AS actual_table_row_count
FROM documents d
LEFT JOIN document_versions dv ON dv.id = d.current_version_id
WHERE d.deleted_at IS NULL;
