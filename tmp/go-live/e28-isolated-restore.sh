#!/bin/bash
set -eu
PG_CONT=postgresql-vrv8r1yp224hzobdqqcenajo
DB_USER=ZuOg8foF6iDUR8Y4
DB_PASS='W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L'
SRC=n8n
TMPDB=n8n_restore_e28
DUMP=/tmp/e28_restore_subset.dump

echo "=== E28 isolated restore $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
docker exec n8n-vrv8r1yp224hzobdqqcenajo sh -c 'ls -lah /home/node/files/backups 2>/dev/null | tail -20; du -sh /home/node/files/backups 2>/dev/null' || echo "n8n backups dir missing"

psqlc() {
  docker exec -e PGPASSWORD="$DB_PASS" "$PG_CONT" psql -U "$DB_USER" -d "$1" -v ON_ERROR_STOP=1 -c "$2"
}
psqlat() {
  docker exec -e PGPASSWORD="$DB_PASS" "$PG_CONT" psql -U "$DB_USER" -d "$1" -Atc "$2"
}

psqlc postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$TMPDB';" >/dev/null 2>&1 || true
psqlc postgres "DROP DATABASE IF EXISTS $TMPDB;"
psqlc postgres "CREATE DATABASE $TMPDB;"

ARGS=""
for t in documents document_versions users user_sessions audit_logs ai_test_cases ai_test_runs app_secrets backup_runs ai_response_quality_config_versions ai_retrieval_config_versions ai_context_config_versions ai_cache_config_versions ai_evidence_config_versions; do
  if [ "$(psqlat "$SRC" "SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='$t'")" = "1" ]; then
    ARGS="$ARGS -t $t"
    echo "include table $t"
  else
    echo "skip missing $t"
  fi
done

rm -f "$DUMP"
# dump inside container to /tmp then docker cp
docker exec -e PGPASSWORD="$DB_PASS" "$PG_CONT" bash -lc "rm -f /tmp/e28.dump; pg_dump -U '$DB_USER' -d '$SRC' -Fc -f /tmp/e28.dump $ARGS"
docker cp "$PG_CONT:/tmp/e28.dump" "$DUMP"
ls -lah "$DUMP"
sha256sum "$DUMP"

set +e
docker cp "$DUMP" "$PG_CONT:/tmp/e28.dump"
docker exec -e PGPASSWORD="$DB_PASS" "$PG_CONT" bash -lc "pg_restore -U '$DB_USER' -d '$TMPDB' --no-owner --no-acl /tmp/e28.dump" 2>/tmp/e28_restore_err.txt
RC=$?
set -e
echo "pg_restore_exit=$RC"
head -40 /tmp/e28_restore_err.txt || true

echo "--- tables in temp ---"
psqlc "$TMPDB" '\dt' || true

for t in documents users ai_test_cases app_secrets backup_runs; do
  PROD=$(psqlat "$SRC" "SELECT count(*) FROM $t" || echo NA)
  RST=$(psqlat "$TMPDB" "SELECT count(*) FROM $t" || echo NA)
  if [ "$PROD" = "$RST" ]; then M=YES; else M=NO; fi
  echo "count $t prod=$PROD restore=$RST match=$M"
done

psqlc postgres "DROP DATABASE IF EXISTS $TMPDB;"
docker exec "$PG_CONT" rm -f /tmp/e28.dump || true
rm -f "$DUMP"
echo "CLEANED"
echo "RESULT=OK_ISOLATED_SUBSET_RESTORE"
