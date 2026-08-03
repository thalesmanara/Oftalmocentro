#!/usr/bin/env bash
# Restaura dump em banco TEMPORÁRIO. Nunca aponte RESTORE_DATABASE_URL para produção.
set -euo pipefail

DUMP_FILE="${1:?Uso: $0 <arquivo.dump>}"
: "${RESTORE_DATABASE_URL:?Defina RESTORE_DATABASE_URL apontando para banco TEMPORÁRIO}"

if [[ "${RESTORE_DATABASE_URL}" == *"oftalmocentro"* && "${ALLOW_PROD_LIKE_RESTORE:-}" != "yes" ]]; then
  echo "Recusando restore: URL parece de produção. Use banco temporário ou ALLOW_PROD_LIKE_RESTORE=yes com ciência." >&2
  exit 2
fi

pg_restore --clean --if-exists --no-owner --no-acl -d "${RESTORE_DATABASE_URL}" "${DUMP_FILE}"
echo "Restore isolado concluído. Valide tabelas essenciais e contagens antes de qualquer promoção."
