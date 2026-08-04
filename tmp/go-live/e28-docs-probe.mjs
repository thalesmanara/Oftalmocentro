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

const res = await fetch(`${BASE}/webhook/documents?pageSize=100`, { headers: auth });
const text = await res.text();
let docs;
try {
  docs = JSON.parse(text);
} catch {
  docs = { raw: text.slice(0, 500) };
}
writeFileSync(new URL('./_docs-list-raw.json', import.meta.url), JSON.stringify(docs, null, 2).slice(0, 50000));

const items =
  docs?.data?.items ||
  docs?.data?.documents ||
  docs?.items ||
  docs?.documents ||
  (Array.isArray(docs?.data) ? docs.data : null) ||
  [];
const list = Array.isArray(items) ? items : [];
console.log('status', res.status, 'count', list.length);
if (list[0]) console.log('keys', Object.keys(list[0]));
const statuses = {};
for (const d of list) {
  const s = String(d.status || d.processing_status || d.processingStatus || '?');
  statuses[s] = (statuses[s] || 0) + 1;
}
console.log('statuses', statuses);

const ready = list.find((d) =>
  ['READY', 'ACTIVE', 'PUBLISHED', 'ready'].includes(
    String(d.status || d.processing_status || d.processingStatus || ''),
  ),
);
const sample = ready || list.find((d) => d.id) || null;
const out = { at: new Date().toISOString(), listed: list.length, statuses, sample };

if (sample?.id) {
  for (const path of [
    `/webhook/documents/${sample.id}`,
    `/webhook/document/${sample.id}`,
    `/webhook/documents/detail?id=${sample.id}`,
  ]) {
    const r = await fetch(`${BASE}${path}`, { headers: auth });
    console.log('try', path, r.status);
    out[`try_${path}`] = r.status;
  }
}

writeFileSync(new URL('./documents-e2e-sample.json', import.meta.url), JSON.stringify(out, null, 2));
