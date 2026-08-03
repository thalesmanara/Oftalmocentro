#!/usr/bin/env node
/**
 * Baseline before Etapa 21 retrieval consolidation.
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
const token = login?.data?.accessToken || login?.data?.token;

async function ask(question) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/webhook/ai/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ question }),
  });
  const json = await res.json().catch(() => null);
  return {
    status: res.status,
    durationMs: Date.now() - t0,
    answerLen: String(json?.data?.answer || '').length,
    sourcesCount: (json?.data?.sources || []).length,
    retrievalMeta: json?.data?.retrievalMeta || null,
    classification: json?.data?.classification || null,
    answerPreview: String(json?.data?.answer || '').slice(0, 180),
    sourceTitles: (json?.data?.sources || []).map((s) => s.documentTitle).slice(0, 5),
  };
}

const cases = [
  { id: 'planilha', q: 'Qual a relação de funcionários do quadro de enfermagem?' },
  { id: 'semantica', q: 'Quais documentos tratam de biometria e cálculo de lentes intraoculares?' },
  { id: 'negativo', q: 'Qual o CPF do paciente fictício XYZ999 inexistente no acervo?' },
];

const out = { at: new Date().toISOString(), results: {} };
for (const c of cases) {
  console.log('baseline', c.id);
  out.results[c.id] = await ask(c.q);
}
writeFileSync(new URL('./_e21-baseline-before.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
