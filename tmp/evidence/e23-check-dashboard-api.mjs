const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json();
const token =
  login?.data?.accessToken || login?.data?.token || login?.response?.data?.accessToken;
console.log('token', !!token);

const paths = [
  '/webhook/documents',
  '/webhook/users',
  '/webhook/categories',
  '/webhook/sectors',
  '/webhook/permissions',
  '/webhook/settings',
  '/webhook/system/health',
];

for (const p of paths) {
  const r = await fetch(`${BASE}${p}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const buf = await r.arrayBuffer();
  const text = new TextDecoder().decode(buf);
  console.log(
    '\n===',
    p,
    'status',
    r.status,
    'len',
    buf.byteLength,
    'ct',
    r.headers.get('content-type'),
  );
  console.log(text.slice(0, 400) || '(empty)');
  if (text) {
    try {
      const j = JSON.parse(text);
      console.log('topKeys', Object.keys(j), 'hasSuccess', 'success' in j);
    } catch (e) {
      console.log('not json', e.message);
    }
  }
}
