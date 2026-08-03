#!/usr/bin/env node
/**
 * Etapa 20 consolidação — core patches:
 * 1) migration extras
 * 2) IA - VALIDAR RETRIEVAL CONFIG
 * 3) rebuild admin create/update/validate/publish/rollback/compare
 * 4) LOAD_CFG versionId override
 * 5) Consulta IA honors lab versionId + retrievalMeta
 * 6) EXECUTAR TESTE/DATASET + CALCULAR MÉTRICAS retrieval metrics
 */
import crypto from 'crypto';
import pg from 'pg';
import { writeFileSync, readFileSync } from 'fs';

const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const PROJECT_ID = 'WbvMM1wAedTR9qrk';
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const NORM = 'N3zLpj7Dij4n5p5p';
const AUTH = 'P5E43ZXSJiI9wFYD';
const PERM = 'yXW3rW8EbHXuprRJ';
const PREP_OK = 'SYSTEM - PREPARAR RESPOSTA SUCESSO'; // resolve by name later
const PREP_ERR = null;

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function uuid() {
  return crypto.randomUUID();
}
function nanoid(size = 16) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = crypto.randomBytes(size);
  let s = '';
  for (let i = 0; i < size; i++) s += a[b[i] % a.length];
  return s;
}
function N(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: uuid(), name, type, typeVersion, position, parameters, ...extra };
}
function link(c, from, to, out = 0) {
  if (!c[from]) c[from] = { main: [[]] };
  while (c[from].main.length <= out) c[from].main.push([]);
  c[from].main[out].push({ node: to, type: 'main', index: 0 });
}
function setTargets(c, src, idx, targets) {
  if (!c[src]) c[src] = { main: [[]] };
  while (c[src].main.length <= idx) c[src].main.push([]);
  c[src].main[idx] = targets.map((n) => ({ node: n, type: 'main', index: 0 }));
}

async function resolvePrepIds() {
  const { rows } = await client.query(
    `SELECT id, name FROM workflow_entity WHERE name IN (
      'SYSTEM - PREPARAR RESPOSTA SUCESSO',
      'SYSTEM - PREPARAR RESPOSTA ERRO',
      'SYSTEM - REGISTRAR AUDITORIA'
    )`,
  );
  const map = Object.fromEntries(rows.map((r) => [r.name, r.id]));
  return {
    PREP_SUCCESS: map['SYSTEM - PREPARAR RESPOSTA SUCESSO'],
    PREP_ERROR: map['SYSTEM - PREPARAR RESPOSTA ERRO'],
    AUDIT: map['SYSTEM - REGISTRAR AUDITORIA'] || AUDIT,
  };
}

async function saveWorkflow(id, nodes, connections, { activate = true } = {}) {
  const { rows } = await client.query(`SELECT "activeVersionId" FROM workflow_entity WHERE id=$1`, [id]);
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=$3, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), activate, id],
  );
  if (rows[0]?.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), id, rows[0].activeVersionId],
    );
  }
  return rows[0]?.activeVersionId;
}

async function upsertNewWorkflow(name, description, nodes, connections) {
  const { rows: existing } = await client.query(`SELECT id, "activeVersionId" FROM workflow_entity WHERE name=$1`, [name]);
  if (existing[0]) {
    await saveWorkflow(existing[0].id, nodes, connections);
    return { id: existing[0].id, status: 'updated' };
  }
  const id = nanoid(16);
  const versionId = uuid();
  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO workflow_entity (
        id, name, active, nodes, connections, settings, "staticData", "pinData",
        "versionId", "triggerCount", meta, "parentFolderId", "isArchived",
        "versionCounter", description, "activeVersionId", "createdAt", "updatedAt"
      ) VALUES ($1,$2,false,$3::json,$4::json,$5::json,NULL,'{}'::json,$6::varchar,0,$7::json,NULL,false,1,$8,NULL,NOW(),NOW())`,
      [
        id,
        name,
        JSON.stringify(nodes),
        JSON.stringify(connections),
        JSON.stringify({ executionOrder: 'v1', availableInMCP: true }),
        versionId,
        JSON.stringify({ builderVariant: 'etapa20-consolidacao' }),
        description,
      ],
    );
    await client.query(
      `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
       VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
      [id, PROJECT_ID],
    );
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1,$2,'etapa20',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
      [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name, description],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, active=true WHERE id=$2`,
      [versionId, id],
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  }
  return { id, status: 'created', versionId };
}

const ids = JSON.parse(readFileSync(new URL('./workflow-ids.json', import.meta.url), 'utf8'));
const adminIds = Object.fromEntries(
  JSON.parse(readFileSync(new URL('./workflow-admin-ids.json', import.meta.url), 'utf8')).map((r) => [
    r.name,
    r.id,
  ]),
);

const out = { steps: [] };

// ========== MIGRATION EXTRAS ==========
await client.query(`
ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS retrieval_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS mode_override_used boolean DEFAULT false;

ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS candidates_retrieved integer,
  ADD COLUMN IF NOT EXISTS expected_document_rank integer,
  ADD COLUMN IF NOT EXISTS source_precision numeric,
  ADD COLUMN IF NOT EXISTS source_recall numeric,
  ADD COLUMN IF NOT EXISTS retrieval_ranked_document_ids jsonb;

ALTER TABLE ai_test_metrics
  ADD COLUMN IF NOT EXISTS retrieval_cases_evaluated integer,
  ADD COLUMN IF NOT EXISTS retrieval_cases_skipped integer,
  ADD COLUMN IF NOT EXISTS fallback_count integer,
  ADD COLUMN IF NOT EXISTS source_precision numeric,
  ADD COLUMN IF NOT EXISTS source_recall numeric;
`);
out.steps.push({ migration: true });

// ========== VALIDATION JS (shared) ==========
const VALIDATE_JS = `const t=$input.first().json||{};
function parseJson(v,fb){if(v==null||v==='')return fb; if(typeof v==='object')return v; try{return JSON.parse(String(v));}catch(_){return fb;}}
const body=parseJson(t.configurationJson, t.configuration||{});
const modeRaw=String(t.mode||body.mode||'').trim().toUpperCase();
const versionLabel=t.versionLabel!=null?String(t.versionLabel): (body.versionLabel!=null?String(body.versionLabel):null);
const errors=[]; const warnings=[];
function err(field,message,code){errors.push({field,message,code:code||'INVALID'});}
const MODES=['TEXT_ONLY','VECTOR_ONLY','HYBRID','HYBRID_RERANK'];
if(!MODES.includes(modeRaw)) err('mode','mode deve ser TEXT_ONLY|VECTOR_ONLY|HYBRID|HYBRID_RERANK','INVALID_MODE');
if(body==null || typeof body!=='object' || Array.isArray(body)) err('configuration','configuration deve ser objeto JSON','INVALID_CONFIG');
const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes']);
const FORBIDDEN=new Set(['id','publishedAt','validationScore','validationRunId','contentHash','createdBy','sql','workflowId','secrets','expression','code','eval']);
if(body && typeof body==='object'){
  for(const k of Object.keys(body)){
    if(FORBIDDEN.has(k) || /sql|secret|workflow|eval|function/i.test(k)) err(k,'campo proibido','FORBIDDEN_FIELD');
    else if(!ALLOWED_ROOT.has(k)) err(k,'campo desconhecido','UNKNOWN_FIELD');
  }
}
function num(v,field){
  if(v===undefined||v===null||v==='') return null;
  if(typeof v==='string' && v.trim()!=='' && !/^-?\\d+(\\.\\d+)?$/.test(v.trim())){ err(field,'deve ser número','TYPE'); return NaN; }
  const n=Number(v);
  if(!Number.isFinite(n)) { err(field,'número inválido (NaN/Infinity)','TYPE'); return NaN; }
  return n;
}
function int(v,field){
  const n=num(v,field); if(n==null||Number.isNaN(n)) return null;
  if(!Number.isInteger(n)) err(field,'deve ser inteiro','TYPE');
  return n;
}
function bool(v,field){
  if(v===undefined||v===null||v==='') return false;
  if(typeof v==='boolean') return v;
  err(field,'deve ser boolean real (não string)','TYPE');
  return false;
}
const candidateLimit=int(body.candidateLimit,'candidateLimit');
const finalLimit=int(body.finalLimit,'finalLimit');
const maxChunks=int(body.maxChunksPerDocument,'maxChunksPerDocument');
if(candidateLimit!=null){ if(candidateLimit<1||candidateLimit>50) err('candidateLimit','faixa 1..50','RANGE'); }
else err('candidateLimit','obrigatório','REQUIRED');
if(finalLimit!=null){ if(finalLimit<1||finalLimit>20) err('finalLimit','faixa 1..20','RANGE'); }
else err('finalLimit','obrigatório','REQUIRED');
if(candidateLimit!=null && finalLimit!=null && finalLimit>candidateLimit) err('finalLimit','finalLimit não pode ser maior que candidateLimit','COHERENCE');
if(maxChunks!=null){
  if(maxChunks<1||maxChunks>8) err('maxChunksPerDocument','faixa 1..8','RANGE');
  if(finalLimit!=null && maxChunks>finalLimit) err('maxChunksPerDocument','não pode ser maior que finalLimit','COHERENCE');
} else err('maxChunksPerDocument','obrigatório','REQUIRED');
const enableNeighbors=bool(body.enableNeighbors,'enableNeighbors');
const weights=body.weights&&typeof body.weights==='object'?body.weights:{};
const ALLOWED_W=new Set(['semantic','lexical','hybridPrior']);
for(const k of Object.keys(weights||{})){ if(!ALLOWED_W.has(k)) err('weights.'+k,'peso desconhecido','UNKNOWN_FIELD'); }
const semantic=num(weights.semantic,'weights.semantic');
const lexical=num(weights.lexical,'weights.lexical');
const hybridPrior=num(weights.hybridPrior??0,'weights.hybridPrior');
for(const [f,v] of [['weights.semantic',semantic],['weights.lexical',lexical],['weights.hybridPrior',hybridPrior]]){
  if(v!=null && !Number.isNaN(v) && (v<0 || v>1)) err(f,'peso deve estar em 0..1','RANGE');
}
if([semantic,lexical,hybridPrior].every(v=>v==null||Number.isNaN(v))) err('weights','ao menos um peso é obrigatório','REQUIRED');
const wsum=(Number.isFinite(semantic)?semantic:0)+(Number.isFinite(lexical)?lexical:0)+(Number.isFinite(hybridPrior)?hybridPrior:0);
if(wsum<=0 || wsum>1.5) err('weights','soma dos pesos deve estar em (0, 1.5]','COHERENCE');
const ALLOWED_BOOST=new Set(['subcategoryMatch','categoryMatch','titleMatch','exactIdentifier','tabularStructure','ocrGood','isCurrent','recentVigency','exactPhrase']);
const ALLOWED_PEN=new Set(['redundancyPerExtraChunk','staleDocument','lowUsefulLength']);
const boosts=body.boosts&&typeof body.boosts==='object'?body.boosts:{};
const penalties=body.penalties&&typeof body.penalties==='object'?body.penalties:{};
for(const k of Object.keys(boosts)){ if(!ALLOWED_BOOST.has(k)) err('boosts.'+k,'boost desconhecido','UNKNOWN_FIELD'); const v=num(boosts[k],'boosts.'+k); if(v!=null&&!Number.isNaN(v)&&(v<0||v>1)) err('boosts.'+k,'faixa 0..1','RANGE'); }
for(const k of Object.keys(penalties)){ if(!ALLOWED_PEN.has(k)) err('penalties.'+k,'penalty desconhecida','UNKNOWN_FIELD'); const v=num(penalties[k],'penalties.'+k); if(v!=null&&!Number.isNaN(v)&&(v<0||v>1)) err('penalties.'+k,'faixa 0..1','RANGE'); }
if(versionLabel!=null){
  const vl=versionLabel.trim();
  if(!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(vl)) err('versionLabel','formato inválido (2-64 chars: letras, números, ._- )','FORMAT');
}
if(Object.keys(body).length===0) err('configuration','configuration vazia','EMPTY');
const normalized={
  mode: modeRaw||'HYBRID',
  candidateLimit: candidateLimit??30,
  finalLimit: finalLimit??12,
  maxChunksPerDocument: maxChunks??2,
  enableNeighbors: !!enableNeighbors,
  weights:{
    semantic: Number.isFinite(semantic)?semantic:0.65,
    lexical: Number.isFinite(lexical)?lexical:0.35,
    hybridPrior: Number.isFinite(hybridPrior)?hybridPrior:0,
  },
  boosts: Object.fromEntries(Object.entries(boosts).map(([k,v])=>[k,Number(v)])),
  penalties: Object.fromEntries(Object.entries(penalties).map(([k,v])=>[k,Number(v)])),
  normalization: (body.normalization&&typeof body.normalization==='object')?body.normalization:{vector:'clip01',text:'batchMax',hybrid:'passthrough'},
  notes: typeof body.notes==='string'?body.notes.slice(0,500):'',
};
const crypto=require('crypto');
const contentHash=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
const ok=errors.length===0;
return [{json:{ok, errors, warnings, normalized, contentHash, mode:normalized.mode, versionLabel: versionLabel?versionLabel.trim():null, configurationJson: JSON.stringify(normalized), fields: errors}}];`;

// Create VALIDAR subworkflow
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'mode', type: 'string' },
          { name: 'configurationJson', type: 'string' },
          { name: 'versionLabel', type: 'string' },
        ],
      },
    }),
    N('Validar', 'n8n-nodes-base.code', 2, [220, 0], {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: VALIDATE_JS,
    }),
  ];
  const c = {};
  link(c, 'Trigger', 'Validar');
  const r = await upsertNewWorkflow(
    'IA - VALIDAR RETRIEVAL CONFIG',
    'Validação centralizada e estrita de configuração de retrieval/re-ranking.',
    nodes,
    c,
  );
  out.validar = r;
  ids.VALIDAR = r.id;
}

// ========== LOAD_CFG: support versionId ==========
{
  const { rows } = await client.query(`SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`, [
    ids.LOAD_CFG,
  ]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const trigger = nodes.find((n) => n.name === 'Trigger');
  trigger.parameters.workflowInputs = {
    values: [
      { name: 'requestId', type: 'string' },
      { name: 'modeOverride', type: 'string' },
      { name: 'versionId', type: 'string' },
    ],
  };
  const pgNode = nodes.find((n) => n.name === 'Buscar config publicada');
  pgNode.name = 'Buscar config';
  pgNode.parameters.query = `WITH params AS (
  SELECT NULLIF(TRIM('{{ $json.versionId || "" }}'), '') AS version_id
)
SELECT
  c.code,
  v.id AS version_id,
  v.version_label,
  v.version_number,
  v.status,
  v.mode,
  v.configuration,
  v.content_hash,
  v.published_at,
  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), v.mode) AS secret_mode,
  CASE WHEN (SELECT version_id FROM params) IS NOT NULL THEN true ELSE false END AS override_used
FROM ai_retrieval_configs c
JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
WHERE c.code = COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_config_code' LIMIT 1), 'AI_QUERY_RETRIEVAL')
  AND c.active = true
  AND (
    ((SELECT version_id FROM params) IS NOT NULL AND v.id = (SELECT version_id FROM params)::uuid AND v.status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED'))
    OR
    ((SELECT version_id FROM params) IS NULL AND v.status = 'PUBLISHED')
  )
ORDER BY CASE WHEN v.status='PUBLISHED' THEN 0 ELSE 1 END, v.published_at DESC NULLS LAST
LIMIT 1;`;
  // Fix n8n expression style
  pgNode.parameters.query = `SELECT
  c.code,
  v.id AS version_id,
  v.version_label,
  v.version_number,
  v.status,
  v.mode,
  v.configuration,
  v.content_hash,
  v.published_at,
  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), v.mode) AS secret_mode,
  CASE WHEN NULLIF(TRIM('={{ $json.versionId || "" }}'), '') IS NOT NULL THEN true ELSE false END AS override_used
FROM ai_retrieval_configs c
JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id
WHERE c.code = COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_config_code' LIMIT 1), 'AI_QUERY_RETRIEVAL')
  AND c.active = true
  AND (
    (NULLIF(TRIM('={{ $json.versionId || "" }}'), '') IS NOT NULL
      AND v.id = NULLIF(TRIM('={{ $json.versionId || "" }}'), '')::uuid
      AND v.status IN ('DRAFT','VALIDATING','PUBLISHED','ARCHIVED'))
    OR
    (NULLIF(TRIM('={{ $json.versionId || "" }}'), '') IS NULL AND v.status = 'PUBLISHED')
  )
ORDER BY CASE WHEN v.status='PUBLISHED' THEN 0 ELSE 1 END, v.published_at DESC NULLS LAST
LIMIT 1;`;

  const norm = nodes.find((n) => n.name === 'Normalizar config');
  norm.parameters.jsCode = norm.parameters.jsCode
    .replace(
      "const override=String(t.modeOverride||'').trim().toUpperCase();",
      "const override=String(t.modeOverride||'').trim().toUpperCase();\nconst versionOverride=String(t.versionId||'').trim();",
    )
    .replace(
      'const ok=!!row.version_label;',
      "const ok=!!row.version_label;\nconst modeOverrideUsed=!!row.override_used || !!override;",
    );
  if (!norm.parameters.jsCode.includes('modeOverrideUsed')) {
    // append to return
  }
  if (!norm.parameters.jsCode.includes('modeOverrideUsed:')) {
    norm.parameters.jsCode = norm.parameters.jsCode.replace(
      'configurationJson:JSON.stringify(cfg)}}];',
      'configurationJson:JSON.stringify(cfg), modeOverrideUsed:!!row.override_used||!!override, versionId:row.version_id||null}}];',
    );
  }
  // Fix connection if node renamed
  if (connections['Buscar config publicada']) {
    connections['Buscar config'] = connections['Buscar config publicada'];
    delete connections['Buscar config publicada'];
  }
  if (connections['Trigger']?.main?.[0]?.[0]?.node === 'Buscar config publicada') {
    connections['Trigger'].main[0][0].node = 'Buscar config';
  }
  await saveWorkflow(ids.LOAD_CFG, nodes, connections);
  out.loadCfg = true;
}

writeFileSync(new URL('./workflow-ids.json', import.meta.url), JSON.stringify({ ...ids, VALIDAR: ids.VALIDAR }, null, 2));
writeFileSync(new URL('./_consolidacao-partial.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
