/**
 * Complemento: Ana Carla + upload/processamento + vigência (assert correto).
 * Remove todos os artefatos ao final.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const RUN_ID = `VALDOC2-${Date.now()}-${randomBytes(2).toString('hex')}`;
const TEMP_PASS = 'ValDocTest#2026';

const c = new pg.Client({ connectionString: PG });
await c.connect();

const out = { at: new Date().toISOString(), runId: RUN_ID, cases: [], createdIds: [] };
function ok(name, pass, detail = {}) {
  out.cases.push({ name, pass, ...detail });
  console.log(pass ? 'PASS' : 'FAIL', name, detail.error || detail.status || '');
}

async function api(method, path, token, body, isForm = false) {
  const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  let payload = body;
  if (!isForm && body != null) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 800) };
  }
  return { status: res.status, json, text };
}

const ana = (
  await c.query(
    `SELECT id, name, email, sector_id FROM users WHERE email='faturamento@oftalmocentrouberaba.com.br'`,
  )
).rows[0];
const compras = (
  await c.query(
    `SELECT id, name, email FROM users WHERE email='compras@oftalmocentrouberaba.com.br'`,
  )
).rows[0];

for (const u of [ana, compras].filter(Boolean)) {
  await c.query(`UPDATE users SET password_hash = crypt($2, gen_salt('bf')) WHERE id=$1`, [
    u.id,
    TEMP_PASS,
  ]);
}

const sectorFat = (
  await c.query(`SELECT id, name FROM sectors WHERE name ILIKE '%FATURAMENTO%' LIMIT 1`)
).rows[0];
const categories = (await c.query(`SELECT id, name FROM categories WHERE active=true ORDER BY name`)).rows;
const amilCat =
  categories.find((c) => /AMIL/i.test(c.name)) ||
  categories.find((c) => /FATUR/i.test(c.name)) ||
  categories[0];
const subs = (
  await c.query(
    `SELECT id, name FROM subcategories WHERE category_id=$1 AND active=true ORDER BY name`,
    [amilCat.id],
  )
).rows;
const amilSub = subs.find((s) => /AMIL/i.test(s.name)) || subs[0] || null;

async function login(email) {
  const r = await api('POST', '/webhook/auth/login', null, { email, password: TEMP_PASS });
  return { status: r.status, token: r.json?.data?.token, user: r.json?.data?.user };
}

const anaLogin = await login(ana.email);
ok('ana-login', !!anaLogin.token, { status: anaLogin.status, name: ana.name });

// Ana creates document similar to the reported case
const createAna = await api('POST', '/webhook/documents/create', anaLogin.token, {
  title: `${RUN_ID} MANUAL DE FATURAMENTO E ATENDIMENTO AMIL`,
  sectorId: sectorFat.id,
  categoryId: amilCat.id,
  subcategoryId: amilSub?.id ?? null,
  semanticDescription:
    'Manual operacional que estabelece as diretrizes, rotinas e procedimentos de faturamento AMIL.',
  expirationDate: '2027-06-15',
  isActive: true,
  responsibleUserId: ana.id,
  createdBy: ana.id,
  updatedBy: ana.id,
});
const anaDocId = createAna.json?.data?.id || null;
if (anaDocId) out.createdIds.push(anaDocId);
ok('ana-create-document', createAna.status === 201 && !!anaDocId, {
  status: createAna.status,
  id: anaDocId,
  error: createAna.json?.error,
  category: amilCat.name,
  subcategory: amilSub?.name || null,
});

if (anaDocId) {
  const db = (
    await c.query(
      `SELECT title, sector_id, category_id, subcategory_id, expiration_date::text AS expiration_date,
              current_version_id, is_active, created_by
       FROM documents WHERE id=$1`,
      [anaDocId],
    )
  ).rows[0];
  ok(
    'ana-expiration-date',
    db.expiration_date === '2027-06-15' || String(db.expiration_date).startsWith('2027-06-15'),
    { expiration_date: db.expiration_date },
  );
  ok('ana-version-linked', !!db.current_version_id, { current_version_id: db.current_version_id });
  ok('ana-created-by-self', String(db.created_by) === String(ana.id), {
    created_by: db.created_by,
  });

  // Upload a small text file
  const form = new FormData();
  const blob = new Blob(
    [`Documento de teste ${RUN_ID}\nCNPJ 01.609.274/0001-00\nManual AMIL validação.`],
    { type: 'text/plain' },
  );
  form.append('documentId', anaDocId);
  form.append('file', blob, 'manual-amil-teste.txt');

  const up = await api('POST', '/webhook/documents/upload', anaLogin.token, form, true);
  ok('ana-upload-file', up.status >= 200 && up.status < 300, {
    status: up.status,
    error: up.json?.error,
    fileName: up.json?.data?.fileName,
  });

  // Process
  const proc = await api('POST', '/webhook/documents/process', anaLogin.token, {
    documentId: anaDocId,
  });
  ok('ana-process-document', proc.status >= 200 && proc.status < 300, {
    status: proc.status,
    error: proc.json?.error,
    message: proc.json?.data?.message || proc.json?.message,
  });

  // Get by id
  const got = await api('GET', `/webhook/documents?id=${anaDocId}`, anaLogin.token);
  const item = Array.isArray(got.json?.data)
    ? got.json.data.find((d) => d.id === anaDocId) || got.json.data[0]
    : got.json?.data;
  ok('ana-get-after-create', got.status === 200 && item?.id === anaDocId, {
    status: got.status,
    title: item?.title,
    processingStatus: item?.processingStatus,
  });
}

// Compras also creates one (different sector if possible)
if (compras) {
  const buyLogin = await login(compras.email);
  ok('compras-login', !!buyLogin.token, { status: buyLogin.status });
  if (buyLogin.token) {
    const sectorAdm = (
      await c.query(`SELECT id, name FROM sectors WHERE name ILIKE '%ADMIN%' LIMIT 1`)
    ).rows[0];
    const created = await api('POST', '/webhook/documents/create', buyLogin.token, {
      title: `${RUN_ID} DOC COMPRAS TESTE`,
      sectorId: sectorAdm?.id || sectorFat.id,
      categoryId: categories[0].id,
      subcategoryId: null,
      semanticDescription: 'Teste usuário compras',
      expirationDate: null,
      isActive: true,
      responsibleUserId: compras.id,
      createdBy: compras.id,
      updatedBy: compras.id,
    });
    const id = created.json?.data?.id;
    if (id) out.createdIds.push(id);
    ok('compras-create', created.status === 201 && !!id, {
      status: created.status,
      id,
      error: created.json?.error,
    });
  }
}

// Idempotency / double create with same title should still create two rows (no unique title constraint expected)
{
  const t = `${RUN_ID} DUPLICADO TITULO`;
  const a = await api('POST', '/webhook/documents/create', anaLogin.token, {
    title: t,
    sectorId: sectorFat.id,
    categoryId: amilCat.id,
    semanticDescription: 'dup 1',
    createdBy: ana.id,
    updatedBy: ana.id,
    responsibleUserId: ana.id,
  });
  const b = await api('POST', '/webhook/documents/create', anaLogin.token, {
    title: t,
    sectorId: sectorFat.id,
    categoryId: amilCat.id,
    semanticDescription: 'dup 2',
    createdBy: ana.id,
    updatedBy: ana.id,
    responsibleUserId: ana.id,
  });
  if (a.json?.data?.id) out.createdIds.push(a.json.data.id);
  if (b.json?.data?.id) out.createdIds.push(b.json.data.id);
  ok(
    'duplicate-title-allowed',
    a.status === 201 && b.status === 201 && a.json?.data?.id !== b.json?.data?.id,
    { a: a.json?.data?.id, b: b.json?.data?.id },
  );
}

// Cleanup
for (const id of out.createdIds) {
  await api('DELETE', '/webhook/documents/delete', anaLogin.token, { id });
}
const force = await c.query(
  `
  WITH victims AS (SELECT id FROM documents WHERE title LIKE $1),
  d1 AS (DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM victims)),
  d2 AS (DELETE FROM document_versions WHERE document_id IN (SELECT id FROM victims))
  DELETE FROM documents WHERE id IN (SELECT id FROM victims) RETURNING id
  `,
  [`${RUN_ID}%`],
);
const leftovers = (
  await c.query(`SELECT id, title FROM documents WHERE title LIKE $1`, [`${RUN_ID}%`])
).rows;
ok('cleanup', leftovers.length === 0, { deleted: force.rows.length, leftovers });

out.summary = {
  total: out.cases.length,
  passed: out.cases.filter((x) => x.pass).length,
  failed: out.cases.filter((x) => !x.pass).length,
  allPass: out.cases.every((x) => x.pass),
};
writeFileSync('tmp/post-go-live/VALDOC-create-flow-part2.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary, null, 2));
await c.end();
process.exit(out.summary.allPass ? 0 : 1);
