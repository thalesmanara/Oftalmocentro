#!/usr/bin/env node
/**
 * Completa chunks (já salvos) + embeddings via webhook (user agora tech admin).
 * Marca processed no final.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const DOCS = [
  { id: 'a2d13fce-7562-4682-99eb-c48d9ca1655c', versionId: '55ce423b-b29a-467b-8ba1-7f398651f669' },
  { id: 'b23f6c91-1a54-45ce-bb6a-ed970b667add', versionId: '00032b0d-4049-4cd2-bf60-70ba73bf396c' },
  { id: 'e4e8cf29-375f-4e87-bb5c-8d4558a314ff', versionId: 'fd9a3665-0ae9-4307-8121-a32a0f344be7' },
];

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

function normalizeDocumentText(raw) {
  let t = String(raw ?? '');
  t = t.normalize('NFC');
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
  t = t.replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n]/gu, '');
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  return t
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
    .join('\n')
    .trim();
}

function chunkText(rawText, documentId, versionId) {
  const text = normalizeDocumentText(rawText);
  const soft = text.replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  const chunkSize = 1100;
  const overlap = 160;
  const minChunk = 40;
  const chunks = [];
  let i = 0;
  while (i < soft.length) {
    let end = Math.min(i + chunkSize, soft.length);
    if (end < soft.length) {
      const window = soft.slice(i, end);
      const candidates = [window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' ')];
      const idx = Math.max(...candidates);
      if (idx >= Math.floor(chunkSize * 0.55)) end = i + idx + 1;
    }
    const content = soft.slice(i, end).trim();
    if (content.length >= minChunk) chunks.push({ documentId, versionId, chunkIndex: chunks.length, content });
    if (end >= soft.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return { text, chunks };
}

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
  console.log('techAdmin', j?.data?.user?.isTechnicalAdmin ?? j?.data?.isTechnicalAdmin);
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
      j = { raw: text.slice(0, 400) };
    }
    return { status: r.status, j };
  } finally {
    clearTimeout(t);
  }
}

async function tikaExtract(filePath) {
  const script = `const fs=require('fs');const http=require('http');
const full=process.argv[1];
const buf=fs.readFileSync(full);
const req=http.request({hostname:'tika',port:9998,path:'/tika',method:'PUT',headers:{Accept:'text/plain','Content-Type':'application/pdf','Content-Length':buf.length},timeout:180000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>{process.stdout.write(Buffer.concat(c));});});
req.on('error',e=>{console.error(String(e));process.exit(1);});
req.write(buf);req.end();`;
  const b64 = Buffer.from(script).toString('base64');
  const remote = `docker exec -i 68f4b339f0f7 sh -c 'echo ${b64} | base64 -d > /tmp/tika-one.js && node /tmp/tika-one.js "$1"' _ ${JSON.stringify(filePath)}`;
  const out = execFileSync('ssh', ['oftalmocentro', remote], {
    maxBuffer: 20 * 1024 * 1024,
    timeout: 240000,
  });
  return out.toString('utf8');
}

async function ensureChunks(doc) {
  const { rows: ch } = await c.query(
    `SELECT COUNT(*)::int n FROM document_chunks WHERE document_version_id=$1`,
    [doc.versionId],
  );
  if (ch[0].n > 0) {
    console.log('  chunks already', ch[0].n);
    await c.query(
      `UPDATE document_chunks SET embedding_status='PENDING', embedding_next_retry_at=NULL
       WHERE document_version_id=$1 AND embedding_status <> 'VALID'`,
      [doc.versionId],
    );
    return ch[0].n;
  }

  const { rows } = await c.query(
    `SELECT length(coalesce(extracted_text,'')) AS n, extracted_text, file_path FROM document_versions WHERE id=$1`,
    [doc.versionId],
  );
  let raw = rows[0]?.n > 500 ? rows[0].extracted_text : null;
  if (!raw) {
    console.log('  tika...');
    raw = await tikaExtract(rows[0].file_path);
  }
  const { text, chunks } = chunkText(raw, doc.id, doc.versionId);
  console.log('  textLen', text.length, 'chunks', chunks.length);
  await c.query(
    `UPDATE document_versions SET extracted_text=$1, extraction_method='tika', ocr_status='NOT_REQUIRED', status='READY', processing_status='processed' WHERE id=$2`,
    [text, doc.versionId],
  );
  await c.query(`UPDATE documents SET extracted_text=$1, updated_at=NOW() WHERE id=$2`, [text, doc.id]);
  await c.query(`DELETE FROM document_chunks WHERE document_version_id=$1 OR document_id=$2`, [doc.versionId, doc.id]);
  for (const x of chunks) {
    const hash = createHash('sha256').update(x.content, 'utf8').digest('hex');
    await c.query(
      `INSERT INTO document_chunks (document_id, document_version_id, chunk_order, chunk_index, chunk_text, content_hash, embedding_status)
       VALUES ($1,$2,$3,$3,$4,$5,'PENDING')`,
      [x.documentId, x.versionId, x.chunkIndex, x.content, hash],
    );
  }
  return chunks.length;
}

const token = await login();
const report = [];

for (const doc of DOCS) {
  console.log('\n==>', doc.id);
  const item = { id: doc.id };
  try {
    item.chunks = await ensureChunks(doc);
    console.log('  embeddings reprocess...');
    const emb = await api('POST', '/webhook/system/embeddings/reprocess', token, { force: true, limit: 200 }, 600000);
    item.emb = {
      status: emb.status,
      success: emb.j?.success,
      data: emb.j?.data,
      error: emb.j?.error,
      message: emb.j?.message,
    };
    console.log('  emb', item.emb);

    for (let i = 0; i < 60; i++) {
      const { rows } = await c.query(
        `SELECT
           d.processing_status,
           v.embedding_status,
           v.qdrant_sync_status,
           (SELECT COUNT(*) FILTER (WHERE embedding_status='VALID') FROM document_chunks WHERE document_version_id=v.id) AS valid_chunks,
           (SELECT COUNT(*) FROM document_chunks WHERE document_version_id=v.id) AS total_chunks
         FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
        [doc.id],
      );
      const st = rows[0];
      console.log('  poll', i, st);
      if (st.valid_chunks > 0 && st.valid_chunks === st.total_chunks) {
        await c.query(
          `UPDATE document_versions SET embedding_status='VALID', qdrant_sync_status=COALESCE(qdrant_sync_status,'SYNCED') WHERE id=$1`,
          [doc.versionId],
        );
        break;
      }
      if (i > 5 && Number(st.valid_chunks) === 0 && emb.status !== 200) break;
      await new Promise((r) => setTimeout(r, 5000));
    }

    await c.query(
      `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW() WHERE id=$1`,
      [doc.id],
    );
    await c.query(
      `UPDATE document_versions SET status='READY', processing_status='processed' WHERE id=$1`,
      [doc.versionId],
    );
    const { rows: fin } = await c.query(
      `SELECT d.processing_status, v.embedding_status, v.qdrant_sync_status,
              (SELECT COUNT(*) FILTER (WHERE embedding_status='VALID') FROM document_chunks WHERE document_version_id=v.id) AS valid_chunks
       FROM documents d JOIN document_versions v ON v.id=d.current_version_id WHERE d.id=$1`,
      [doc.id],
    );
    item.final = fin[0];
  } catch (e) {
    item.error = String(e?.message || e);
    console.error('  FAIL', item.error);
  }
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
