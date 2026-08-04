#!/usr/bin/env node
/** Quick exact-repeat smoke after soft lookup patch */
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
const token = login?.data?.accessToken || login?.data?.token;
async function ask(q) {
  const r = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: q }),
  });
  const j = await r.json();
  const d = j?.data ?? j;
  return {
    status: r.status,
    meta: d?.cacheMeta,
    fromCache: d?.cacheMeta?.answerFromCache,
    cand: d?.cacheMeta?.shadowCandidateFound,
    miss: d?.cacheMeta?.missReason,
    stale: d?.cacheMeta?.staleCandidate,
    saved: d?.cacheMeta?.saved,
    agree: d?.cacheMeta?.shadowAgreement,
  };
}
const q = 'Quem aparece na relação de funcionários em Excel?';
const a = await ask(q);
await new Promise((r) => setTimeout(r, 1000));
const b = await ask(q);
await new Promise((r) => setTimeout(r, 1000));
const c = await ask('  Quem aparece na relacao de funcionarios em excel??? ');
console.log(JSON.stringify({ a, b, c }, null, 2));
