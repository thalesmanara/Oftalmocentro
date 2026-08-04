#!/usr/bin/env node
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
for (const [m, p, b] of [
  ['GET', '/webhook/system/ai-evidence', null],
  ['GET', '/webhook/system/ai-evidence/detail', null],
  ['POST', '/webhook/system/ai-evidence/validate', { mode: 'STRUCTURED', configuration: { mode: 'STRUCTURED', enableEvidenceScore: true, enableClassification: true, enableConflictConsolidation: true, enableRedundancyDetection: true, enableRichSources: true, passthroughToCwm: true, minEvidenceScore: 0, redundancyThreshold: 0.92, dropBelowMinScore: false } }],
]) {
  const r = await fetch(`${BASE}${p}`, {
    method: m,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: b ? JSON.stringify(b) : undefined,
  });
  const t = await r.text();
  console.log('\n', m, p, r.status, t.slice(0, 500));
}
const na = await fetch(`${BASE}/webhook/system/ai-evidence`);
console.log('\n noauth', na.status, (await na.text()).slice(0, 200));
