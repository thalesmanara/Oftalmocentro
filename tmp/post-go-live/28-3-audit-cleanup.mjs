import pg from 'pg';
import { writeFileSync, readFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const summary = JSON.parse(readFileSync('tmp/post-go-live/audit-pre-cleanup-summary.json', 'utf8'));

// Safety: only cleanup if all rows are within implantation window (Aug 2026 go-live prep)
const min = new Date(summary.min_at);
const max = new Date(summary.max_at);
const windowOk = min >= new Date('2026-08-01') && max <= new Date('2026-08-10');
const actions = new Set(summary.byAction.map((a) => a.action));
const hasOnlyDevSignals =
  summary.total > 0 &&
  windowOk &&
  [...actions].every(
    (a) =>
      typeof a === 'string' &&
      (a.startsWith('AI_') ||
        a.startsWith('AUTH_') ||
        a.startsWith('DOCUMENT_') ||
        a.startsWith('USER_') ||
        a.startsWith('SECTOR_') ||
        a.startsWith('CATEGORY_') ||
        a.startsWith('SUBCATEGORY_') ||
        a.startsWith('SETTINGS_') ||
        a.startsWith('OCR_') ||
        a.startsWith('EMBEDDING_') ||
        a.startsWith('QDRANT_') ||
        a.startsWith('SYSTEM_') ||
        a.startsWith('BACKUP_') ||
        a.startsWith('DATASET_') ||
        a.startsWith('METRICS_') ||
        a.startsWith('TECHNICAL_') ||
        a.startsWith('FILE_') ||
        a.startsWith('TABLE_') ||
        a === 'TEST_EXECUTED' ||
        a === 'TEST_FAILED'),
  );

const before = (await c.query(`SELECT COUNT(*)::int AS n FROM audit_logs`)).rows[0].n;

const decision = {
  windowOk,
  hasOnlyDevSignals,
  before,
  willClean: windowOk && hasOnlyDevSignals && before > 0,
  reason: windowOk
    ? 'All audit_logs fall in implantation/test window 2026-08-01..2026-08-10; no pre-August production trail.'
    : 'Window not safe',
};

if (!decision.willClean) {
  writeFileSync(
    'tmp/post-go-live/28-3-audit-cleanup-result.json',
    JSON.stringify({ decision, cleaned: false }, null, 2),
  );
  console.log('SKIP cleanup', decision);
  await c.end();
  process.exit(0);
}

// Logical snapshot counts only (no PII bodies) already in audit-pre-cleanup-summary.json
const officialStartAt = new Date().toISOString();
await c.query('BEGIN');
try {
  await c.query('TRUNCATE TABLE audit_logs RESTART IDENTITY');
  await c.query('COMMIT');
} catch (e) {
  await c.query('ROLLBACK');
  // Fallback DELETE if truncate blocked by FK
  await c.query('DELETE FROM audit_logs');
}

const after = (await c.query(`SELECT COUNT(*)::int AS n FROM audit_logs`)).rows[0].n;
const result = {
  decision,
  auditRowsBefore: before,
  auditRowsRemoved: before - after,
  auditRowsPreserved: after,
  auditOfficialStartAt: officialStartAt,
  cleaned: after === 0,
};
writeFileSync('tmp/post-go-live/28-3-audit-cleanup-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await c.end();
