#!/usr/bin/env bash
# Requer: acesso ao volume de documentos do n8n (ex.: /home/node/files/documents).
set -euo pipefail

STAMP="$(date -u +%Y%m%d_%H%M%S)"
DOCS_DIR="${DOCS_DIR:-/home/node/files/documents}"
OUT_DIR="${BACKUP_OUT_DIR:-./backups}"
FILE="${OUT_DIR}/oftalmocentro_documents_${STAMP}.tar.gz"
mkdir -p "${OUT_DIR}"

if [[ ! -d "${DOCS_DIR}" ]]; then
  echo "Diretório de documentos inexistente: ${DOCS_DIR}" >&2
  exit 1
fi

tar -czf "${FILE}" \
  --exclude='.health-probe.tmp' \
  --exclude='oftalmocentro_*' \
  -C "$(dirname "${DOCS_DIR}")" \
  "$(basename "${DOCS_DIR}")"

sha256sum "${FILE}" | tee "${FILE}.sha256"
echo "OK ${FILE}"
echo "AVISO: copie este arquivo para armazenamento EXTERNO à VPS."
