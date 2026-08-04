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
const token = login.data.token;
const auth = { Authorization: `Bearer ${token}` };

for (const p of [
  '/webhook/system/ai-response-quality/detail',
  '/webhook/system/ai-response-quality',
  '/webhook/system/health',
]) {
  const r = await fetch(`${BASE}${p}`, { headers: auth });
  const t = await r.text();
  console.log('\n', p, r.status, t.slice(0, 500));
}
