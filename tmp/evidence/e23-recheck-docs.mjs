const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const loginRes = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'compras@oftalmocentrouberaba.com.br',
    password: '12345678',
  }),
});
const loginText = await loginRes.text();
console.log('login', loginRes.status, loginText.slice(0, 300));
const login = JSON.parse(loginText);
const token = login?.data?.accessToken || login?.data?.token;
console.log('token', !!token, token?.slice(0, 20));

const r = await fetch(`${BASE}/webhook/documents`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
const t = await r.text();
console.log('docs', r.status, 'len', t.length, t.slice(0, 250));
try {
  const j = JSON.parse(t);
  console.log('success', j.success, 'dataIsArray', Array.isArray(j.data), 'len', j.data?.length);
  if (j.data?.[0]?.id) {
    const v = await fetch(
      `${BASE}/webhook/documents/versions?documentId=${encodeURIComponent(j.data[0].id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const vt = await v.text();
    console.log('versions', v.status, vt.slice(0, 250));
  }
} catch (e) {
  console.log('parse fail', e.message);
}
