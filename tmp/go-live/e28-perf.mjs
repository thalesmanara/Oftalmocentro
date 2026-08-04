#!/usr/bin/env node
/**
 * Etapa 28 — performance + dataset concorrência moderada (5)
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
function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const avg = Math.round(s.reduce((a, b) => a + b, 0) / (s.length || 1));
  return { n: s.length, avg, p50: pct(s, 50), p90: pct(s, 90), p99: pct(s, 99), min: s[0], max: s[s.length - 1] };
}
async function timed(fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    return { ms: Date.now() - t0, ok: true, status: r };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, error: e.message };
  }
}

const samples = { login: [], health: [], documents: [], consulta: [] };
for (let i = 0; i < 5; i++) {
  samples.health.push(
    (
      await timed(async () => (await fetch(`${BASE}/webhook/system/health`, { headers: auth })).status)
    ).ms,
  );
  samples.documents.push(
    (await timed(async () => (await fetch(`${BASE}/webhook/documents`, { headers: auth })).status)).ms,
  );
}
for (let i = 0; i < 3; i++) {
  samples.consulta.push(
    (
      await timed(async () => {
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

// concurrency 5 consultas
const conc5 = await Promise.all(
  Array.from({ length: 5 }, (_, i) =>
    timed(async () => {
      const r = await fetch(`${BASE}/webhook/consulta-ia`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ question: `Pergunta concorrente ${i + 1}: valor locação estacionamento?` }),
      });
      return r.status;
    }),
  ),
);

const report = {
  at: new Date().toISOString(),
  latencyMs: {
    health: stats(samples.health),
    documents: stats(samples.documents),
    consultaIA: stats(samples.consulta),
  },
  concurrency5: {
    results: conc5,
    okCount: conc5.filter((x) => x.ok && x.status === 200).length,
    avgMs: Math.round(conc5.reduce((a, b) => a + b.ms, 0) / conc5.length),
    maxMs: Math.max(...conc5.map((x) => x.ms)),
  },
  limitsSuggested: {
    maxConcurrentConsultaIA: 5,
    note: 'VPS 1 vCPU — evitar 10+ consultas simultâneas em produção sem scaling',
  },
};

writeFileSync(new URL('./performance-final.json', import.meta.url), JSON.stringify(report, null, 2));
writeFileSync(
  new URL('./performance-final.md', import.meta.url),
  `# Performance Final — Etapa 28

| Endpoint | avg | p50 | p90 | p99 |
|----------|-----|-----|-----|-----|
| Health | ${report.latencyMs.health.avg} | ${report.latencyMs.health.p50} | ${report.latencyMs.health.p90} | ${report.latencyMs.health.p99} |
| Documentos | ${report.latencyMs.documents.avg} | ${report.latencyMs.documents.p50} | ${report.latencyMs.documents.p90} | ${report.latencyMs.documents.p99} |
| Consulta IA | ${report.latencyMs.consultaIA.avg} | ${report.latencyMs.consultaIA.p50} | ${report.latencyMs.consultaIA.p90} | ${report.latencyMs.consultaIA.p99} |

## Concorrência 5

- OK: ${report.concurrency5.okCount}/5
- avg: ${report.concurrency5.avgMs} ms
- max: ${report.concurrency5.maxMs} ms

## Limite operacional sugerido

Máximo **5** consultas IA simultâneas na VPS atual (1 vCPU). Concorrência 10 não executada por segurança.
`,
);
console.log(JSON.stringify(report, null, 2));
