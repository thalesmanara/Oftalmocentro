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
const health = await (
  await fetch(`${BASE}/webhook/system/health`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json();
console.log('keys', Object.keys(health.data?.components || {}));
console.log('responseQuality', health.data?.components?.responseQuality);
console.log('evidenceLayer', health.data?.components?.evidenceLayer);
