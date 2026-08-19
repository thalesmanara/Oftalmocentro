/**
 * Reproduce + verify POST documents create after UUID undefined fix
 */
import { writeFileSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
// resolve pg from nearest node_modules walking up if present
let Client;
try {
  Client = require('pg').Client;
} catch {
  Client = null;
}

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
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 500) };
  }
  return { status: res.status, json };
}

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
if (!token) {
  writeFileSync('tmp/post-go-live/bug-uuid-fix.json', JSON.stringify({ error: 'login', login }, null, 2));
  process.exit(1);
}

const [sectors, categories] = await Promise.all([
  api('GET', '/webhook/sectors', token),
  api('GET', '/webhook/categories', token),
]);
const sectorList = sectors.json?.data || sectors.json || [];
const categoryList = categories.json?.data || categories.json || [];
const sector = (Array.isArray(sectorList) ? sectorList : []).find((s) => s.active !== false);
const category = (Array.isArray(categoryList) ? categoryList : []).find((c) => c.active !== false);

const subs = await api(
  'GET',
  `/webhook/subcategories?categoryId=${encodeURIComponent(category.id)}`,
  token,
);
const subList = subs.json?.data || subs.json || [];
const sub = (Array.isArray(subList) ? subList : []).find((s) => s.active !== false) || null;

const me = login.json?.data?.user || login.json?.data;
const userId = me?.id || login.json?.data?.userId;

const payload = {
  title: `TESTE FIX UUID ${new Date().toISOString().slice(0, 19)}`,
  sectorId: sector?.id,
  categoryId: category?.id,
  subcategoryId: sub?.id ?? null,
  semanticDescription: 'Documento de teste do hotfix invalid uuid undefined no POST Documentos.',
  expirationDate: null,
  isActive: true,
  fileName: null,
  fileType: null,
  fileSize: null,
  filePath: null,
  extractedText: null,
  responsibleUserId: userId,
  createdBy: userId,
  updatedBy: userId,
};

const created = await api('POST', '/webhook/documents/create', token, payload);

// Cleanup created test doc if possible
let deleted = null;
if (created.status < 300 && created.json?.data?.id) {
  deleted = await api('DELETE', '/webhook/documents/delete', token, {
    id: created.json.data.id,
  });
}

const out = {
  at: new Date().toISOString(),
  sector: sector && { id: sector.id, name: sector.name },
  category: category && { id: category.id, name: category.name },
  subcategory: sub && { id: sub.id, name: sub.name },
  userId,
  createStatus: created.status,
  createOk: created.status >= 200 && created.status < 300 && !!created.json?.data?.id,
  createError: created.json?.error || created.json?.message || null,
  createdId: created.json?.data?.id || null,
  deletedStatus: deleted?.status ?? null,
};
writeFileSync('tmp/post-go-live/bug-uuid-fix.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
