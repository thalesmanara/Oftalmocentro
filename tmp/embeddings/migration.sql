-- Etapa 18: Camada corporativa de embeddings (idempotente)
-- Sem Qdrant nesta etapa. Sem pgvector (extensão indisponível) → embedding_vector jsonb.
BEGIN;

-- Chunks: metadados + vetor temporário (JSONB) + hash de conteúdo
ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS content_hash text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimensions integer,
  ADD COLUMN IF NOT EXISTS embedding_status text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS embedding_created_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_hash text,
  ADD COLUMN IF NOT EXISTS embedding_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS embedding_generation_ms integer,
  ADD COLUMN IF NOT EXISTS embedding_token_count integer,
  ADD COLUMN IF NOT EXISTS embedding_vector jsonb,
  ADD COLUMN IF NOT EXISTS embedding_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_last_error text,
  ADD COLUMN IF NOT EXISTS embedding_next_retry_at timestamptz;

-- Normalizar status existentes
UPDATE document_chunks
SET embedding_status = 'PENDING'
WHERE embedding_status IS NULL OR btrim(embedding_status) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_chunks_embedding_status_chk'
  ) THEN
    ALTER TABLE document_chunks
      ADD CONSTRAINT document_chunks_embedding_status_chk
      CHECK (embedding_status IN (
        'PENDING', 'PROCESSING', 'VALID', 'INVALID', 'FAILED', 'SKIPPED'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_status
  ON document_chunks(embedding_status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content_hash
  ON document_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_retry
  ON document_chunks(embedding_next_retry_at)
  WHERE embedding_status IN ('PENDING', 'FAILED', 'INVALID');
CREATE INDEX IF NOT EXISTS idx_document_chunks_version_embedding
  ON document_chunks(document_version_id, embedding_status);

-- Versões: resumo agregado
ALTER TABLE document_versions
  ADD COLUMN IF NOT EXISTS embedding_status text,
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_dimensions integer,
  ADD COLUMN IF NOT EXISTS embedding_pending_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_valid_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_failed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_avg_ms numeric(12,2);

-- Dataset: rastrear modelo/versão de embedding nas runs
ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedding_version text;

-- Secrets operacionais
INSERT INTO app_secrets (key, value)
SELECT 'embedding_model', 'text-embedding-3-small'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_model');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_dimensions', '1536'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_dimensions');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_concurrency', '3'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_concurrency');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_batch_size', '16'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_batch_size');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_max_retries', '3'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_max_retries');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_timeout_ms', '60000'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_timeout_ms');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_engine_version', '1.0.0'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_engine_version');

INSERT INTO app_secrets (key, value)
SELECT 'embedding_storage', 'postgres_jsonb_temp'
WHERE NOT EXISTS (SELECT 1 FROM app_secrets WHERE key = 'embedding_storage');

-- Backfill content_hash para chunks existentes (sem regenerar embedding ainda)
UPDATE document_chunks
SET content_hash = encode(digest(COALESCE(chunk_text, ''), 'sha256'), 'hex'),
    embedding_updated_at = COALESCE(embedding_updated_at, now())
WHERE content_hash IS NULL;

COMMIT;
