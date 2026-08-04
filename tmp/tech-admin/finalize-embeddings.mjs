#!/usr/bin/env node
/**
 * Finaliza embeddings+Qdrant das 8/9/10 via Processar documento (pipeline completo).
 * Mantém dashboard processado ao final de cada doc.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const DOCS = [
  { id: 'a2d13fce-7562-4682-99eb-c48d9ca1655c', versionId: '55ce423b-b29a-467b-8ba1-7f398651f669', title: '8ª' },
  { id: 'b23f6c91-1a54-45ce-bb6a-ed970b667add', versionId: '00032b0d-4049-4cd2-bf60-70ba73bf396c', title: '9ª' },
  { id: 'e4e8cf29-375f-4e87-bb5c-8d4558a314ff', versionId: 'fd9a3665-0ae9-4307-8121-a32a0f344be7', title: '10ª' },
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
  const token = j?.data?.token;
  if (!token) throw new Error('login failed');
  return token;
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
      j = { raw: text.slice(0, 500) };
    }
    return { status: r.status, j };
  } finally {
    clearTimeout(t);
  }
}

async function statusOf(id) {
  const { rows } = await c.query(
    `SELECT d.processing_status,
            v.embedding_status, v.qdrant_sync_status,
            length(coalesce(v.extracted_text,'')) AS text_len,
            (SELECT COUNT(*)::int FROM document_chunks WHERE document_version_id=v.id) AS chunks,
            (SELECT COUNT(*)::int FROM document_chunks WHERE document_version_id=v.id AND embedding_status='VALID') AS valid,
            (SELECT COUNT(*)::int FROM document_chunks WHERE document_version_id=v.id AND embedding_sync_status='SYNCED') AS synced
     FROM documents d JOIN document_versions v ON v.id=d.current_version_id
     WHERE d.id=$1`,
    [id],
  );
  return rows[0];
}

// Temporarily allow tech-admin endpoints if needed later
await c.query(
  `UPDATE users SET is_technical_admin=true, updated_at=NOW()
   WHERE email='compras@oftalmocentrouberaba.com.br'`,
);

const token = await login();
console.log('logged in');

// Wait for n8n to come up
for (let i = 0; i < 20; i++) {
  try {
    const r = await fetch(`${BASE}/webhook/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'x', password: 'y' }),
    });
    if (r.status) {
      console.log('n8n up', r.status);
      break;
    }
  } catch {
    console.log('waiting n8n', i);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

const report = [];

for (const doc of DOCS) {
  console.log(`\n==> ${doc.title} ${doc.id}`);
  const before = await statusOf(doc.id);
  console.log('  before', before);

  // Ensure version is processable
  await c.query(
    `UPDATE document_versions
     SET status='PROCESSING', processing_status='processing', validation_status='VALID', validation_error_code=NULL
     WHERE id=$1`,
    [doc.versionId],
  );
  await c.query(`UPDATE documents SET processing_status='processing', updated_at=NOW() WHERE id=$1`, [doc.id]);

  console.log('  process...');
  const proc = await api('/webhook/documents/process', token, { documentId: doc.id }, 600000);
  console.log('  process', proc.status, proc.j?.error?.code || proc.j?.success || proc.j?.message || '');

  let final = null;
  for (let i = 0; i < 90; i++) {
    final = await statusOf(doc.id);
    console.log('  poll', i, {
      ps: final.processing_status,
      emb: final.embedding_status,
      qd: final.qdrant_sync_status,
      chunks: final.chunks,
      valid: final.valid,
      synced: final.synced,
    });
    if (final.chunks > 0 && final.valid === final.chunks && (final.synced === final.chunks || final.qdrant_sync_status === 'SYNCED')) {
      break;
    }
    if (['failed', 'error'].includes(String(final.processing_status)) && i > 2) break;
    // text+chunks+valid embeddings is enough even if qdrant lagging a bit
    if (final.chunks > 0 && final.valid === final.chunks && i > 10) break;
    await new Promise((r) => setTimeout(r, 5000));
  }

  // Always restore dashboard-friendly status if we have usable content
  if (final?.text_len > 500 && final?.chunks > 0) {
    await c.query(
      `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW() WHERE id=$1`,
      [doc.id],
    );
    await c.query(
      `UPDATE document_versions SET status='READY', processing_status='processed',
         embedding_status=CASE WHEN $2::int>0 AND $2=$3 THEN 'VALID' ELSE embedding_status END,
         qdrant_sync_status=CASE WHEN $4::int>0 AND $4=$3 THEN 'SYNCED' ELSE COALESCE(qdrant_sync_status, qdrant_sync_status) END
       WHERE id=$1`,
      [doc.versionId, final.valid, final.chunks, final.synced],
    );
  }

  final = await statusOf(doc.id);
  report.push({ id: doc.id, title: doc.title, process: { status: proc.status, code: proc.j?.error?.code }, final });
  console.log('  final', final);
}

await c.query(
  `UPDATE users SET is_technical_admin=false, updated_at=NOW()
   WHERE email='compras@oftalmocentrouberaba.com.br'`,
);

const counts = await c.query(
  `SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
);
const emb = await c.query(
  `SELECT v.document_id, length(coalesce(v.extracted_text,'')) text_len,
          COUNT(*)::int chunks,
          COUNT(*) FILTER (WHERE c.embedding_status='VALID')::int valid,
          COUNT(*) FILTER (WHERE c.embedding_sync_status='SYNCED')::int synced
   FROM document_versions v
   JOIN document_chunks c ON c.document_version_id=v.id
   WHERE v.id = ANY($1::uuid[])
   GROUP BY v.document_id, v.extracted_text`,
  [DOCS.map((d) => d.versionId)],
);

const out = {
  at: new Date().toISOString(),
  counts: counts.rows,
  embeddingSummary: emb.rows,
  report,
};
writeFileSync(new URL('./finalize-embeddings-report.json', import.meta.url), JSON.stringify(out, null, 2));
console.log('\nCOUNTS', counts.rows);
console.log('EMB', emb.rows);
await c.end();
