#!/usr/bin/env node
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json();
const token = login?.data?.token || login?.data?.accessToken;
const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

if (!token) {
  console.error('login failed', login);
  process.exit(1);
}
const docsRes = await fetch(`${BASE}/webhook/documents`, { headers: auth });
const docsText = await docsRes.text();
let docs;
try {
  docs = JSON.parse(docsText);
} catch {
  docs = { parseError: true, raw: docsText.slice(0, 300) };
}
const list =
  docs?.data?.items ||
  docs?.data?.documents ||
  docs?.items ||
  docs?.documents ||
  (Array.isArray(docs?.data) ? docs.data : null) ||
  [];
console.log('docsHttp', docsRes.status, 'listLen', Array.isArray(list) ? list.length : typeof list, 'topKeys', docs && Object.keys(docs));

const byExt = {};
const byStatus = {};
const byOcr = {};
const byEmb = {};
for (const d of list) {
  const ext = String(d.fileExtension || d.fileType || '?').toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + 1;
  byStatus[d.processingStatus] = (byStatus[d.processingStatus] || 0) + 1;
  byOcr[d.ocrStatus || 'n/a'] = (byOcr[d.ocrStatus || 'n/a'] || 0) + 1;
  byEmb[d.embeddingStatus || 'n/a'] = (byEmb[d.embeddingStatus || 'n/a'] || 0) + 1;
}

const processed = list.filter((d) => d.processingStatus === 'processed');
const withOcr = list.filter((d) => d.ocrStatus && d.ocrStatus !== 'not_needed' && d.ocrStatus !== 'skipped');
const tabular = list.filter((d) => Number(d.sheetCount || 0) > 0 || Number(d.tableRowCount || 0) > 0);
const sample = processed.find((d) => d.qdrantSyncStatus === 'synced' || d.embeddingStatus === 'completed') || processed[0];

const out = {
  at: new Date().toISOString(),
  listed: list.length,
  byExt,
  byStatus,
  byOcr,
  byEmb,
  tabularCount: tabular.length,
  withOcrCount: withOcr.length,
  sample: sample
    ? {
        id: sample.id,
        title: sample.title,
        ext: sample.fileExtension,
        processingStatus: sample.processingStatus,
        ocrStatus: sample.ocrStatus,
        embeddingStatus: sample.embeddingStatus,
        qdrantSyncStatus: sample.qdrantSyncStatus,
      }
    : null,
  tests: {},
};

if (sample?.id) {
  const dl = await fetch(
    `${BASE}/webhook/documents/download?documentId=${encodeURIComponent(sample.id)}`,
    { headers: auth },
  );
  out.tests.download = {
    status: dl.status,
    bytes: Number(dl.headers.get('content-length') || 0),
    type: dl.headers.get('content-type'),
  };

  const vers = await fetch(
    `${BASE}/webhook/documents/versions?documentId=${encodeURIComponent(sample.id)}`,
    { headers: auth },
  );
  out.tests.versions = { status: vers.status };

  if (tabular[0]) {
    const prev = await fetch(
      `${BASE}/webhook/documents/tabular/preview?documentId=${encodeURIComponent(tabular[0].id)}`,
      { headers: auth },
    );
    out.tests.tabularPreview = {
      status: prev.status,
      docId: tabular[0].id,
      sheets: tabular[0].sheetCount,
    };
  }
}

// Consulta IA over processed corpus (OCR / planilha / normal already covered in homolog-smoke)
out.tests.note =
  'Sem upload novo em produção; acervo existente validado (list/download/versions/tabular).';

writeFileSync(new URL('./documents-e2e-sample.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
