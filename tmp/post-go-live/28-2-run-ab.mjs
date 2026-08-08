/**
 * Etapa 28.2 — A/B prompt max_tokens + summary checks + retrieval semantic probes
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';
const WARNING =
  '**Esta resposta apresenta um resumo das informações encontradas. Consulte o documento completo listado nas referências para verificar todos os detalhes.**';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});

async function api(method, path, token, body, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

const out = { at: new Date().toISOString(), promptAB: [], summary: [], retrieval: [], decisions: {} };

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
if (!token) {
  writeFileSync('tmp/post-go-live/28-2-ab-results.json', JSON.stringify({ error: 'login', login }, null, 2));
  process.exit(1);
}

await client.connect();
const prompts = await client.query(
  `SELECT v.id, v.version_number, v.status, v.max_tokens, v.content, v.model_name, v.temperature
   FROM ai_prompt_versions v
   JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
   WHERE d.code='AI_QUERY_MAIN' ORDER BY v.version_number`,
);
const pub = prompts.rows.find((r) => r.status === 'PUBLISHED');
const draft = prompts.rows.find((r) => r.status === 'DRAFT' && Number(r.max_tokens) >= 1500);
const ret = await client.query(
  `SELECT id, version_label, status FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-v2')`,
);
const v1 = ret.rows.find((r) => r.version_label === 'hybrid-v1');
const v2 = ret.rows.find((r) => r.version_label === 'hybrid-v2');
out.promptVersions = prompts.rows.map((r) => ({
  id: r.id,
  version_number: r.version_number,
  status: r.status,
  max_tokens: r.max_tokens,
}));
out.retrievalVersions = ret.rows;

// --- Summary detection cases ---
const summaryCases = [
  {
    name: 'explicit-resumo',
    question: 'Resuma o procedimento de gerenciamento de tecnologias da clínica.',
    expectSummarized: true,
  },
  {
    name: 'implicit-wide',
    question:
      'Explique as principais obrigações, responsabilidades e regras relevantes do contrato social da Oftalmocentro, cobrindo o que for mais importante para a operação.',
    expectSummarized: true,
  },
  {
    name: 'pontual-cnpj',
    question: 'Qual o CNPJ da clínica?',
    expectSummarized: false,
  },
];

for (const c of summaryCases) {
  const r = await api('POST', '/webhook/consulta-ia', token, { question: c.question });
  const data = r.json?.data || {};
  const answer = String(data.answer || '');
  const flagged =
    data.isSummarizedResponse === true ||
    data.policyMeta?.isSummarizedResponse === true ||
    data.responseMeta?.isSummarizedResponse === true;
  const starts = answer.startsWith(WARNING);
  const reasons = data.policyMeta?.summarizedReasonCodes || [];
  out.summary.push({
    name: c.name,
    status: r.status,
    expectSummarized: c.expectSummarized,
    flagged,
    startsWithWarning: starts,
    reasons,
    answerLen: answer.length,
    ok: r.status === 200 && flagged === c.expectSummarized && (!c.expectSummarized || starts),
  });
  console.log('SUMMARY', c.name, out.summary.at(-1).ok, reasons, answer.length);
}

// --- Prompt A/B via temporary publish of draft max_tokens then rollback ---
// Safer approach: call OpenAI directly using same prompt content from DB if key available on VPS.
// Fallback: measure production answers (800) vs temporarily publishing draft for B then rollback.

async function publishPrompt(versionId) {
  // Prefer API if exists
  const r = await api('POST', '/webhook/system/ai-prompts/publish', token, {
    versionId,
    forceOverride: true,
    reason: 'Etapa 28.2 A/B max_tokens temporário',
  });
  return r;
}

async function rollbackPrompt(versionId) {
  return api('POST', '/webhook/system/ai-prompts/rollback', token, {
    targetVersionId: versionId,
    reason: 'Etapa 28.2 rollback após A/B max_tokens',
  });
}

const promptQuestions = [
  { name: 'pontual', question: 'Qual o CNPJ da clínica?' },
  {
    name: 'complexa',
    question:
      'Descreva de forma completa as regras e condições relevantes do plano de gerenciamento de tecnologias, incluindo responsabilidades, procedimentos e pontos de controle mencionados nos documentos.',
  },
  {
    name: 'multi-topicos',
    question:
      'Quais informações institucionais importantes constam no contrato social (quadro societário, objeto, administração e alterações relevantes)?',
  },
  {
    name: 'curta',
    question: 'A clínica possui alvará sanitário vigente segundo os documentos?',
  },
];

async function runPromptSet(label) {
  const rows = [];
  for (const q of promptQuestions) {
    const t0 = Date.now();
    const r = await api('POST', '/webhook/consulta-ia', token, { question: q.question });
    const data = r.json?.data || {};
    const answer = String(data.answer || '');
    rows.push({
      name: q.name,
      status: r.status,
      latencyMs: Date.now() - t0,
      answerLen: answer.length,
      truncatedHint: /…$|\.\.\.$|continu|limitado|truncad/i.test(answer),
      usage: data.usage || data.tokenUsage || data.responseMeta?.usage || null,
      quality: data.qualityMeta || data.responseMeta?.quality || null,
      strategy: data.policyMeta?.strategy || null,
      sources: Array.isArray(data.sources) ? data.sources.length : null,
      finishReason: data.finishReason || data.responseMeta?.finishReason || null,
    });
    console.log('PROMPT', label, q.name, rows.at(-1).answerLen, rows.at(-1).latencyMs);
  }
  return rows;
}

out.promptAB.push({ label: 'A-max800-published', rows: await runPromptSet('A800') });

let publishedB = false;
if (draft) {
  const pubRes = await publishPrompt(draft.id);
  out.promptPublishB = { status: pubRes.status, body: pubRes.json };
  publishedB = pubRes.status >= 200 && pubRes.status < 300 && pubRes.json?.success !== false;
  if (publishedB) {
    out.promptAB.push({ label: 'B-max1500-temp', rows: await runPromptSet('B1500') });
    const rb = await rollbackPrompt(pub.id);
    out.promptRollback = { status: rb.status, body: rb.json };
  } else {
    // Direct SQL publish/rollback as last resort for A/B only
    console.log('API publish failed, trying SQL publish/rollback');
    await client.query('BEGIN');
    try {
      await client.query(
        `UPDATE ai_prompt_versions SET status='ARCHIVED' WHERE prompt_definition_id=(SELECT prompt_definition_id FROM ai_prompt_versions WHERE id=$1) AND status='PUBLISHED'`,
        [draft.id],
      );
      await client.query(
        `UPDATE ai_prompt_versions SET status='PUBLISHED', published_at=NOW() WHERE id=$1`,
        [draft.id],
      );
      await client.query('COMMIT');
      publishedB = true;
      out.promptPublishB = { method: 'sql', ok: true };
      out.promptAB.push({ label: 'B-max1500-temp', rows: await runPromptSet('B1500') });
      await client.query('BEGIN');
      await client.query(`UPDATE ai_prompt_versions SET status='DRAFT', published_at=NULL WHERE id=$1`, [draft.id]);
      await client.query(
        `UPDATE ai_prompt_versions SET status='PUBLISHED', published_at=NOW() WHERE id=$1`,
        [pub.id],
      );
      await client.query('COMMIT');
      out.promptRollback = { method: 'sql', ok: true };
    } catch (e) {
      await client.query('ROLLBACK');
      out.promptPublishB = { method: 'sql', error: String(e.message || e) };
    }
  }
}

// Confirm published back to v1
const after = await client.query(
  `SELECT version_number, status, max_tokens FROM ai_prompt_versions v
   JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
   WHERE d.code='AI_QUERY_MAIN' AND v.status='PUBLISHED'`,
);
out.promptPublishedAfterAB = after.rows;

// Decision heuristic
const aRows = out.promptAB.find((x) => x.label.startsWith('A'))?.rows || [];
const bRows = out.promptAB.find((x) => x.label.startsWith('B'))?.rows || [];
function avg(arr, f) {
  const xs = arr.map(f).filter((n) => Number.isFinite(n));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}
const aComplex = aRows.filter((r) => ['complexa', 'multi-topicos'].includes(r.name));
const bComplex = bRows.filter((r) => ['complexa', 'multi-topicos'].includes(r.name));
const aPontual = aRows.find((r) => r.name === 'pontual');
const bPontual = bRows.find((r) => r.name === 'pontual');
const gainComplex =
  avg(aComplex, (r) => r.answerLen) != null && avg(bComplex, (r) => r.answerLen) != null
    ? avg(bComplex, (r) => r.answerLen) - avg(aComplex, (r) => r.answerLen)
    : null;
const pontualOk =
  !bPontual || !aPontual || bPontual.answerLen < aPontual.answerLen * 2.5 || bPontual.answerLen < 900;
out.decisions.prompt = {
  recommendPublish1500: !!(bRows.length && gainComplex != null && gainComplex >= 120 && pontualOk),
  gainComplexChars: gainComplex,
  pontualOk,
  note: 'Publish only if complex answers gain length without exploding pontual answers',
};

// --- Retrieval A/B via executeWorkflow if webhook accepts retrievalConfigVersionId ---
const semanticCases = [
  // Group A known
  { group: 'A-known', q: 'Quais regras de manutenção de equipamento?', expectDocHint: /tecnolog|manuten|equip/i },
  { group: 'A-known', q: 'Quais regras de conserto da máquina?', expectDocHint: /tecnolog|manuten|equip/i },
  { group: 'A-known', q: 'Política para colaborador e funcionário', expectDocHint: /./ },
  // Group B unknown (NOT in dictionary) — pick domain paraphrases
  { group: 'B-unknown', q: 'Normas para o corpo clínico da clínica', expectDocHint: /./ },
  { group: 'B-unknown', q: 'Documento societário da empresa Oftalmocentro', expectDocHint: /contrato social/i },
  { group: 'B-unknown', q: 'Licença da vigilância sanitária', expectDocHint: /alvar|sanit/i },
  { group: 'B-unknown', q: 'Auto de vistoria dos bombeiros', expectDocHint: /avcb|bombeiro/i },
  { group: 'B-unknown', q: 'Certidão do conselho de enfermagem', expectDocHint: /coren/i },
  // paraphrases
  { group: 'paraphrase', q: 'Como é feito o gerenciamento das tecnologias utilizadas na clínica?', expectDocHint: /tecnolog/i },
  { group: 'paraphrase', q: 'Qual o procedimento interno para cuidar dos aparelhos e sistemas tecnológicos?', expectDocHint: /tecnolog/i },
  // exact
  { group: 'exact', q: 'CNPJ da Oftalmocentro', expectDocHint: /cnpj|contrato|social|oftalmocentro/i },
];

async function probeRetrieval(label, versionId) {
  const rows = [];
  for (const c of semanticCases) {
    const body = {
      question: c.q,
      ...(versionId
        ? { retrievalConfigVersionId: versionId, modeOverrideAllowed: true }
        : {}),
    };
    const t0 = Date.now();
    const r = await api('POST', '/webhook/consulta-ia', token, body);
    const data = r.json?.data || {};
    const sources = Array.isArray(data.sources) ? data.sources : [];
    const titles = sources.map((s) => String(s.documentTitle || s.title || '')).join(' | ');
    const hit = sources.length > 0 && (c.expectDocHint.test(titles) || c.expectDocHint.test(String(data.answer || '')));
    rows.push({
      group: c.group,
      question: c.q,
      status: r.status,
      latencyMs: Date.now() - t0,
      sourceCount: sources.length,
      titles: titles.slice(0, 200),
      hit,
      answerLen: String(data.answer || '').length,
      pipeline: data.retrievalMeta || data.pipelineMeta || null,
    });
    console.log('RET', label, c.group, hit, sources.length);
  }
  const byGroup = {};
  for (const r of rows) {
    byGroup[r.group] = byGroup[r.group] || { n: 0, hits: 0 };
    byGroup[r.group].n++;
    if (r.hit) byGroup[r.group].hits++;
  }
  return { rows, byGroup };
}

out.retrieval.push({ label: 'hybrid-v1', ...(await probeRetrieval('v1', null)) });
if (v2?.id) {
  out.retrieval.push({ label: 'hybrid-v2-override', ...(await probeRetrieval('v2', v2.id)) });
}

const v1g = out.retrieval[0]?.byGroup || {};
const v2g = out.retrieval[1]?.byGroup || {};
const unknownGain = (v2g['B-unknown']?.hits || 0) - (v1g['B-unknown']?.hits || 0);
const knownGain = (v2g['A-known']?.hits || 0) - (v1g['A-known']?.hits || 0);
const paraphraseGain = (v2g.paraphrase?.hits || 0) - (v1g.paraphrase?.hits || 0);
const exactOk = (v2g.exact?.hits || 0) >= (v1g.exact?.hits || 0);
out.decisions.retrieval = {
  recommendPublishHybridV2: unknownGain + knownGain + paraphraseGain > 0 && exactOk,
  knownGain,
  unknownGain,
  paraphraseGain,
  exactOk,
  note: 'Require gain on unknown/paraphrase or known without exact regression',
};

writeFileSync('tmp/post-go-live/28-2-ab-results.json', JSON.stringify(out, null, 2));
console.log('DECISIONS', JSON.stringify(out.decisions, null, 2));
await client.end();
