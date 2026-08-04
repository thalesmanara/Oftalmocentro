/**
 * Extended probe: all governance GETs + classify nested vs ok
 */
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
const token = login?.data?.token;
const auth = { Authorization: `Bearer ${token}`, Accept: 'application/json' };

const paths = [
  '/webhook/system/ai-retrieval/detail',
  '/webhook/system/ai-context/detail',
  '/webhook/system/ai-prompts/detail',
  '/webhook/system/ai-cache/detail',
  '/webhook/system/ai-evidence/detail',
  '/webhook/system/ai-evidence',
  '/webhook/system/ai-cache',
  '/webhook/system/ai-cache/metrics',
  '/webhook/system/ai-cache/entries',
  '/webhook/system/ai-cache/compare',
  '/webhook/system/ai-evidence/compare',
];

for (const p of paths) {
  const r = await fetch(`${BASE}${p}`, { headers: auth });
  const t = await r.text();
  let j = null;
  try {
    j = JSON.parse(t);
  } catch {}
  const top = j ? Object.keys(j) : [];
  const nested = j?.response && 'success' in (j.response || {});
  const ok = j && 'success' in j;
  console.log(
    r.status,
    ok ? 'TOP' : nested ? 'NESTED' : t.length === 0 ? 'EMPTY' : 'OTHER',
    p,
    nested ? `innerSuccess=${j.response.success}` : '',
    !ok && !nested ? t.slice(0, 100) : '',
  );
}
