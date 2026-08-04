-- Etapa 22.1 — dependências enriquecidas, contadores shadow, métricas

ALTER TABLE ai_semantic_cache_dependencies
  ADD COLUMN IF NOT EXISTS chunk_id uuid,
  ADD COLUMN IF NOT EXISTS document_version_number integer,
  ADD COLUMN IF NOT EXISTS document_content_hash varchar,
  ADD COLUMN IF NOT EXISTS chunk_content_hash varchar,
  ADD COLUMN IF NOT EXISTS expiration_date date,
  ADD COLUMN IF NOT EXISTS updated_at_snapshot timestamptz;

-- rename semantic: keep content_hash as document_content_hash alias if needed
UPDATE ai_semantic_cache_dependencies
SET document_content_hash = COALESCE(document_content_hash, content_hash)
WHERE document_content_hash IS NULL AND content_hash IS NOT NULL;

ALTER TABLE ai_semantic_cache_entries
  ADD COLUMN IF NOT EXISTS shadow_candidate_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS served_hit_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_fingerprint_version varchar DEFAULT 'source-fingerprint-v1',
  ADD COLUMN IF NOT EXISTS ttl_policy varchar,
  ADD COLUMN IF NOT EXISTS effective_ttl_seconds integer,
  ADD COLUMN IF NOT EXISTS nearest_source_expiration date,
  ADD COLUMN IF NOT EXISTS not_cacheable_reason varchar;

ALTER TABLE ai_cache_metrics_daily
  ADD COLUMN IF NOT EXISTS shadow_candidate_count bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shadow_agreements bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS false_hits bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS critical_false_hits bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stale_candidates bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalidation_prevented_hits bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expiration_prevented_hits bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scope_mismatch_prevented bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sensitive_blocked bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conflict_blocked bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insufficient_blocked bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fallback_blocked bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_cacheable bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cacheable bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invalidations bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS evictions bigint NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_cache_deps_docver2
  ON ai_semantic_cache_dependencies (document_version_id);

CREATE INDEX IF NOT EXISTS idx_ai_cache_deps_type
  ON ai_semantic_cache_dependencies (dependency_type);

-- Eager invalidation helper
CREATE OR REPLACE FUNCTION ai_cache_invalidate_by_document(p_document_id uuid, p_reason text DEFAULT 'DOCUMENT_UPDATED')
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
BEGIN
  WITH matched AS (
    SELECT DISTINCT e.id
    FROM ai_semantic_cache_entries e
    LEFT JOIN ai_semantic_cache_dependencies d ON d.cache_entry_id = e.id
    WHERE e.status = 'VALID'
      AND (
        d.document_id = p_document_id
        OR e.source_document_ids @> to_jsonb(ARRAY[p_document_id::text])
        OR e.source_document_ids @> jsonb_build_array(p_document_id::text)
      )
  ), upd AS (
    UPDATE ai_semantic_cache_entries e
    SET status = 'INVALIDATED',
        invalidated_at = NOW(),
        invalidation_reason = left(COALESCE(p_reason, 'DOCUMENT_UPDATED'), 80)
    FROM matched m
    WHERE e.id = m.id
    RETURNING e.id
  )
  SELECT COUNT(*)::int INTO n FROM upd;
  RETURN COALESCE(n, 0);
END;
$$;

CREATE OR REPLACE FUNCTION ai_cache_invalidate_by_document_version(p_version_id uuid, p_reason text DEFAULT 'DOCUMENT_VERSION_CHANGED')
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  n integer;
  doc_id uuid;
BEGIN
  SELECT document_id INTO doc_id FROM document_versions WHERE id = p_version_id;
  WITH matched AS (
    SELECT DISTINCT e.id
    FROM ai_semantic_cache_entries e
    LEFT JOIN ai_semantic_cache_dependencies d ON d.cache_entry_id = e.id
    WHERE e.status = 'VALID'
      AND (
        d.document_version_id = p_version_id
        OR e.document_version_ids @> to_jsonb(ARRAY[p_version_id::text])
        OR e.document_version_ids @> jsonb_build_array(p_version_id::text)
        OR (doc_id IS NOT NULL AND d.document_id = doc_id)
      )
  ), upd AS (
    UPDATE ai_semantic_cache_entries e
    SET status = 'INVALIDATED',
        invalidated_at = NOW(),
        invalidation_reason = left(COALESCE(p_reason, 'DOCUMENT_VERSION_CHANGED'), 80)
    FROM matched m
    WHERE e.id = m.id
    RETURNING e.id
  )
  SELECT COUNT(*)::int INTO n FROM upd;
  RETURN COALESCE(n, 0);
END;
$$;

-- Triggers on document_versions
CREATE OR REPLACE FUNCTION trg_ai_cache_on_document_version()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM ai_cache_invalidate_by_document(NEW.document_id, 'DOCUMENT_VERSION_CREATED');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.is_current IS DISTINCT FROM OLD.is_current
       OR NEW.checksum IS DISTINCT FROM OLD.checksum
       OR NEW.processing_status IS DISTINCT FROM OLD.processing_status
       OR NEW.ocr_status IS DISTINCT FROM OLD.ocr_status
       OR NEW.ocr_quality_grade IS DISTINCT FROM OLD.ocr_quality_grade
       OR NEW.ocr_derived_checksum IS DISTINCT FROM OLD.ocr_derived_checksum
       OR NEW.embedding_status IS DISTINCT FROM OLD.embedding_status
       OR NEW.qdrant_sync_status IS DISTINCT FROM OLD.qdrant_sync_status
       OR NEW.table_row_count IS DISTINCT FROM OLD.table_row_count
       OR NEW.expiration_date IS DISTINCT FROM OLD.expiration_date
       OR NEW.status IS DISTINCT FROM OLD.status
    THEN
      PERFORM ai_cache_invalidate_by_document_version(NEW.id, 'DOCUMENT_VERSION_UPDATED');
      PERFORM ai_cache_invalidate_by_document(NEW.document_id, 'DOCUMENT_UPDATED');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_cache_document_versions ON document_versions;
CREATE TRIGGER trg_ai_cache_document_versions
AFTER INSERT OR UPDATE ON document_versions
FOR EACH ROW EXECUTE PROCEDURE trg_ai_cache_on_document_version();

CREATE OR REPLACE FUNCTION trg_ai_cache_on_documents()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
       OR NEW.current_version_id IS DISTINCT FROM OLD.current_version_id
       OR NEW.processing_status IS DISTINCT FROM OLD.processing_status
       OR NEW.expiration_date IS DISTINCT FROM OLD.expiration_date
       OR NEW.title IS DISTINCT FROM OLD.title
    THEN
      PERFORM ai_cache_invalidate_by_document(NEW.id,
        CASE WHEN NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN 'DOCUMENT_DELETED_LOGICALLY'
             WHEN NEW.current_version_id IS DISTINCT FROM OLD.current_version_id THEN 'DOCUMENT_VERSION_PROMOTED'
             ELSE 'DOCUMENT_UPDATED' END);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_cache_documents ON documents;
CREATE TRIGGER trg_ai_cache_documents
AFTER UPDATE ON documents
FOR EACH ROW EXECUTE PROCEDURE trg_ai_cache_on_documents();

CREATE OR REPLACE FUNCTION trg_ai_cache_on_chunks()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    PERFORM ai_cache_invalidate_by_document(
      COALESCE(NEW.document_id, OLD.document_id),
      CASE WHEN TG_OP = 'DELETE' THEN 'DOCUMENT_CHUNKS_REBUILT' ELSE 'DOCUMENT_CHUNKS_REBUILT' END
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_cache_chunks ON document_chunks;
CREATE TRIGGER trg_ai_cache_chunks
AFTER INSERT OR UPDATE OF content_hash, embedding_hash, embedding_status, chunk_text OR DELETE ON document_chunks
FOR EACH ROW EXECUTE PROCEDURE trg_ai_cache_on_chunks();
