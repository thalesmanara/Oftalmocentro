#!/usr/bin/env node
/**
 * Etapa 28 — amostra documental E2E sem deixar lixo: lista tipos, status READY,
 * preview/download smoke em documento existente; NÃO cria uploads produtivos.
 */
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

const docs = await (await fetch(`${BASE}/webhook/documents?limit=50`, { headers: auth })).json();
const items = docs?.data?.items || docs?.items || docs?.data || [];
const list = Array.isArray(items) ? items : [];

const byExt = {};
for (const d of list) {
  const name = d.fileName || d.filename || d.title || d.name || '';
  const ext = (String(name).split('.').pop() || 'unknown').toLowerCase();
  byExt[ext] = (byExt[ext] || 0) + 1;
}

const ready = list.filter((d) => String(d.status || d.processingStatus || '').toUpperCase() === 'READY');
const sample = ready[0] || list[0];
const out = {
  at: new Date().toISOString(),
  listed: list.length,
  byExt,
  readyCount: ready.length,
  sampleId: sample?.id || null,
  sampleStatus: sample?.status || sample?.processingStatus || null,
  note: 'Sem upload destrutivo em produção nesta sessão; validação amostral sobre acervo existente + smokes IA/OCR via Consulta.',
};

if (sample?.id) {
  const detail = await fetch(`${BASE}/webhook/documents/${sample.id}`, { headers: auth });
  out.detailStatus = detail.status;
  const dl = await fetch(`${BASE}/webhook/documents/${sample.id}/download`, {
    headers: auth,
    method: 'GET',
  });
  out.downloadStatus = dl.status;
  out.downloadBytes = Number(dl.headers.get('content-length') || 0);
}

writeFileSync(new URL('./documents-e2e-sample.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
