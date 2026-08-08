import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
}

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json.data.token;
const docs = await api('GET', '/webhook/documents', token);
const list = docs.json.data || [];
const target =
  list.find((d) => d.isActive !== false && /ESTACIONAMENTO/i.test(d.title || '')) ||
  list.find((d) => d.isActive !== false && d.processingStatus === 'processed');

await api('PUT', '/webhook/documents/update', token, {
  id: target.id,
  title: target.title,
  sectorId: target.sectorId,
  categoryId: target.categoryId,
  subcategoryId: target.subcategoryId ?? null,
  semanticDescription: target.semanticDescription ?? null,
  expirationDate: target.expirationDate ?? null,
  isActive: false,
});

const q = await api('POST', '/webhook/consulta-ia', token, {
  question: `Traga informações exclusivas do documento exatamente intitulado: ${target.title}`,
});
const sources = q.json?.data?.sources || [];
const ids = sources.map((s) => s.documentId || s.id);
const leaked = ids.includes(target.id) || sources.some((s) => (s.documentTitle || s.title) === target.title);

await api('PUT', '/webhook/documents/update', token, {
  id: target.id,
  title: target.title,
  sectorId: target.sectorId,
  categoryId: target.categoryId,
  subcategoryId: target.subcategoryId ?? null,
  semanticDescription: target.semanticDescription ?? null,
  expirationDate: target.expirationDate ?? null,
  isActive: true,
});

const result = {
  targetId: target.id,
  targetTitle: target.title,
  leaked,
  sourceIds: ids,
  sourceTitles: sources.map((s) => s.documentTitle || s.title),
  ok: !leaked,
};
writeFileSync('tmp/post-go-live/28-2-inactive-ia.json', JSON.stringify(result, null, 2));
console.log(result);
