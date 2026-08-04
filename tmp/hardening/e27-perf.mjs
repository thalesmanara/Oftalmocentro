#!/usr/bin/env node
/**
 * Etapa 27 — light performance bench + health snapshot
 */
import { writeFileSync } from 'fs';

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
const auth = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

function pct(sorted, p) {
  if (!sorted.length) return null;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

async function time(fn) {
  const t0 = Date.now();
  const result = await fn();
  return { ms: Date.now() - t0, result };
}

const samples = { health: [], docs: [], consulta: [] };

for (let i = 0; i < 5; i++) {
  samples.health.push(
    (
      await time(async () => {
        const r = await fetch(`${BASE}/webhook/system/health`, { headers: auth });
        return r.status;
      })
    ).ms,
  );
  samples.docs.push(
    (
      await time(async () => {
        const r = await fetch(`${BASE}/webhook/documents`, { headers: auth });
        return r.status;
      })
    ).ms,
  );
}

for (let i = 0; i < 3; i++) {
  samples.consulta.push(
    (
      await time(async () => {
        const r = await fetch(`${BASE}/webhook/consulta-ia`, {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({
            question: 'Qual o valor do contrato de locação do estacionamento?',
          }),
        });
        return r.status;
      })
    ).ms,
  );
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / (s.length || 1);
  return {
    n: s.length,
    avg: Math.round(avg),
    p50: pct(s, 50),
    p90: pct(s, 90),
    p99: pct(s, 99),
    min: s[0],
    max: s[s.length - 1],
  };
}

const healthJ = await (await fetch(`${BASE}/webhook/system/health`, { headers: auth })).json();
const hEnv = healthJ.success != null ? healthJ : healthJ.response;
const components = Object.keys(hEnv?.data?.components || {});

const report = {
  at: new Date().toISOString(),
  healthComponents: components,
  latencyMs: {
    health: stats(samples.health),
    documentsList: stats(samples.docs),
    consultaIA: stats(samples.consulta),
  },
  note: 'Bench amostral (não carga). OCR/upload/backup não executados em destrutivo nesta rodada.',
};

writeFileSync(new URL('./_e27-perf.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
