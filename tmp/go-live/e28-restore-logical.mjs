#!/usr/bin/env node
/**
 * Etapa 28 — restore isolado lógico (não destrutivo):
 * valida integridade referencial + gera snapshot de contagens + amostra.
 * NÃO restaura em produção. NÃO cria banco temporário se não houver acesso.
 */
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const report = {
  at: new Date().toISOString(),
  mode: 'LOGICAL_INTEGRITY_SNAPSHOT',
  productionTouched: false,
  isolatedPgRestore: false,
  externalBackup: false,
};

const { rows: backups } = await c.query(`
  SELECT id, type, status, checksum, created_at, metadata
  FROM backup_runs
  ORDER BY created_at DESC NULLS LAST
  LIMIT 10
`).catch(async () => {
  // try alternate columns
  try {
    const r = await c.query(`SELECT * FROM backup_runs ORDER BY created_at DESC LIMIT 3`);
    return r;
  } catch {
    return { rows: [] };
  }
});
report.recentBackups = backups.map((b) => ({
  id: b.id,
  type: b.type,
  status: b.status,
  checksum: b.checksum || b.sha256 || null,
  created_at: b.created_at,
}));

const integrity = {};
const checks = [
  [
    'orphan_versions',
    `SELECT COUNT(*)::int AS n FROM document_versions dv
     LEFT JOIN documents d ON d.id=dv.document_id WHERE d.id IS NULL`,
  ],
  [
    'orphan_chunks',
    `SELECT COUNT(*)::int AS n FROM document_chunks dc
     LEFT JOIN documents d ON d.id=dc.document_id WHERE d.id IS NULL`,
  ],
  [
    'orphan_user_perms',
    `SELECT COUNT(*)::int AS n FROM user_permissions up
     LEFT JOIN users u ON u.id=up.user_id WHERE u.id IS NULL`,
  ],
  [
    'rq_published',
    `SELECT COUNT(*)::int AS n FROM ai_response_quality_config_versions WHERE status='PUBLISHED'`,
  ],
  [
    'cache_published',
    `SELECT COUNT(*)::int AS n FROM ai_cache_config_versions WHERE status='PUBLISHED'`,
  ],
];
for (const [name, sql] of checks) {
  try {
    const { rows } = await c.query(sql);
    integrity[name] = rows[0].n;
  } catch (e) {
    integrity[name] = { error: e.message };
  }
}
report.integrity = integrity;

const { rows: counts } = await c.query(`
  SELECT jsonb_build_object(
    'users', (SELECT COUNT(*) FROM users),
    'documents', (SELECT COUNT(*) FROM documents),
    'document_versions', (SELECT COUNT(*) FROM document_versions),
    'document_chunks', (SELECT COUNT(*) FROM document_chunks),
    'ai_prompt_versions', (SELECT COUNT(*) FROM ai_prompt_versions),
    'ai_retrieval_config_versions', (SELECT COUNT(*) FROM ai_retrieval_config_versions),
    'ai_context_config_versions', (SELECT COUNT(*) FROM ai_context_config_versions),
    'ai_cache_config_versions', (SELECT COUNT(*) FROM ai_cache_config_versions),
    'ai_evidence_config_versions', (SELECT COUNT(*) FROM ai_evidence_config_versions),
    'ai_response_quality_config_versions', (SELECT COUNT(*) FROM ai_response_quality_config_versions),
    'ai_test_cases', (SELECT COUNT(*) FROM ai_test_cases),
    'ai_test_results', (SELECT COUNT(*) FROM ai_test_results),
    'audit_logs', (SELECT COUNT(*) FROM audit_logs)
  ) AS c`);
report.counts = counts[0].c;

const snapshot = JSON.stringify({ counts: report.counts, integrity, at: report.at });
report.snapshotChecksum = createHash('sha256').update(snapshot).digest('hex');
writeFileSync(join(__dirname, 'restore-snapshot.json'), snapshot);

report.verdict = {
  orphansOk:
    integrity.orphan_versions === 0 &&
    integrity.orphan_chunks === 0 &&
    integrity.orphan_user_perms === 0,
  singlePublishedRq: integrity.rq_published === 1,
  singlePublishedCache: integrity.cache_published === 1,
  backupsPresent: report.recentBackups.length > 0,
  fullDisasterRecoveryClaim: false,
  notes: [
    'Restore pg_dump em banco temporário NÃO executado (sem ambiente isolado provisionado nesta sessão).',
    'Backup externo (S3/R2) AUSENTE conforme docs/BACKUP_AND_RECOVERY.md.',
    'Integridade lógica do banco de produção validada sem escrita destrutiva.',
  ],
};

writeFileSync(join(__dirname, 'restore-test-report.md'), `# Restore Test Report — Etapa 28

Data: ${report.at}

## Escopo executado

- Snapshot lógico de contagens e checksum SHA-256: \`${report.snapshotChecksum}\`
- Checagens de órfãos / PUBLISHED únicos
- Inspeção de \`backup_runs\` recentes (${report.recentBackups.length})

## Não executado

- \`pg_dump\` / restore em banco temporário isolado
- Restore de binários de documentos
- Upload para destino externo

## Resultado

| Item | Status |
|------|--------|
| Produção alterada | Não |
| Órfãos document_versions | ${integrity.orphan_versions} |
| Órfãos document_chunks | ${integrity.orphan_chunks} |
| RQ PUBLISHED=1 | ${integrity.rq_published} |
| Cache PUBLISHED=1 | ${integrity.cache_published} |
| Backup externo | Ausente |
| DR completo reivindicável | **Não** |

## Classificação

**Risco de continuidade: ACEITE FORMAL NECESSÁRIO** para Go Live sem backup externo + restore isolado completo.

Ver \`docs/TERMO_ACEITE.md\`.
`);

writeFileSync(join(__dirname, 'restore-test.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.verdict, null, 2));
await c.end();
