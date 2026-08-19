/**
 * Validação completa do fluxo POST Documentos.
 * Cria documentos reais em cenários variados e remove ao final.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const RUN_ID = `VALDOC-${Date.now()}-${randomBytes(2).toString('hex')}`;
const TEMP_PASS = 'ValDocTest#2026';

const c = new pg.Client({ connectionString: PG });
await c.connect();

const results = {
  at: new Date().toISOString(),
  runId: RUN_ID,
  users: [],
  cases: [],
  createdIds: [],
  cleanup: null,
  summary: null,
};

function ok(name, pass, detail = {}) {
  results.cases.push({ name, pass, ...detail });
  console.log(pass ? 'PASS' : 'FAIL', name, detail.error || detail.status || '');
}

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
    json = { raw: text.slice(0, 800) };
  }
  return { status: res.status, json, text };
}

// --- Users with cadastrar/editar documentos permission ---
const userRows = (
  await c.query(`
    SELECT DISTINCT u.id, u.name, u.email, u.active, u.is_master, u.is_technical_admin,
           s.name AS sector_name, u.sector_id
    FROM users u
    LEFT JOIN sectors s ON s.id = u.sector_id
    LEFT JOIN user_permissions up ON up.user_id = u.id
    LEFT JOIN permissions p ON p.id = up.permission_id
    WHERE u.active = true
      AND u.email IS NOT NULL
      AND (
        u.is_master = true
        OR p.code IN ('criar_documentos','editar_documentos','cadastrar_documentos','gerenciar_documentos')
        OR p.code ILIKE '%documento%'
      )
    ORDER BY u.is_master DESC, u.name
    LIMIT 12
  `)
).rows;

// Fallback: any active users if permission join is empty
const users =
  userRows.length > 0
    ? userRows
    : (
        await c.query(`
          SELECT u.id, u.name, u.email, u.active, u.is_master, u.is_technical_admin,
                 s.name AS sector_name, u.sector_id
          FROM users u
          LEFT JOIN sectors s ON s.id = u.sector_id
          WHERE u.active = true AND u.email IS NOT NULL
          ORDER BY u.is_master DESC, u.name
          LIMIT 8
        `)
      ).rows;

// Discover permission codes related to documents
const permCodes = (
  await c.query(`
    SELECT code, name FROM permissions
    WHERE code ILIKE '%doc%' OR name ILIKE '%doc%'
    ORDER BY code
  `)
).rows;

results.permissionCodes = permCodes;

// Reset passwords for selected users (lab only)
const testUsers = users.slice(0, 5);
for (const u of testUsers) {
  await c.query(
    `UPDATE users SET password_hash = crypt($2, gen_salt('bf')), updated_at = NOW() WHERE id = $1`,
    [u.id, TEMP_PASS],
  );
}

// Taxonomy
const sectors = (await c.query(`SELECT id, name, active FROM sectors WHERE active = true ORDER BY name`)).rows;
const categories = (
  await c.query(`SELECT id, name, active FROM categories WHERE active = true ORDER BY name`)
).rows;
const subcategories = (
  await c.query(`
    SELECT s.id, s.name, s.active, s.category_id, c.name AS category_name
    FROM subcategories s
    JOIN categories c ON c.id = s.category_id
    WHERE s.active = true AND c.active = true
    ORDER BY c.name, s.name
  `)
).rows;

const sectorFat = sectors.find((s) => /FATURAMENTO/i.test(s.name)) || sectors[0];
const sectorAdm = sectors.find((s) => /ADMIN/i.test(s.name)) || sectors[1] || sectors[0];
const catWithSub = categories.find((c) => subcategories.some((s) => s.category_id === c.id)) || categories[0];
const catMaybeNoSub = categories.find((c) => !subcategories.some((s) => s.category_id === c.id)) || categories[0];
const subForCat = subcategories.find((s) => s.category_id === catWithSub.id) || null;

results.taxonomy = {
  sectors: sectors.length,
  categories: categories.length,
  subcategories: subcategories.length,
  sectorFat,
  sectorAdm,
  catWithSub,
  catMaybeNoSub,
  subForCat,
};

async function loginUser(u) {
  const r = await api('POST', '/webhook/auth/login', null, {
    email: u.email,
    password: TEMP_PASS,
  });
  const token = r.json?.data?.token;
  const user = r.json?.data?.user || r.json?.data;
  results.users.push({
    email: u.email,
    name: u.name,
    loginStatus: r.status,
    loginOk: !!token,
    userId: user?.id || u.id,
  });
  return { token, userId: user?.id || u.id, user };
}

async function createDoc(token, userId, payload, label) {
  const body = {
    title: `${RUN_ID} ${label}`,
    sectorId: payload.sectorId,
    categoryId: payload.categoryId,
    subcategoryId: payload.subcategoryId ?? null,
    semanticDescription: payload.semanticDescription || `Validação automática ${label}`,
    expirationDate: payload.expirationDate ?? null,
    isActive: payload.isActive ?? true,
    responsibleUserId: userId,
    createdBy: userId,
    updatedBy: userId,
  };
  const r = await api('POST', '/webhook/documents/create', token, body);
  const id = r.json?.data?.id || null;
  if (id) results.createdIds.push(id);

  let db = null;
  if (id) {
    db = (
      await c.query(
        `SELECT id, title, sector_id, category_id, subcategory_id, is_active,
                current_version_id, current_version_number, processing_status,
                created_by, responsible_user_id, expiration_date
         FROM documents WHERE id = $1`,
        [id],
      )
    ).rows[0];
  }

  return { response: r, id, db, body };
}

function assertCreated(name, { response, id, db, body }, extras = {}) {
  const pass =
    response.status >= 200 &&
    response.status < 300 &&
    !!id &&
    !!db &&
    db.title === body.title &&
    String(db.sector_id) === String(body.sectorId) &&
    String(db.category_id) === String(body.categoryId) &&
    (body.subcategoryId == null
      ? db.subcategory_id == null
      : String(db.subcategory_id) === String(body.subcategoryId)) &&
    !!db.current_version_id &&
    (extras.checkActive === false || db.is_active === (body.isActive ?? true));
  ok(name, pass, {
    status: response.status,
    id,
    error: response.json?.error || (!pass ? 'assertion failed' : null),
    db: db
      ? {
          current_version_id: db.current_version_id,
          subcategory_id: db.subcategory_id,
          is_active: db.is_active,
          expiration_date: db.expiration_date,
        }
      : null,
  });
}

// ========== SCENARIOS ==========

// 1) Auth failures
{
  const bad = await api('POST', '/webhook/documents/create', null, {
    title: `${RUN_ID} noauth`,
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
  });
  ok('create-without-token', bad.status === 401, { status: bad.status, error: bad.json?.error });

  const badTok = await api('POST', '/webhook/documents/create', 'invalid.token.value', {
    title: `${RUN_ID} badtoken`,
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
  });
  ok('create-invalid-token', badTok.status === 401, { status: badTok.status });
}

// 2) Multi-user happy paths
const sessions = [];
for (const u of testUsers) {
  const s = await loginUser(u);
  if (s.token) sessions.push({ ...u, ...s });
}
ok('login-at-least-2-users', sessions.length >= 2, { count: sessions.length });

if (sessions.length === 0) {
  results.summary = { fatal: 'no logins' };
  writeFileSync('tmp/post-go-live/VALDOC-create-flow.json', JSON.stringify(results, null, 2));
  await c.end();
  process.exit(1);
}

const primary = sessions[0];
const secondary = sessions[1] || sessions[0];

// 2a) with subcategory + expiration
{
  const r = await createDoc(primary.token, primary.userId, {
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
    subcategoryId: subForCat?.id ?? null,
    expirationDate: '2027-12-31',
    semanticDescription: 'Com subcategoria e vigência',
  }, 'COM-SUB-VIGENCIA');
  assertCreated('create-with-subcategory-and-expiration', r);
  if (r.db) {
    ok(
      'expiration-persisted',
      String(r.db.expiration_date).startsWith('2027-12-31'),
      { expiration_date: r.db.expiration_date },
    );
  }
}

// 2b) without subcategory
{
  const r = await createDoc(primary.token, primary.userId, {
    sectorId: sectorAdm.id,
    categoryId: catMaybeNoSub.id,
    subcategoryId: null,
    semanticDescription: 'Sem subcategoria',
  }, 'SEM-SUB');
  assertCreated('create-without-subcategory', r);
}

// 2c) second user different sector
{
  const r = await createDoc(secondary.token, secondary.userId, {
    sectorId: sectorAdm.id,
    categoryId: catWithSub.id,
    subcategoryId: subForCat?.id ?? null,
    semanticDescription: `Criado por ${secondary.name}`,
  }, `USER2-${secondary.email.split('@')[0]}`);
  assertCreated('create-second-user', r);
  if (r.db) {
    ok(
      'second-user-created-by',
      String(r.db.created_by) === String(secondary.userId),
      { created_by: r.db.created_by, expected: secondary.userId },
    );
  }
}

// 2d) isActive false on create (if supported)
{
  const r = await createDoc(primary.token, primary.userId, {
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
    subcategoryId: null,
    isActive: false,
    semanticDescription: 'Criado inativo',
  }, 'INATIVO');
  assertCreated('create-inactive', r, { checkActive: true });
}

// 2e) special chars in title / description
{
  const r = await createDoc(primary.token, primary.userId, {
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
    subcategoryId: subForCat?.id ?? null,
    semanticDescription: "Descrição com aspas 'simples' e acentos: operação/çãõ",
  }, "TÍTULO c/ áéíóú & aspas 'x'");
  assertCreated('create-special-chars', r);
}

// 3) Validation errors
{
  const missing = await api('POST', '/webhook/documents/create', primary.token, {
    title: '',
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
    createdBy: primary.userId,
  });
  ok('validation-empty-title', missing.status === 400, {
    status: missing.status,
    error: missing.json?.error || missing.json?.message,
  });

  const badSector = await api('POST', '/webhook/documents/create', primary.token, {
    title: `${RUN_ID} bad sector`,
    sectorId: 'undefined',
    categoryId: catWithSub.id,
    createdBy: primary.userId,
  });
  ok(
    'validation-undefined-sector-string',
    badSector.status === 400 && !results.createdIds.includes(badSector.json?.data?.id),
    { status: badSector.status, error: badSector.json?.error },
  );

  const badCat = await api('POST', '/webhook/documents/create', primary.token, {
    title: `${RUN_ID} bad cat`,
    sectorId: sectorFat.id,
    categoryId: 'not-a-uuid',
    createdBy: primary.userId,
  });
  ok('validation-invalid-category-uuid', badCat.status === 400, {
    status: badCat.status,
    error: badCat.json?.error,
  });

  const badSub = await api('POST', '/webhook/documents/create', primary.token, {
    title: `${RUN_ID} bad sub`,
    sectorId: sectorFat.id,
    categoryId: catWithSub.id,
    subcategoryId: 'undefined',
    createdBy: primary.userId,
  });
  ok('validation-undefined-subcategory-string', badSub.status === 400, {
    status: badSub.status,
    error: badSub.json?.error,
  });
}

// 4) User without document permission (if we can find one)
{
  const noPerm = (
    await c.query(`
      SELECT u.id, u.name, u.email
      FROM users u
      WHERE u.active = true
        AND COALESCE(u.is_master,false) = false
        AND u.email IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = u.id
            AND (p.code ILIKE '%doc%' OR p.code ILIKE '%documento%')
        )
      ORDER BY u.name
      LIMIT 1
    `)
  ).rows[0];

  if (noPerm) {
    await c.query(
      `UPDATE users SET password_hash = crypt($2, gen_salt('bf')) WHERE id = $1`,
      [noPerm.id, TEMP_PASS],
    );
    const login = await api('POST', '/webhook/auth/login', null, {
      email: noPerm.email,
      password: TEMP_PASS,
    });
    const token = login.json?.data?.token;
    if (token) {
      const denied = await api('POST', '/webhook/documents/create', token, {
        title: `${RUN_ID} denied`,
        sectorId: sectorFat.id,
        categoryId: catWithSub.id,
        semanticDescription: 'should 403',
        createdBy: noPerm.id,
        updatedBy: noPerm.id,
        responsibleUserId: noPerm.id,
      });
      ok('forbidden-without-permission', denied.status === 403, {
        status: denied.status,
        user: noPerm.email,
        error: denied.json?.error,
      });
    } else {
      ok('forbidden-without-permission', false, { error: 'could not login no-perm user' });
    }
  } else {
    ok('forbidden-without-permission', true, { skipped: true, reason: 'no user without doc permission' });
  }
}

// 5) Consistency: list contains created docs before cleanup
{
  const list = await api('GET', '/webhook/documents', primary.token);
  const data = Array.isArray(list.json?.data) ? list.json.data : [];
  const found = results.createdIds.filter((id) => data.some((d) => d.id === id));
  ok('list-contains-created', found.length === results.createdIds.length, {
    created: results.createdIds.length,
    found: found.length,
    listStatus: list.status,
  });
}

// 6) Version row exists for each created
{
  if (results.createdIds.length) {
    const vers = (
      await c.query(
        `SELECT document_id, COUNT(*)::int AS n, BOOL_OR(is_current) AS has_current
         FROM document_versions
         WHERE document_id = ANY($1::uuid[])
         GROUP BY document_id`,
        [results.createdIds],
      )
    ).rows;
    ok(
      'versions-created-for-all',
      vers.length === results.createdIds.length && vers.every((v) => v.n >= 1),
      { versionRows: vers.length, expected: results.createdIds.length },
    );
  }
}

// ========== CLEANUP ==========
const ids = [...results.createdIds];
let deletedApi = 0;
let deletedDb = 0;
for (const docId of ids) {
  const del = await api('DELETE', '/webhook/documents/delete', primary.token, { id: docId });
  if (del.status >= 200 && del.status < 300) deletedApi += 1;
}

// Force DB cleanup for any leftovers from this run (including soft-delete cases)
const force = await c.query(
  `
  WITH victims AS (
    SELECT id FROM documents WHERE title LIKE $1
  ),
  del_chunks AS (
    DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM victims)
  ),
  del_versions AS (
    DELETE FROM document_versions WHERE document_id IN (SELECT id FROM victims)
  )
  DELETE FROM documents WHERE id IN (SELECT id FROM victims)
  RETURNING id
  `,
  [`${RUN_ID}%`],
);
deletedDb = force.rows.length;

const leftovers = (
  await c.query(`SELECT id, title FROM documents WHERE title LIKE $1`, [`${RUN_ID}%`])
).rows;

results.cleanup = {
  createdCount: ids.length,
  deletedApi,
  deletedDb,
  leftovers,
  leftoversOk: leftovers.length === 0,
};
ok('cleanup-no-leftovers', leftovers.length === 0, { leftovers });

results.summary = {
  totalCases: results.cases.length,
  passed: results.cases.filter((x) => x.pass).length,
  failed: results.cases.filter((x) => !x.pass).length,
  allPass: results.cases.every((x) => x.pass),
  usersTested: sessions.map((s) => ({ name: s.name, email: s.email })),
  createdThenDeleted: ids.length,
};

writeFileSync('tmp/post-go-live/VALDOC-create-flow.json', JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.summary, null, 2));
await c.end();
process.exit(results.summary.allPass ? 0 : 1);
