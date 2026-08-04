#!/usr/bin/env node
/**
 * Reprocessa 8ª/9ª/10ª alterações após correção do Avaliar Tika.
 * - Soft-delete docs sem arquivo
 * - Prepara version status=PROCESSING + validation VALID
 * - POST /webhook/documents/process
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const IDS = [
  'a2d13fce-7562-4682-99eb-c48d9ca1655c', // 8ª
  'b23f6c91-1a54-45ce-bb6a-ed970b667add', // 9ª
  'e4e8cf29-375f-4e87-bb5c-8d4558a314ff', // 10ª
];

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function login() {
  const r = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  });
  const j = await r.json();
  const token = j?.data?.token || j?.token;
  if (!token) throw new Error('login failed ' + JSON.stringify(j).slice(0, 200));
  return token;
}

async function api(method, path, token, body, timeoutMs = 600000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await r.text();
    let j = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      j = { raw: text.slice(0, 500) };
    }
    return { status: r.status, j };
  } finally {
    clearTimeout(t);
  }
}

// Soft-delete orphan pending without file
await c.query(`
  UPDATE documents d
  SET deleted_at = NOW(), updated_at = NOW()
  FROM document_versions v
  WHERE d.current_version_id = v.id
    AND d.deleted_at IS NULL
    AND d.processing_status IN ('pending','processing','failed','error')
    AND COALESCE(NULLIF(v.file_path,''), NULLIF(v.file_name,''), NULLIF(v.stored_file_name,'')) IS NULL
`);

const token = await login();
console.log('logged in');

const report = [];
for (const id of IDS) {
  const { rows } = await c.query(
    `SELECT d.id, d.title, d.processing_status, v.id AS version_id, v.status AS v_status,
            v.validation_status, v.ocr_status, v.file_path
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id
     WHERE d.id=$1`,
    [id],
  );
  const doc = rows[0];
  if (!doc) {
    console.log('missing', id);
    continue;
  }
  const item = { id, title: doc.title, before: doc.processing_status, steps: [] };
  console.log('\n==>', doc.title, doc.processing_status, doc.v_status, doc.validation_status);

  await c.query(
    `UPDATE document_versions
     SET status='PROCESSING',
         processing_status='processing',
         validation_status='VALID',
         validation_error_code=NULL,
         embedding_status=NULL,
         qdrant_sync_status=NULL
     WHERE id=$1`,
    [doc.version_id],
  );
  await c.query(
    `UPDATE documents SET processing_status='processing', updated_at=NOW() WHERE id=$1`,
    [id],
  );
  item.steps.push('prepared PROCESSING+VALID');

  console.log('  process...');
  const proc = await api('POST', '/webhook/documents/process', token, { documentId: id }, 600000);
  item.process = {
    status: proc.status,
    message: proc.j?.message || proc.j?.data?.message || proc.j?.error?.message || proc.j?.response?.error?.message,
    code: proc.j?.error?.code || proc.j?.code || proc.j?.response?.error?.code,
    success: proc.j?.success ?? proc.j?.response?.success,
  };
  console.log('  process', item.process);
  item.steps.push(`process status=${proc.status}`);

  for (let i = 0; i < 60; i++) {
    const { rows: stRows } = await c.query(
      `SELECT d.processing_status, v.status AS v_status, v.embedding_status, v.qdrant_sync_status, v.ocr_status,
              length(coalesce(v.extracted_text,'')) AS text_len
       FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
      [id],
    );
    const st = stRows[0];
    item.after = st;
    console.log('  poll', i, st?.processing_status, st?.v_status, st?.embedding_status, st?.qdrant_sync_status, 'text='+st?.text_len);
    if (['processed', 'failed', 'error'].includes(String(st?.processing_status || ''))) break;
    if (st?.embedding_status === 'VALID' && st?.qdrant_sync_status === 'SYNCED') {
      await c.query(
        `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW()
         WHERE id=$1 AND processing_status<>'processed'`,
        [id],
      );
      await c.query(
        `UPDATE document_versions SET status='READY', processing_status='processed' WHERE id=$1 AND status<>'READY'`,
        [doc.version_id],
      );
      break;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  const { rows: finalRows } = await c.query(
    `SELECT d.processing_status, v.status AS v_status, v.embedding_status, v.qdrant_sync_status, v.ocr_status,
            length(coalesce(v.extracted_text,'')) AS text_len
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  );
  item.final = finalRows[0];
  report.push(item);
}

const counts = await c.query(
  `SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
);
const remaining = await c.query(
  `SELECT id, title, processing_status FROM documents
   WHERE deleted_at IS NULL AND processing_status IN ('processing','failed','pending','error')
   ORDER BY 3,2`,
);

const out = { at: new Date().toISOString(), counts: counts.rows, remaining: remaining.rows, report };
writeFileSync(new URL('./reprocess-report.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\nCOUNTS', counts.rows);
console.log('REMAINING', remaining.rows);
await c.end();
