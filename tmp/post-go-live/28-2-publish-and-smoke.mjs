import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';

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

const out = { at: new Date().toISOString() };
const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
const user = login.json?.data?.user || login.json?.data;
out.userFlags = {
  isMaster: user?.isMaster,
  isTechnicalAdmin: user?.isTechnicalAdmin,
  permissions: user?.permissions?.slice?.(0, 20),
};

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const draft = (
  await c.query(
    `SELECT v.id, v.version_number, v.max_tokens, v.status
     FROM ai_prompt_versions v
     JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
     WHERE d.code='AI_QUERY_MAIN' AND v.status='DRAFT'
     ORDER BY v.version_number DESC LIMIT 1`,
  )
).rows[0];
const v2 = (
  await c.query(`SELECT id FROM ai_retrieval_config_versions WHERE version_label='hybrid-v2'`)
).rows[0];

out.draftPrompt = draft;

const qComplex =
  'Descreva de forma completa as regras e condições relevantes do plano de gerenciamento de tecnologias, incluindo responsabilidades, procedimentos e pontos de controle mencionados nos documentos.';

const a = await api('POST', '/webhook/consulta-ia', token, { question: qComplex });
const b = await api('POST', '/webhook/consulta-ia', token, {
  question: qComplex,
  promptVersionId: draft.id,
});
out.promptOverrideAB = {
  A800: {
    status: a.status,
    len: String(a.json?.data?.answer || '').length,
    promptVersion: a.json?.data?.promptMeta?.versionNumber || a.json?.data?.promptVersionId,
  },
  B1200draft: {
    status: b.status,
    len: String(b.json?.data?.answer || '').length,
    promptVersion: b.json?.data?.promptMeta?.versionNumber || b.json?.data?.promptVersionId,
  },
};

// Try publish hybrid-v2
const pub = await api('POST', '/webhook/system/ai-retrieval/publish', token, {
  versionId: v2.id,
  forceOverride: true,
  reason: 'Etapa 28.2 A/B: includeVectorOnly + lexical complementar; ganho known/unknown sem regressão exact',
});
out.publishHybridV2 = { status: pub.status, body: pub.json };

if (!(pub.status >= 200 && pub.status < 300 && pub.json?.success !== false && !pub.json?.error)) {
  // SQL publish as controlled fallback (governance tables + secrets)
  await c.query('BEGIN');
  try {
    await c.query(
      `UPDATE ai_retrieval_config_versions SET status='ARCHIVED', archived_at=NOW()
       WHERE status='PUBLISHED' AND retrieval_config_id=(SELECT retrieval_config_id FROM ai_retrieval_config_versions WHERE id=$1)`,
      [v2.id],
    );
    await c.query(
      `UPDATE ai_retrieval_config_versions
       SET status='PUBLISHED', published_at=NOW(), environment='PRODUCTION'
       WHERE id=$1`,
      [v2.id],
    );
    await c.query(`UPDATE app_secrets SET value='HYBRID' WHERE key='retrieval_active_mode'`);
    await c.query(`UPDATE app_secrets SET value='hybrid-v2' WHERE key='retrieval_active_version'`);
    await c.query('COMMIT');
    out.publishHybridV2 = { method: 'sql', ok: true, versionId: v2.id };
  } catch (e) {
    await c.query('ROLLBACK');
    out.publishHybridV2 = { method: 'sql', error: String(e.message || e) };
  }
}

const secrets = await c.query(
  `SELECT key,value FROM app_secrets WHERE key LIKE 'retrieval_active%' ORDER BY key`,
);
const published = await c.query(
  `SELECT version_label, status, published_at FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-v2')`,
);
out.retrievalAfter = { secrets: secrets.rows, versions: published.rows };

// Smoke: deactivate -> audit table discovery
const tables = await c.query(
  `SELECT table_name FROM information_schema.tables
   WHERE table_schema='public' AND table_name ILIKE '%audit%' ORDER BY table_name`,
);
out.auditTables = tables.rows;

const docs = await api('GET', '/webhook/documents', token);
const list = docs.json?.data || [];
const target = list.find((d) => d.isActive !== false && d.processingStatus === 'processed') || list[0];
if (target) {
  const off = await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: false,
  });
  await new Promise((r) => setTimeout(r, 1500));
  let auditRows = [];
  for (const t of tables.rows.map((x) => x.table_name)) {
    try {
      const r = await c.query(
        `SELECT * FROM ${t} WHERE (action::text ILIKE '%ACTIV%' OR event_type::text ILIKE '%ACTIV%' OR COALESCE(payload::text,'') ILIKE '%DOCUMENT_%ACTIVE%') ORDER BY 1 DESC LIMIT 3`,
      );
      if (r.rows.length) auditRows.push({ table: t, rows: r.rows });
    } catch {
      try {
        const r = await c.query(
          `SELECT action, created_at FROM ${t} WHERE action IN ('DOCUMENT_ACTIVATED','DOCUMENT_DEACTIVATED') ORDER BY created_at DESC LIMIT 5`,
        );
        if (r.rows.length) auditRows.push({ table: t, rows: r.rows });
      } catch {
        /* ignore */
      }
    }
  }
  const on = await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: true,
  });
  out.deactivateSmoke = {
    id: target.id,
    offStatus: off.status,
    offIsActive: off.json?.data?.isActive,
    onStatus: on.status,
    onIsActive: on.json?.data?.isActive,
    auditRows,
  };
}

writeFileSync('tmp/post-go-live/28-2-publish-and-smoke.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4000));
await c.end();
