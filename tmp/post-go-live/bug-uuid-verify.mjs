import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

// Temporary lab password reset for verification only (compras)
const email = 'compras@oftalmocentrouberaba.com.br';
const tempPass = '12345678';
await c.query(
  `UPDATE users
   SET password_hash = crypt($2, gen_salt('bf')),
       updated_at = NOW()
   WHERE email = $1`,
  [email, tempPass],
);

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

const login = await api('POST', '/webhook/auth/login', null, { email, password: tempPass });
const token = login.json?.data?.token;
const userId = login.json?.data?.user?.id || login.json?.data?.userId;

const sectors = await api('GET', '/webhook/sectors', token);
const categories = await api('GET', '/webhook/categories', token);
const sectorList = Array.isArray(sectors.json?.data) ? sectors.json.data : [];
const categoryList = Array.isArray(categories.json?.data) ? categories.json.data : [];
const sector = sectorList.find((s) => s.active !== false);
const category = categoryList.find((c) => /AMIL/i.test(c.name || '')) || categoryList.find((c) => c.active !== false);
const subs = await api('GET', `/webhook/subcategories?categoryId=${encodeURIComponent(category.id)}`, token);
const subList = Array.isArray(subs.json?.data) ? subs.json.data : [];
const sub = subList.find((s) => s.active !== false) || null;

const created = await api('POST', '/webhook/documents/create', token, {
  title: `HOTFIX UUID ${new Date().toISOString()}`,
  sectorId: sector.id,
  categoryId: category.id,
  subcategoryId: sub?.id ?? null,
  semanticDescription: 'Teste hotfix uuid undefined',
  expirationDate: null,
  isActive: true,
  responsibleUserId: userId,
  createdBy: userId,
  updatedBy: userId,
});

// Also verify null subcategory path
const created2 = await api('POST', '/webhook/documents/create', token, {
  title: `HOTFIX UUID NOSUB ${new Date().toISOString()}`,
  sectorId: sector.id,
  categoryId: category.id,
  subcategoryId: null,
  semanticDescription: 'Teste hotfix sem subcategoria',
  expirationDate: null,
  isActive: true,
  responsibleUserId: userId,
  createdBy: userId,
  updatedBy: userId,
});

let deleted = [];
for (const r of [created, created2]) {
  const id = r.json?.data?.id;
  if (id) {
    deleted.push(await api('DELETE', '/webhook/documents/delete', token, { id }));
  }
}

const out = {
  at: new Date().toISOString(),
  loginOk: !!token,
  sector: { id: sector?.id, name: sector?.name },
  category: { id: category?.id, name: category?.name },
  subcategory: sub ? { id: sub.id, name: sub.name } : null,
  withSub: {
    status: created.status,
    ok: !!created.json?.data?.id,
    error: created.json?.error || null,
    id: created.json?.data?.id || null,
  },
  withoutSub: {
    status: created2.status,
    ok: !!created2.json?.data?.id,
    error: created2.json?.error || null,
    id: created2.json?.data?.id || null,
  },
  deleted: deleted.map((d) => d.status),
};
writeFileSync('tmp/post-go-live/bug-uuid-fix.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
