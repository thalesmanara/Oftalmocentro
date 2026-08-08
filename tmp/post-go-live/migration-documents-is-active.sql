-- Etapa 28.1 — documentos ativos/inativos (idempotente)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN documents.is_active IS
  'Documentos inativos permanecem armazenados, mas não entram na recuperação da IA.';

-- Índice para filtros de listagem / retrieval
CREATE INDEX IF NOT EXISTS idx_documents_is_active_not_deleted
  ON documents (is_active)
  WHERE deleted_at IS NULL;
