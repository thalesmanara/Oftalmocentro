const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const login = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'compras@oftalmocentrouberaba.com.br', password: '12345678' }),
});
const lj = await login.json();
const token = lj.data.token;
const docs = await (
  await fetch(`${BASE}/webhook/documents`, { headers: { Authorization: `Bearer ${token}` } })
).json();
const d = docs.data.find((x) => x.processingStatus === 'processed') || docs.data[0];

const payload = {
  id: d.id,
  title: d.title,
  sectorId: d.sectorId,
  categoryId: d.categoryId,
  subcategoryId: d.subcategoryId || null,
  semanticDescription: d.semanticDescription || null,
  expirationDate: d.expirationDate || null,
};

const res = await fetch(`${BASE}/webhook/documents/update`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Request-Id': crypto.randomUUID() },
  body: JSON.stringify(payload),
});
const text = await res.text();
console.log('no-isActive put', res.status, text.length, text.slice(0, 500));

// check recent execution via n8n API? skip - check if Execute SQL is broken
// Direct SQL toggle to verify DB column works
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const before = await c.query(`SELECT is_active FROM documents WHERE id=$1`, [d.id]);
console.log('db before', before.rows[0]);
await c.query(`UPDATE documents SET is_active=false, updated_at=NOW() WHERE id=$1`, [d.id]);
const mid = await c.query(`SELECT is_active FROM documents WHERE id=$1`, [d.id]);
console.log('db mid', mid.rows[0]);
const list = await (
  await fetch(`${BASE}/webhook/documents`, { headers: { Authorization: `Bearer ${token}` } })
).json();
console.log('list isActive', list.data.find((x) => x.id === d.id)?.isActive);
await c.query(`UPDATE documents SET is_active=true, updated_at=NOW() WHERE id=$1`, [d.id]);
await c.end();
