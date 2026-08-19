import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

// sync history
const id = 'WLlD1eqbFmKDK9ow';
const { rows } = await c.query(
  `SELECT name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [id],
);
const row = rows[0];
await c.query(
  `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
   WHERE "workflowId"=$3 AND "versionId"=$4`,
  [JSON.stringify(row.nodes), JSON.stringify(row.connections), id, row.activeVersionId],
);

// cleanup previous tests
await c.query(`
  DELETE FROM document_versions WHERE document_id IN (
    SELECT id FROM documents WHERE title ILIKE 'HOTFIX%' OR title ILIKE 'SIMULATE%' OR title ILIKE 'CTE DEBUG%' OR title ILIKE 'STEPTEST%'
  );
  DELETE FROM documents WHERE title ILIKE 'HOTFIX%' OR title ILIKE 'SIMULATE%' OR title ILIKE 'CTE DEBUG%' OR title ILIKE 'STEPTEST%';
`);

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
  return { status: res.status, json, empty: !text };
}

const login = await api('POST', '/webhook/auth/login', null, { email, password: pass });
const token = login.json?.data?.token;
const userId = login.json?.data?.user?.id;
const sectors = await api('GET', '/webhook/sectors', token);
const categories = await api('GET', '/webhook/categories', token);
const sector = (sectors.json?.data || []).find((s) => /FATURAMENTO/i.test(s.name)) || (sectors.json?.data || [])[0];
const category = (categories.json?.data || []).find((c) => /AMIL/i.test(c.name)) || (categories.json?.data || []).find((c) => c.active !== false);
const subs = await api('GET', `/webhook/subcategories?categoryId=${encodeURIComponent(category.id)}`, token);
const sub = (subs.json?.data || []).find((s) => /AMIL/i.test(s.name)) || (subs.json?.data || [])[0] || null;

const created = await api('POST', '/webhook/documents/create', token, {
  title: `MANUAL AMIL TESTE HOTFIX ${Date.now()}`,
  sectorId: sector.id,
  categoryId: category.id,
  subcategoryId: sub?.id ?? null,
  semanticDescription: 'Teste do hotfix para Ana Carla / uuid undefined',
  expirationDate: null,
  isActive: true,
  responsibleUserId: userId,
  createdBy: userId,
  updatedBy: userId,
});

const createdId = created.json?.data?.id;
let db = null;
if (createdId) {
  db = (
    await c.query(
      `SELECT id, title, current_version_id, subcategory_id, is_active FROM documents WHERE id=$1`,
      [createdId],
    )
  ).rows[0];
  await api('DELETE', '/webhook/documents/delete', token, { id: createdId });
}

const out = {
  at: new Date().toISOString(),
  sector: { id: sector?.id, name: sector?.name },
  category: { id: category?.id, name: category?.name },
  subcategory: sub ? { id: sub.id, name: sub.name } : null,
  status: created.status,
  empty: created.empty,
  hasId: !!createdId,
  createdId,
  error: created.json?.error || null,
  db,
  connections: {
    sqlToMontar: JSON.stringify(row.connections['Execute a SQL query'] || null),
    sqlToVincular: JSON.stringify(row.connections['Vincular versão atual'] || null),
  },
};
writeFileSync('tmp/post-go-live/bug-uuid-verify-final.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
