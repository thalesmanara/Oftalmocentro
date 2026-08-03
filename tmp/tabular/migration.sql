-- Etapa 16: suporte tabular (XLS/XLSX/CSV/TSV) — idempotente
BEGIN;

-- Limites / política
INSERT INTO app_secrets (key, value) VALUES
  ('tabular_enabled', 'true'),
  ('tabular_max_sheets', '50'),
  ('tabular_max_rows', '50000'),
  ('tabular_max_columns', '100'),
  ('tabular_rows_per_chunk', '25'),
  ('tabular_preview_rows', '30'),
  ('tabular_timeout_seconds', '120')
ON CONFLICT (key) DO NOTHING;

UPDATE app_secrets
SET value = CASE
  WHEN value NOT LIKE '%tsv%' THEN value || ',tsv'
  ELSE value
END
WHERE key = 'allowed_file_extensions';

UPDATE app_secrets
SET value = CASE
  WHEN value NOT LIKE '%text/tab-separated-values%' THEN value || ',text/tab-separated-values,text/csv'
  ELSE value
END
WHERE key = 'allowed_mime_types';

-- Metadados na versão (sem duplicar células)
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS sheet_count integer;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS table_row_count integer;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS table_column_count integer;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS table_summary jsonb;
ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS table_preview jsonb;

DO $$ BEGIN
  ALTER TABLE document_versions
    ADD CONSTRAINT document_versions_sheet_count_nonneg CHECK (sheet_count IS NULL OR sheet_count >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Abas
CREATE TABLE IF NOT EXISTS document_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sheet_index integer NOT NULL,
  sheet_name text NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  column_count integer NOT NULL DEFAULT 0,
  headers jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_merged_cells boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, sheet_index)
);

CREATE INDEX IF NOT EXISTS idx_document_sheets_version ON document_sheets(document_version_id);
CREATE INDEX IF NOT EXISTS idx_document_sheets_document ON document_sheets(document_id);

-- Linhas estruturadas (células em jsonb — sem tabela de células duplicada)
CREATE TABLE IF NOT EXISTS document_table_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sheet_id uuid REFERENCES document_sheets(id) ON DELETE CASCADE,
  sheet_name text NOT NULL,
  row_number integer NOT NULL,
  is_header boolean NOT NULL DEFAULT false,
  cells jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_text text NOT NULL DEFAULT '',
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  UNIQUE (document_version_id, sheet_name, row_number)
);

CREATE INDEX IF NOT EXISTS idx_document_table_rows_version ON document_table_rows(document_version_id);
CREATE INDEX IF NOT EXISTS idx_document_table_rows_sheet ON document_table_rows(document_version_id, sheet_name);
CREATE INDEX IF NOT EXISTS idx_document_table_rows_text ON document_table_rows USING gin (to_tsvector('simple', coalesce(row_text, '')));

-- Chunks tabulares (compatível com texto legado)
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS chunk_kind varchar(32) NOT NULL DEFAULT 'text';
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS sheet_name text;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS row_start integer;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS row_end integer;
ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS headers_json jsonb;

CREATE INDEX IF NOT EXISTS idx_document_chunks_kind ON document_chunks(chunk_kind);
CREATE INDEX IF NOT EXISTS idx_document_chunks_sheet ON document_chunks(document_version_id, sheet_name);

COMMIT;
