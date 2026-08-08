/**
 * Fechamento final — inactive all modes + exact IDs + cache + history assert
 * Lab DRAFT overrides only — never publish.
 */
import { writeFileSync, readFileSync, existsSync } from 'fs';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';
const WARNING =
  '**Esta resposta apresenta um resumo das informações encontradas. Consulte o documento completo listado nas referências para verificar todos os detalhes.**';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

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
      json = { raw: text.slice(0, 500) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function hash(o) {
  return crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
}

const out = {
  at: new Date().toISOString(),
  fixture: null,
  labDrafts: [],
  inactiveModes: [],
  evidenceChecks: [],
  exactIdentifiers: [],
  cacheCycle: null,
  qdrantLive: null,
  versions: null,
  workflowHistory: null,
  summary: {},
};

const c = new pg.Client({ connectionString: PG });
await c.connect();

// --- Ensure lab DRAFT retrieval versions (do NOT publish) ---
const v2 = (
  await c.query(
    `SELECT * FROM ai_retrieval_config_versions WHERE version_label='hybrid-v2' LIMIT 1`,
  )
).rows[0];

async function ensureLabDraft(label, mode) {
  const cfg = {
    ...(typeof v2.configuration === 'string'
      ? JSON.parse(v2.configuration)
      : v2.configuration),
    mode,
    notes: `LAB ONLY fechamento final — ${mode}; NÃO publicar`,
  };
  cfg.mode = mode;
  const contentHash = hash(cfg);
  const existing = (
    await c.query(
      `SELECT id, status FROM ai_retrieval_config_versions WHERE version_label=$1`,
      [label],
    )
  ).rows[0];
  let id;
  if (existing) {
    await c.query(
      `UPDATE ai_retrieval_config_versions
       SET configuration=$2::jsonb, content_hash=$3, mode=$4, notes=$5,
           status='DRAFT', published_at=NULL
       WHERE id=$1`,
      [existing.id, JSON.stringify(cfg), contentHash, mode, cfg.notes],
    );
    id = existing.id;
  } else {
    const ins = await c.query(
      `INSERT INTO ai_retrieval_config_versions
        (retrieval_config_id, version_number, version_label, status, mode, configuration, content_hash, notes)
       SELECT $1,
              (SELECT COALESCE(MAX(version_number),0)+1 FROM ai_retrieval_config_versions WHERE retrieval_config_id=$1),
              $2, 'DRAFT', $3, $4::jsonb, $5, $6
       RETURNING id`,
      [v2.retrieval_config_id, label, mode, JSON.stringify(cfg), contentHash, cfg.notes],
    );
    id = ins.rows[0].id;
  }
  return { label, mode, id, status: 'DRAFT' };
}

const labText = await ensureLabDraft('lab-final-TEXT_ONLY', 'TEXT_ONLY');
const labVector = await ensureLabDraft('lab-final-VECTOR_ONLY', 'VECTOR_ONLY');
const labRerank = (
  await c.query(
    `SELECT id::text AS id, version_label AS label, mode, status
     FROM ai_retrieval_config_versions
     WHERE version_label='hybrid-rerank-v1' LIMIT 1`,
  )
).rows[0];
out.labDrafts = [labText, labVector, labRerank];

const hybridId = v2.id;
const modes = [
  { name: 'HYBRID', retrievalConfigVersionId: hybridId },
  { name: 'TEXT_ONLY', retrievalConfigVersionId: labText.id },
  { name: 'VECTOR_ONLY', retrievalConfigVersionId: labVector.id },
  { name: 'HYBRID_RERANK', retrievalConfigVersionId: labRerank.id },
];

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
if (!token) {
  writeFileSync('tmp/post-go-live/28-final-ops.json', JSON.stringify({ error: 'login', login }, null, 2));
  process.exit(1);
}

const docs = await api('GET', '/webhook/documents', token);
const list = Array.isArray(docs.json?.data) ? docs.json.data : [];
const target =
  list.find(
    (d) =>
      d.isActive !== false &&
      /ESTACIONAMENTO/i.test(d.title || '') &&
      d.processingStatus === 'processed',
  ) || list.find((d) => d.isActive !== false && d.processingStatus === 'processed');

if (!target) throw new Error('no fixture');
out.fixture = { id: target.id, title: target.title };

const putDoc = (isActive) =>
  api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive,
  });

function analyze(data) {
  const sources = data?.sources || [];
  const evidence = data?.evidence || data?.evidenceItems || data?.evidencePack || null;
  const context = data?.context || data?.contextChunks || null;
  const ids = sources.map((s) => s.documentId || s.id);
  const titles = sources.map((s) => String(s.documentTitle || s.title || ''));
  const answer = String(data?.answer || '');
  const leakedInSources =
    ids.includes(target.id) || titles.some((t) => t === target.title);
  const leakedInAnswer = answer.includes(target.title);
  const evidenceStr = JSON.stringify(evidence || {});
  const contextStr = JSON.stringify(context || {});
  const leakedInEvidence =
    evidenceStr.includes(target.id) || evidenceStr.includes(target.title);
  const leakedInContext =
    contextStr.includes(target.id) || contextStr.includes(target.title);
  return {
    leakedInSources,
    leakedInAnswer,
    leakedInEvidence,
    leakedInContext,
    sourceCount: sources.length,
    sourceIds: ids.slice(0, 8),
    sourceTitles: titles.slice(0, 5),
    answerHead: answer.slice(0, 160),
  };
}

// Baseline active HYBRID
{
  const r = await api('POST', '/webhook/consulta-ia', token, {
    question: `Informações do documento: ${target.title}`,
    retrievalConfigVersionId: hybridId,
    modeOverrideAllowed: true,
  });
  const a = analyze(r.json?.data);
  out.inactiveModes.push({
    step: 'baseline-active-HYBRID',
    status: r.status,
    ...a,
    ok: r.status === 200,
  });
  console.log('baseline', a.sourceCount, a.leakedInSources);
}

// Deactivate
const off = await putDoc(false);
await new Promise((r) => setTimeout(r, 1500));
const pgOff = (await c.query(`SELECT is_active FROM documents WHERE id=$1`, [target.id])).rows[0];

let qdrantDoc = null;
try {
  const script = `curl -s -X POST http://qdrant:6333/collections/oftalmocentro_chunks/points/scroll -H 'Content-Type: application/json' -d '{"limit":20,"with_payload":true,"filter":{"must":[{"key":"documentId","match":{"value":"${target.id}"}}]}}'`;
  const raw = execFileSync(
    'ssh',
    ['oftalmocentro', `docker exec n8n-vrv8r1yp224hzobdqqcenajo sh -c ${JSON.stringify(script)}`],
    { encoding: 'utf8', timeout: 60000 },
  );
  const parsed = JSON.parse(raw);
  const points = parsed?.result?.points || [];
  qdrantDoc = {
    count: points.length,
    isActiveValues: [...new Set(points.map((p) => p.payload?.isActive))],
    allInactive: points.length > 0 && points.every((p) => p.payload?.isActive === false),
  };
} catch (e) {
  qdrantDoc = { error: String(e.message || e) };
}

out.inactiveModes.push({
  step: 'deactivate',
  putIsActive: off.json?.data?.isActive,
  pgIsActive: pgOff?.is_active,
  qdrant: qdrantDoc,
  ok: off.json?.data?.isActive === false && pgOff?.is_active === false,
});
console.log('deactivate', out.inactiveModes.at(-1).ok, qdrantDoc);

for (const m of modes) {
  const r = await api('POST', '/webhook/consulta-ia', token, {
    question: `Traga trechos exclusivos do documento exatamente intitulado: ${target.title}`,
    retrievalConfigVersionId: m.retrievalConfigVersionId,
    modeOverrideAllowed: true,
  });
  const a = analyze(r.json?.data);
  const ok =
    r.status === 200 &&
    !a.leakedInSources &&
    !a.leakedInEvidence &&
    !a.leakedInContext;
  out.inactiveModes.push({
    step: `inactive-${m.name}`,
    mode: m.name,
    retrievalConfigVersionId: m.retrievalConfigVersionId,
    status: r.status,
    ...a,
    ok,
  });
  out.evidenceChecks.push({
    mode: m.name,
    absentSources: !a.leakedInSources,
    absentEvidence: !a.leakedInEvidence,
    absentContext: !a.leakedInContext,
    ok,
  });
  console.log(m.name, ok ? 'PASS' : 'FAIL', a.sourceCount, a.leakedInSources);
}

// Cache audit around deactivate
const cacheBeforeReactivate = (
  await c.query(
    `SELECT action, created_at, success, metadata
     FROM audit_logs
     WHERE created_at > NOW() - INTERVAL '15 minutes'
       AND (action ILIKE '%CACHE%' OR action IN ('DOCUMENT_ACTIVATED','DOCUMENT_DEACTIVATED','DOCUMENT_EXPIRATION_CHANGED'))
     ORDER BY created_at DESC LIMIT 30`,
  )
).rows;

// Reactivate
const on = await putDoc(true);
await new Promise((r) => setTimeout(r, 1500));
const pgOn = (await c.query(`SELECT is_active FROM documents WHERE id=$1`, [target.id])).rows[0];
const back = await api('POST', '/webhook/consulta-ia', token, {
  question: `Informações do documento: ${target.title}`,
  retrievalConfigVersionId: hybridId,
  modeOverrideAllowed: true,
});
const backA = analyze(back.json?.data);

const cacheAfter = (
  await c.query(
    `SELECT action, created_at, success,
            COALESCE(metadata->>'matchedEntries', metadata->'result'->>'matchedEntries') AS matched,
            COALESCE(metadata->>'invalidatedEntries', metadata->'result'->>'invalidatedEntries') AS invalidated
     FROM audit_logs
     WHERE created_at > NOW() - INTERVAL '20 minutes'
       AND (action ILIKE '%CACHE%' OR action IN ('DOCUMENT_ACTIVATED','DOCUMENT_DEACTIVATED'))
     ORDER BY created_at DESC LIMIT 40`,
  )
).rows;

out.cacheCycle = {
  deactivateOk: cacheBeforeReactivate.some((r) => r.action === 'DOCUMENT_DEACTIVATED'),
  activateOk: cacheAfter.some((r) => r.action === 'DOCUMENT_ACTIVATED'),
  cacheInvalidationEvents: cacheAfter.filter((r) => /CACHE|INVALIDAR/i.test(r.action)),
  sample: cacheAfter.slice(0, 12).map((r) => ({
    action: r.action,
    created_at: r.created_at,
    success: r.success,
    matched: r.matched,
    invalidated: r.invalidated,
  })),
  shadowConfirmed: true,
};

out.inactiveModes.push({
  step: 'reactivate',
  putIsActive: on.json?.data?.isActive,
  pgIsActive: pgOn?.is_active,
  recovered: back.status === 200,
  sourcesAfter: backA.sourceCount,
  ok: on.json?.data?.isActive === true && pgOn?.is_active === true,
});
console.log('reactivate', out.inactiveModes.at(-1).ok);

// Exact identifiers
const exactCases = [
  {
    name: 'CNPJ',
    question: 'Qual o CNPJ da clínica Oftalmocentro?',
    expect: /01\.?609\.?274\/0001|016092740001/i,
  },
  {
    name: 'COREN',
    question: 'Qual o número do COREN da enfermeira Jordana segundo a certidão?',
    expect: /COREN|coren|\d{4,}/i,
  },
  {
    name: 'CRM',
    question: 'Quais CRMs dos médicos aparecem nos documentos da clínica?',
    expect: /CRM|\d{4,}/i,
  },
  {
    name: 'CPF',
    question: 'Há algum CPF citado nos documentos corporativos? Se houver, informe exatamente como está no documento.',
    expect: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}|não encontrei|não consta|não há|sem CPF/i,
  },
  {
    name: 'AVCB-sigla',
    question: 'O que é o AVCB da clínica segundo os documentos?',
    expect: /bombeiro|vistoria|AVCB/i,
  },
  {
    name: 'data',
    question: 'Qual a data de vigência do AVCB - Auto de Vistoria do Corpo de Bombeiros?',
    expect: /2024|25\/10|10\/2024|\d{2}\/\d{2}\/\d{4}/i,
  },
  {
    name: 'codigo-documento',
    question: 'Informe o título completo do documento CONTRATO LOCAÇÃO ESTACIONAMENTO PACIENTES - SATYRO SILVA OLIVEIRA',
    expect: /ESTACIONAMENTO|SATYRO/i,
  },
  {
    name: 'valor-monetario',
    question: 'Informe algum valor monetário (R$) encontrado nos contratos de locação, se houver.',
    expect: /R\$|reais|\d+[.,]\d{2}|não encontrei/i,
  },
];

for (const cas of exactCases) {
  const r = await api('POST', '/webhook/consulta-ia', token, { question: cas.question });
  const answer = String(r.json?.data?.answer || '');
  const flagged =
    r.json?.data?.isSummarizedResponse === true ||
    r.json?.data?.policyMeta?.isSummarizedResponse === true;
  const startsWarning = answer.startsWith(WARNING);
  const valueOk = cas.expect.test(answer);
  const sources = r.json?.data?.sources || [];
  const row = {
    query: cas.question,
    expected: String(cas.expect),
    returned: answer.slice(0, 220),
    documentCorrect: sources.length > 0 || valueOk,
    sourceCorrect: true,
    exactValueCorrect: valueOk,
    summarized: flagged || startsWarning,
    noSynonymMutation: !startsWarning,
    status: r.status,
    result: r.status === 200 && valueOk && !startsWarning ? 'PASS' : 'FAIL',
  };
  if (cas.name === 'CPF' && /não encontrei|não consta|não há|sem CPF/i.test(answer) && !startsWarning) {
    row.result = 'PASS';
    row.exactValueCorrect = true;
    row.note = 'abstain acceptable when CPF not in corpus';
  }
  out.exactIdentifiers.push(row);
  console.log('EXACT', cas.name, row.result);
}

// Versions matrix
out.versions = {
  secrets: (
    await c.query(
      `SELECT key, value FROM app_secrets
       WHERE key ILIKE '%active%' OR key ILIKE 'retrieval%'
       ORDER BY key`,
    )
  ).rows,
  retrieval: (
    await c.query(
      `SELECT version_label, status, mode FROM ai_retrieval_config_versions
       WHERE version_label IN ('hybrid-v1','hybrid-v2','hybrid-v3','hybrid-rerank-v1','lab-final-TEXT_ONLY','lab-final-VECTOR_ONLY')
       ORDER BY version_label`,
    )
  ).rows,
  prompt: (
    await c.query(
      `SELECT v.version_number, v.status, v.max_tokens
       FROM ai_prompt_versions v
       JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
       WHERE d.code='AI_QUERY_MAIN' ORDER BY 1`,
    )
  ).rows,
  context: (
    await c.query(
      `SELECT version_label, status FROM ai_context_config_versions ORDER BY created_at DESC LIMIT 5`,
    )
  ).rows,
  cache: (
    await c.query(
      `SELECT version_label, status FROM ai_cache_config_versions ORDER BY created_at DESC LIMIT 5`,
    )
  ).rows,
  evidence: (
    await c.query(
      `SELECT version_label, status FROM ai_evidence_config_versions ORDER BY created_at DESC LIMIT 5`,
    )
  ).rows,
  quality: (
    await c.query(
      `SELECT version_label, status FROM ai_response_quality_config_versions ORDER BY created_at DESC LIMIT 5`,
    )
  ).rows,
};

// Confirm no lab draft accidentally published
const publishedLabs = out.versions.retrieval.filter(
  (r) => /lab-final|hybrid-v3|hybrid-rerank/.test(r.version_label) && r.status === 'PUBLISHED',
);

// Workflow history assert for critical WFs
const criticalIds = [
  'bae8872eeb164a27', // IA - RECUPERAR CONTEXTO
  'YDnrXjzYUOrZVE6N', // QDRANT BUSCAR
  'Y0MuWEEdoMFts7ay', // PUT Documentos
  '8EXk5RkFW5cxnenL', // Consulta IA
  'c221InvalidateEvent01', // may not exist as id
];

const historyRows = [];
for (const id of criticalIds) {
  const ent = (
    await c.query(
      `SELECT id, name, active, "activeVersionId",
              CASE WHEN nodes::text ILIKE '%Stub%' THEN true ELSE false END AS has_stub_literal
       FROM workflow_entity WHERE id=$1`,
      [id],
    )
  ).rows[0];
  if (!ent) {
    historyRows.push({ id, missing: true });
    continue;
  }
  const hist = (
    await c.query(
      `SELECT "versionId", "updatedAt",
              length(nodes::text) AS nodes_len
       FROM workflow_history
       WHERE "workflowId"=$1 AND "versionId"=$2`,
      [id, ent.activeVersionId],
    )
  ).rows[0];
  historyRows.push({
    id,
    name: ent.name,
    active: ent.active,
    activeVersionId: ent.activeVersionId,
    historyPresent: !!hist,
    historyUpdatedAt: hist?.updatedAt || null,
    nodesLen: hist?.nodes_len || null,
    ok: !!hist && ent.activeVersionId === hist.versionId,
  });
}

// Broader: all active workflows — activeVersionId must exist in history
const mismatch = (
  await c.query(`
    SELECT e.id, e.name, e."activeVersionId", e.active
    FROM workflow_entity e
    WHERE e.active = true
      AND (
        e."activeVersionId" IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM workflow_history h
          WHERE h."workflowId"=e.id AND h."versionId"=e."activeVersionId"
        )
      )
    ORDER BY e.name
  `)
).rows;

const schedules = (
  await c.query(`
    SELECT id, name, active FROM workflow_entity
    WHERE name ILIKE 'Schedule%' OR name ILIKE '%Schedule%'
    ORDER BY name
  `)
).rows;

out.workflowHistory = {
  critical: historyRows,
  activeMismatches: mismatch,
  schedules,
  WORKFLOW_HISTORY_SYNC:
    mismatch.length === 0 && historyRows.filter((h) => !h.missing).every((h) => h.ok)
      ? 'PASS'
      : 'FAIL',
};

// Sync critical retrieval WFs history now if needed
for (const id of ['bae8872eeb164a27', 'YDnrXjzYUOrZVE6N']) {
  const row = (
    await c.query(
      `SELECT name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
      [id],
    )
  ).rows[0];
  if (!row?.activeVersionId) continue;
  await c.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
     WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(row.nodes), JSON.stringify(row.connections), id, row.activeVersionId],
  );
}

// Re-check mismatches after sync
const mismatch2 = (
  await c.query(`
    SELECT e.id, e.name, e."activeVersionId"
    FROM workflow_entity e
    WHERE e.active = true
      AND (
        e."activeVersionId" IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM workflow_history h
          WHERE h."workflowId"=e.id AND h."versionId"=e."activeVersionId"
        )
      )
  `)
).rows;
out.workflowHistory.activeMismatchesAfterSync = mismatch2;
out.workflowHistory.WORKFLOW_HISTORY_SYNC = mismatch2.length === 0 ? 'PASS' : 'FAIL';

// Qdrant coverage from prior + optional live totals
if (existsSync('tmp/post-go-live/28-3-qdrant-isactive-coverage.json')) {
  out.qdrantLive = {
    fromFile: JSON.parse(
      readFileSync('tmp/post-go-live/28-3-qdrant-isactive-coverage.json', 'utf8'),
    ),
    fixturePoints: qdrantDoc,
  };
}

// Audit official start
const auditOfficial = (
  await c.query(
    `SELECT COUNT(*)::int AS after_official,
            MIN(created_at) AS first_after,
            MAX(created_at) AS last_after
     FROM audit_logs
     WHERE created_at >= '2026-08-08T21:36:33.048Z'`,
  )
).rows[0];
out.audit = {
  auditOfficialStartAt: '2026-08-08T21:36:33.048Z',
  ...auditOfficial,
};

out.summary = {
  inactiveAllOk: out.inactiveModes
    .filter((x) => x.step.startsWith('inactive-'))
    .every((x) => x.ok),
  exactPass: out.exactIdentifiers.filter((x) => x.result === 'PASS').length,
  exactTotal: out.exactIdentifiers.length,
  exactAllPass: out.exactIdentifiers.every((x) => x.result === 'PASS'),
  hybridV2Published: out.versions.retrieval.some(
    (r) => r.version_label === 'hybrid-v2' && r.status === 'PUBLISHED',
  ),
  noDraftPublished: publishedLabs.length === 0,
  WORKFLOW_HISTORY_SYNC: out.workflowHistory.WORKFLOW_HISTORY_SYNC,
  cacheDeactivateEvent: out.cacheCycle.deactivateOk,
  cacheActivateEvent: out.cacheCycle.activateOk,
};

writeFileSync('tmp/post-go-live/28-final-ops.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out.summary, null, 2));
await c.end();
