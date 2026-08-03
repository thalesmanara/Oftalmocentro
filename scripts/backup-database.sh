#!/usr/bin/env bash
# Requer: SSH/host com pg_dump e acesso ao PostgreSQL da aplicação.
# NÃO executar restore em produção a partir deste script.
set -euo pipefail

STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${BACKUP_OUT_DIR:-./backups}"
FILE="${OUT_DIR}/oftalmocentro_database_${STAMP}.dump"
mkdir -p "${OUT_DIR}"

: "${DATABASE_URL:?Defina DATABASE_URL (connection string PostgreSQL)}"

pg_dump --format=custom --no-owner --no-acl --file="${FILE}" "${DATABASE_URL}"
sha256sum "${FILE}" | tee "${FILE}.sha256"
echo "OK ${FILE}"
echo "AVISO: copie este arquivo para armazenamento EXTERNO à VPS."
