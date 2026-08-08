import { writeFileSync } from 'fs';
import pg from 'pg';

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
  return { status: res.status, json: await res.json().catch(() => null) };
}

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const before = (await c.query(`SELECT COUNT(*)::int AS n FROM audit_logs`)).rows[0].n;

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
const ai = await api('POST', '/webhook/consulta-ia', token, { question: 'Qual o CNPJ da clínica?' });
const docs = await api('GET', '/webhook/documents', token);
const target = (docs.json?.data || []).find((d) => d.processingStatus === 'processed');
let toggled = null;
if (target) {
  const off = await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: false,
  });
  const on = await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: true,
  });
  toggled = { off: off.json?.data?.isActive, on: on.json?.data?.isActive };
}

await new Promise((r) => setTimeout(r, 1500));
const after = await c.query(
  `SELECT action, success, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 20`,
);
const count = (await c.query(`SELECT COUNT(*)::int AS n FROM audit_logs`)).rows[0].n;

const out = {
  before,
  afterCount: count,
  login: login.status,
  ai: ai.status,
  toggled,
  recent: after.rows,
  ok: count > before && after.rows.some((r) => r.action === 'AUTH_LOGIN_SUCCESS' || r.action === 'AI_QUERY' || r.action === 'DOCUMENT_ACTIVATED' || r.action === 'DOCUMENT_DEACTIVATED'),
};
writeFileSync('tmp/post-go-live/28-3-audit-seed.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
