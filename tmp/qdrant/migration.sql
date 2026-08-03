-- Etapa 19 Qdrant migration (idempotent, no hash comments)

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_synced_at timestamptz;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_sync_status text;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_sync_error text;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_sync_attempts integer NOT NULL DEFAULT 0;

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding_sync_ms integer;

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS qdrant_sync_status text;

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS qdrant_synced_count integer NOT NULL DEFAULT 0;

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS qdrant_pending_count integer NOT NULL DEFAULT 0;

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS qdrant_failed_count integer NOT NULL DEFAULT 0;

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS qdrant_collection text;

ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS qdrant_synced_at timestamptz;

ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS retrieval_mode text;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS retrieval_mode text;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS top_k integer;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS vector_score double precision;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS text_score double precision;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS merged_score double precision;

UPDATE document_chunks
SET embedding_sync_status = 'PENDING'
WHERE embedding_status = 'VALID'
  AND (embedding_sync_status IS NULL OR embedding_sync_status = '')
  AND qdrant_point_id IS NULL;

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_url', 'http://qdrant:6333'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_url');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_collection', 'oftalmocentro_chunks'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_collection');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_distance', 'Cosine'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_distance');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_top_k', '12'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_top_k');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_text_top_k', '12'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_text_top_k');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_hybrid_top_k', '12'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_hybrid_top_k');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_batch_size', '32'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_batch_size');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_concurrency', '2'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_concurrency');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_timeout_ms', '30000'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_timeout_ms');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_max_retries', '3'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_max_retries');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_weight_vector', '0.65'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_weight_vector');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_weight_text', '0.35'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_weight_text');

INSERT INTO app_secrets (key, value)
SELECT 'qdrant_engine_version', '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'qdrant_engine_version');

CREATE INDEX IF NOT EXISTS idx_document_chunks_sync_status
  ON document_chunks (embedding_sync_status)
  WHERE embedding_status = 'VALID';

CREATE INDEX IF NOT EXISTS idx_document_chunks_qdrant_point
  ON document_chunks (qdrant_point_id)
  WHERE qdrant_point_id IS NOT NULL;
