import { writeFileSync } from 'fs';

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
console.log('target', d.id, d.isActive);

const payload = {
  id: d.id,
  title: d.title,
  sectorId: d.sectorId,
  categoryId: d.categoryId,
  subcategoryId: d.subcategoryId || null,
  semanticDescription: d.semanticDescription || null,
  expirationDate: d.expirationDate || null,
  isActive: false,
};

const off = await fetch(`${BASE}/webhook/documents/update`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const text = await off.text();
console.log('status', off.status, 'len', text.length, 'ctype', off.headers.get('content-type'));
console.log('body', text.slice(0, 800));
writeFileSync('tmp/post-go-live/put-doc-raw.txt', text);

// check DB via list
const docs2 = await (
  await fetch(`${BASE}/webhook/documents`, { headers: { Authorization: `Bearer ${token}` } })
).json();
const d2 = docs2.data.find((x) => x.id === d.id);
console.log('list after', d2?.isActive);

// restore true regardless
payload.isActive = true;
const on = await fetch(`${BASE}/webhook/documents/update`, {
  method: 'PUT',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
const t2 = await on.text();
console.log('restore status', on.status, 'len', t2.length, t2.slice(0, 200));
