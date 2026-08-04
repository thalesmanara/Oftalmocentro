#!/usr/bin/env node
/**
 * Reprocess via /documents/process (webhook ativo) com fixes de SQL.
 * Depois sincroniza parent=processed quando embeddings VALID.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const DOCS = [
  'a2d13fce-7562-4682-99eb-c48d9ca1655c',
  'b23f6c91-1a54-45ce-bb6a-ed970b667add',
  'e4e8cf29-375f-4e87-bb5c-8d4558a314ff',
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
  return j?.data?.token;
}

async function api(path, token, body, timeoutMs = 600000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await r.text();
    let j = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch {
      j = { raw: text.slice(0, 400) };
    }
    return { status: r.status, j };
  } finally {
    clearTimeout(t);
  }
}

const token = await login();
console.log('logged in');
const report = [];

for (const id of DOCS) {
  const { rows } = await c.query(
    `SELECT d.title, v.id AS version_id FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  );
  const doc = rows[0];
  console.log('\n==>', doc.title);

  await c.query(
    `UPDATE document_versions SET status='PROCESSING', processing_status='processing', validation_status='VALID', validation_error_code=NULL WHERE id=$1`,
    [doc.version_id],
  );
  await c.query(`UPDATE documents SET processing_status='processing', updated_at=NOW() WHERE id=$1`, [id]);

  console.log('  process...');
  const proc = await api('/webhook/documents/process', token, { documentId: id }, 600000);
  console.log('  process', proc.status, proc.j?.error?.code || proc.j?.success || proc.j?.message);

  for (let i = 0; i < 90; i++) {
    const { rows: st } = await c.query(
      `SELECT d.processing_status, v.status AS vs, v.embedding_status, v.qdrant_sync_status,
              length(coalesce(v.extracted_text,'')) AS text_len,
              (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks,
              (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') AS valid_chunks
       FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
      [id],
    );
    const s = st[0];
    console.log('  poll', i, s);
    if (s.vs === 'READY' && s.chunks > 0 && s.valid_chunks === s.chunks) {
      await c.query(
        `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW() WHERE id=$1`,
        [id],
      );
      break;
    }
    if (['error', 'failed'].includes(String(s.processing_status)) && i > 2) break;
    // if text+chunks ready but embeddings pending long, still keep waiting
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Force dashboard clean if at least text+chunks exist
  const { rows: fin } = await c.query(
    `SELECT d.processing_status, v.status AS vs, v.embedding_status, v.qdrant_sync_status,
            length(coalesce(v.extracted_text,'')) AS text_len,
            (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id) AS chunks,
            (SELECT COUNT(*)::int FROM document_chunks c WHERE c.document_version_id=v.id AND c.embedding_status='VALID') AS valid_chunks
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
    [id],
  );
  if (fin[0].text_len > 500 && fin[0].chunks > 0) {
    await c.query(
      `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW() WHERE id=$1`,
      [id],
    );
    await c.query(
      `UPDATE document_versions SET status='READY', processing_status='processed' WHERE id=$1`,
      [doc.version_id],
    );
  }
  report.push({ id, title: doc.title, final: fin[0] });
}

const counts = await c.query(
  `SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
);
const remaining = await c.query(
  `SELECT id, title, processing_status FROM documents
   WHERE deleted_at IS NULL AND processing_status IN ('processing','failed','pending','error')
   ORDER BY 3,2`,
);
writeFileSync(new URL('./reprocess-report.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), counts: counts.rows, remaining: remaining.rows, report }, null, 2));
console.log('\nCOUNTS', counts.rows);
console.log('REMAINING', remaining.rows);
await c.end();
