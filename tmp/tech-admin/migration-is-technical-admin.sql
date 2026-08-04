-- Idempotent: Administrador Técnico
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_technical_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN users.is_technical_admin IS
  'Administrador técnico: acesso a governança/monitoramento IA sem poderes de master';
