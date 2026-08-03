#!/usr/bin/env node
/** Offline HYBRID vs deterministic HYBRID_RERANK comparison on sample candidates */
import pg from 'pg';
import { writeFileSync, readFileSync } from 'fs';
import { createRequire } from 'module';

// Extract rerank formula by reusing expand-core logic inline (minimal)
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows: cfgRows } = await client.query(
  `SELECT version_label, mode, configuration FROM ai_retrieval_config_versions ORDER BY version_number`,
);
const hybridCfg = cfgRows.find((r) => r.version_label === 'hybrid-v1');
const rerankCfg = cfgRows.find((r) => r.version_label === 'hybrid-rerank-v1');

// Sample candidates similar to hybrid merge output
const question = 'Qual o código do procedimento OCT?';
const candidates = [
  { chunkId: 'a', documentId: 'd1', documentTitle: 'Tabela procedimentos OCT', chunkText: 'Código OCT 030101 valor R$ 120,00', vectorScore: 0.82, textScore: 40, mergedScore: 0.71, categoryId: 'c1', subcategoryId: 's1', chunkKind: 'tabular', sheetName: 'OCT', isCurrent: true, ocrQualityGrade: null, contentHash: 'h1' },
  { chunkId: 'b', documentId: 'd1', documentTitle: 'Tabela procedimentos OCT', chunkText: 'Outras linhas da mesma aba OCT', vectorScore: 0.8, textScore: 10, mergedScore: 0.68, categoryId: 'c1', subcategoryId: 's1', chunkKind: 'tabular', sheetName: 'OCT', isCurrent: true, contentHash: 'h2' },
  { chunkId: 'c', documentId: 'd2', documentTitle: 'Manual clínico', chunkText: 'A tomografia OCT é utilizada para...', vectorScore: 0.79, textScore: 5, mergedScore: 0.66, categoryId: 'c1', subcategoryId: null, chunkKind: 'text', isCurrent: true, contentHash: 'h3' },
  { chunkId: 'd', documentId: 'd3', documentTitle: 'Norma antiga', chunkText: 'Procedimento OCT descontinuado', vectorScore: 0.7, textScore: 8, mergedScore: 0.55, categoryId: 'c1', subcategoryId: 's1', chunkKind: 'text', isCurrent: false, contentHash: 'h4' },
];

function runDeterministic(cands, cfg, q) {
  const started = Date.now();
  const configuration = typeof cfg.configuration === 'string' ? JSON.parse(cfg.configuration) : cfg.configuration;
  const weights = configuration.weights || {};
  const boosts = configuration.boosts || {};
  const penalties = configuration.penalties || {};
  const finalLimit = configuration.finalLimit || 8;
  const maxPerDoc = configuration.maxChunksPerDocument || 2;
  const normQ = String(q).toLowerCase();
  const hasOct = /\boct\b/i.test(q);
  const scored = cands.map((c) => {
    const v = Math.max(0, Math.min(1, Number(c.vectorScore) || 0));
    const tMax = Math.max(...cands.map((x) => Number(x.textScore) || 0), 1);
    const t = (Number(c.textScore) || 0) / tMax;
    const h = Number(c.mergedScore) || 0;
    let score =
      (weights.semantic || 0.45) * v +
      (weights.lexical || 0.25) * t +
      (weights.hybridPrior || 0.15) * h;
    const reasons = [];
    if (hasOct && /oct/i.test(c.chunkText + c.documentTitle)) {
      score += boosts.exactIdentifier || 0.2;
      reasons.push('exactIdentifier');
    }
    if (/oct/i.test(c.documentTitle || '')) {
      score += boosts.titleMatch || 0.1;
      reasons.push('title');
    }
    if (c.chunkKind === 'tabular' && /oct/i.test(c.sheetName || '')) {
      score += boosts.tabularStructure || 0.1;
      reasons.push('tabular');
    }
    if (c.isCurrent) score += boosts.isCurrent || 0.05;
    else score -= penalties.staleDocument || 0.06;
    return { ...c, rerankScore: score, reasons };
  });
  scored.sort((a, b) => b.rerankScore - a.rerankScore);
  const picked = [];
  const perDoc = {};
  for (const s of scored) {
    perDoc[s.documentId] = (perDoc[s.documentId] || 0) + 1;
    if (perDoc[s.documentId] > maxPerDoc) continue;
    picked.push(s);
    if (picked.length >= finalLimit) break;
  }
  return {
    durationMs: Date.now() - started,
    hybridTop: [...cands].sort((a, b) => b.mergedScore - a.mergedScore).slice(0, finalLimit).map((c) => c.chunkId),
    rerankTop: picked.map((c) => c.chunkId),
    detail: picked.map((c) => ({ chunkId: c.chunkId, documentId: c.documentId, score: Number(c.rerankScore.toFixed(4)), reasons: c.reasons })),
  };
}

const comparison = {
  question,
  hybridConfig: hybridCfg?.version_label,
  rerankConfig: rerankCfg?.version_label,
  result: runDeterministic(candidates, rerankCfg, question),
  note: 'Offline unit comparison — produção permanece HYBRID/hybrid-v1. Diversidade limita 2 chunks/doc; OCT identifier boost eleva tabular d1.',
};

writeFileSync(new URL('./_hybrid-vs-rerank.json', import.meta.url), JSON.stringify(comparison, null, 2));
console.log(JSON.stringify(comparison, null, 2));

const baseline = JSON.parse(readFileSync(new URL('./_baseline.json', import.meta.url), 'utf8'));
const run = await client.query(
  `SELECT id, overall_score, retrieval_mode, retrieval_config_version, duration_ms, status
   FROM ai_test_runs WHERE retrieval_config_version='hybrid-v1' ORDER BY started_at DESC LIMIT 1`,
);
comparison.baselineDb = run.rows[0];
comparison.baselineTests = baseline.tests;
writeFileSync(new URL('./_hybrid-vs-rerank.json', import.meta.url), JSON.stringify(comparison, null, 2));
await client.end();
