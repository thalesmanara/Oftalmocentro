#!/usr/bin/env node
/**
 * Garante texto+chunks via PG/Tika e limpa dashboard (processed).
 * Em seguida tenta um process completo no 1º doc para embeddings/Qdrant.
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
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
    .join('\n')
    .trim();
}

function makeChunks(rawText, documentId, versionId) {
  const text = normalizeDocumentText(rawText);
  const soft = text.replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  const chunkSize = 1100;
  const overlap = 160;
  const chunks = [];
  let i = 0;
  while (i < soft.length) {
    let end = Math.min(i + chunkSize, soft.length);
    if (end < soft.length) {
      const window = soft.slice(i, end);
      const idx = Math.max(window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' '));
      if (idx >= Math.floor(chunkSize * 0.55)) end = i + idx + 1;
    }
    const content = soft.slice(i, end).trim();
    if (content.length >= 40) chunks.push({ documentId, versionId, chunkIndex: chunks.length, content });
    if (end >= soft.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return { text, chunks };
}

function tikaExtract(filePath) {
  const script = `const fs=require('fs');const http=require('http');
const full=process.argv[1];
const buf=fs.readFileSync(full);
const req=http.request({hostname:'tika',port:9998,path:'/tika',method:'PUT',headers:{Accept:'text/plain','Content-Type':'application/pdf','Content-Length':buf.length},timeout:180000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(Buffer.concat(c)));});
req.on('error',e=>{console.error(String(e));process.exit(1);});
req.write(buf);req.end();`;
  const b64 = Buffer.from(script).toString('base64');
  const remote = `docker exec -i 68f4b339f0f7 sh -c 'echo ${b64} | base64 -d > /tmp/tika-one.js && node /tmp/tika-one.js "$1"' _ ${JSON.stringify(filePath)}`;
  return execFileSync('ssh', ['oftalmocentro', remote], {
    maxBuffer: 20 * 1024 * 1024,
    timeout: 240000,
  }).toString('utf8');
}

const report = [];
for (const doc of DOCS) {
  console.log('\n==>', doc.id);
  const { rows: vrows } = await c.query(
    `SELECT file_path, length(coalesce(extracted_text,'')) AS n, extracted_text FROM document_versions WHERE id=$1`,
    [doc.versionId],
  );
  let raw = vrows[0].n > 500 ? vrows[0].extracted_text : null;
  if (!raw) {
    console.log('  tika...');
    raw = tikaExtract(vrows[0].file_path);
  }
  const { text, chunks } = makeChunks(raw, doc.id, doc.versionId);
  console.log('  text', text.length, 'chunks', chunks.length);

  await c.query(
    `UPDATE document_versions
     SET extracted_text=$1, extraction_method='tika', ocr_status='NOT_REQUIRED',
         status='READY', processing_status='processed', validation_status='VALID', validation_error_code=NULL
     WHERE id=$2`,
    [text, doc.versionId],
  );
  await c.query(`UPDATE documents SET extracted_text=$1, updated_at=NOW() WHERE id=$2`, [text, doc.id]);
  await c.query(`DELETE FROM document_chunks WHERE document_version_id=$1 OR document_id=$2`, [doc.versionId, doc.id]);
  for (const ch of chunks) {
    const hash = createHash('sha256').update(ch.content, 'utf8').digest('hex');
    await c.query(
      `INSERT INTO document_chunks (document_id, document_version_id, chunk_order, chunk_index, chunk_text, content_hash, embedding_status)
       VALUES ($1,$2,$3,$3,$4,$5,'PENDING')`,
      [ch.documentId, ch.versionId, ch.chunkIndex, ch.content, hash],
    );
  }
  await c.query(
    `UPDATE documents SET processing_status='processed', processed_at=COALESCE(processed_at,NOW()), updated_at=NOW() WHERE id=$1`,
    [doc.id],
  );
  report.push({ id: doc.id, text: text.length, chunks: chunks.length });
}

// Soft-delete 7ª if still pending without file (already deleted earlier)
await c.query(`
  UPDATE documents SET deleted_at=COALESCE(deleted_at,NOW()), updated_at=NOW()
  WHERE deleted_at IS NULL AND processing_status IN ('pending','processing','failed','error')
    AND current_version_id IN (
      SELECT id FROM document_versions
      WHERE COALESCE(NULLIF(file_path,''), NULLIF(file_name,''), NULLIF(stored_file_name,'')) IS NULL
    )
`);

const counts = await c.query(
  `SELECT processing_status, COUNT(*)::int n FROM documents WHERE deleted_at IS NULL GROUP BY 1 ORDER BY 2 DESC`,
);
const remaining = await c.query(
  `SELECT id, title, processing_status FROM documents
   WHERE deleted_at IS NULL AND processing_status IN ('processing','failed','pending','error')
   ORDER BY 3,2`,
);
console.log('\nCOUNTS', counts.rows);
console.log('REMAINING', remaining.rows);
writeFileSync(
  new URL('./reprocess-report.json', import.meta.url),
  JSON.stringify({ at: new Date().toISOString(), counts: counts.rows, remaining: remaining.rows, report }, null, 2),
);
await c.end();
