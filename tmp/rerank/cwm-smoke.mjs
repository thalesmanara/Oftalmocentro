#!/usr/bin/env node
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
const token = login?.data?.accessToken || login?.data?.token || login?.data?.token;

async function ask(question, extra = {}) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, ...extra }),
  });
  const json = await res.json().catch(() => null);
  const data = json?.data || json;
  return {
    status: res.status,
    ms: Date.now() - t0,
    answerPreview: String(data?.answer || '').slice(0, 160),
    sources: (data?.sources || []).length,
    retrievalMode: data?.retrievalMeta?.mode,
    retrievalVersion: data?.retrievalMeta?.configVersion,
    contextMeta: data?.contextMeta || null,
    leaked: JSON.stringify(data || {}).includes('chunkId') && JSON.stringify(data?.sources || []).includes('chunkId'),
    error: json?.error || json?.message || null,
  };
}

const budgetId = '7587c86b-8db3-44c0-9881-1e996abda89a';
const out = {
  planilha: await ask('Qual a relação de funcionários do quadro de enfermagem?'),
  semantica: await ask('Quais documentos tratam de biometria e cálculo de lentes intraoculares?'),
  negativo: await ask('Qual o CPF do paciente fictício XYZ999 inexistente no acervo?'),
  budgetOverride: await ask('Quais documentos tratam de biometria?', {
    contextConfigVersionId: budgetId,
    contextConfigOverrideAllowed: true,
  }),
};
writeFileSync(new URL('./_cwm-smoke.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
