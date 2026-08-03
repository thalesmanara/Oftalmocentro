#!/usr/bin/env node
/** Smoke + baseline after Etapa 21 pipeline refactor */
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const WEBHOOK = `${BASE}/webhook/consulta-ia`;

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
if (!token) {
  console.error('login failed', login);
  process.exit(1);
}

const cases = [
  { id: 'planilha', question: 'Qual a relação de funcionários do quadro de enfermagem?' },
  { id: 'semantica', question: 'Quais documentos tratam de biometria e cálculo de lentes intraoculares?' },
  { id: 'negativo', question: 'Qual o CPF do paciente fictício XYZ999 inexistente no acervo?' },
  { id: 'exata', question: 'Qual o valor do salário base na tabela salarial vigente?' },
];

const results = [];
for (const c of cases) {
  const t0 = Date.now();
  try {
    const res = await fetch(WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: JSON.stringify({ question: c.question }),
    });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 800) };
    }
    const data = body.data || body;
    const meta = data.retrievalMeta || null;
    results.push({
      id: c.id,
      status: res.status,
      ms: Date.now() - t0,
      hasAnswer: !!String(data.answer || '').trim(),
      answerPreview: String(data.answer || '').slice(0, 180),
      sourcesCount: (data.sources || []).length,
      sourceTitles: (data.sources || []).map((s) => s.document || s.documentTitle).slice(0, 5),
      sourceKeys: data.sources?.[0] ? Object.keys(data.sources[0]) : [],
      retrievalMeta: meta
        ? {
            mode: meta.mode,
            configVersion: meta.configVersion,
            rankingVersion: meta.rankingVersion,
            candidateCount: meta.candidateCount,
            deduplicatedCount: meta.deduplicatedCount,
            selectedCount: meta.selectedCount,
            fallbackUsed: meta.fallbackUsed,
            rankedDocumentIds: (meta.rankedDocumentIds || []).slice(0, 5),
            rankedChunkIds: (meta.rankedChunkIds || []).slice(0, 5),
            sourceDocumentIds: (meta.sourceDocumentIds || []).slice(0, 5),
            retrievalLatencyMs: meta.retrievalLatencyMs,
            textLatencyMs: meta.textLatencyMs,
            vectorLatencyMs: meta.vectorLatencyMs,
            rerankLatencyMs: meta.rerankLatencyMs,
          }
        : null,
      leakedChunk: JSON.stringify(body).includes('chunkId') || JSON.stringify(body).includes('vectorScore'),
      error: body.message || body.error || null,
    });
    console.log(c.id, res.status, Date.now() - t0 + 'ms', meta?.mode, meta?.selectedCount);
  } catch (e) {
    results.push({ id: c.id, error: String(e.message || e), ms: Date.now() - t0 });
    console.error(c.id, e);
  }
}

writeFileSync(new URL('./_e21-smoke-after.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
