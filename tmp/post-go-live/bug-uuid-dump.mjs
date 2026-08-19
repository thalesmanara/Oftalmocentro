import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const email = 'compras@oftalmocentrouberaba.com.br';
const pass = '12345678';

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
    json = { raw: text.slice(0, 1000) };
  }
  return { status: res.status, json, text: text.slice(0, 2000) };
}

const login = await api('POST', '/webhook/auth/login', null, { email, password: pass });
const token = login.json?.data?.token;
const userId = login.json?.data?.user?.id;

const sectors = await api('GET', '/webhook/sectors', token);
const categories = await api('GET', '/webhook/categories', token);
const sector = (sectors.json?.data || [])[0];
const category = (categories.json?.data || []).find((x) => x.active !== false);

const created = await api('POST', '/webhook/documents/create', token, {
  title: `HOTFIX UUID DUMP ${Date.now()}`,
  sectorId: sector.id,
  categoryId: category.id,
  subcategoryId: null,
  semanticDescription: 'dump',
  expirationDate: null,
  isActive: true,
  responsibleUserId: userId,
  createdBy: userId,
  updatedBy: userId,
});

// Check if column is_active exists
const cols = (
  await c.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='documents' AND column_name='is_active'`,
  )
).rows;

const recentExec = (
  await c.query(
    `SELECT id, status, "startedAt"
     FROM execution_entity
     WHERE "workflowId"='WLlD1eqbFmKDK9ow'
     ORDER BY "startedAt" DESC
     LIMIT 5`,
  )
).rows;

writeFileSync(
  'tmp/post-go-live/bug-uuid-dump.json',
  JSON.stringify({ created, cols, recentExec, loginUser: login.json?.data?.user }, null, 2),
);
console.log(JSON.stringify({ status: created.status, keys: Object.keys(created.json || {}), json: created.json, cols, recentExec }, null, 2));
await c.end();
