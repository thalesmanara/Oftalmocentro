#!/usr/bin/env node
/**
 * Etapa 21 — Create IA - CARREGAR CONTEXT CONFIG, IA - VALIDAR CONTEXT CONFIG,
 * IA - GERENCIAR JANELA DE CONTEXTO; integrate into Consulta IA.
 */
import pg from 'pg';
import { randomUUID, createHash } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const PROJECT = 'WbvMM1wAedTR9qrk';
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const CONSULTA = '8EXk5RkFW5cxnenL';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const uid = () => randomUUID();
const wfId = () => randomUUID().replace(/-/g, '').slice(0, 16);

function code(name, position, jsCode, extra = {}) {
  return {
    id: uid(),
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode },
    ...extra,
  };
}
function exec(name, position, workflowId, cachedName, inputs, extra = {}) {
  return {
    id: uid(),
    name,
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.3,
    position,
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: workflowId, cachedResultName: cachedName },
      workflowInputs: { mappingMode: 'defineBelow', value: inputs },
      options: { waitForSubWorkflow: true },
    },
    ...extra,
  };
}
function trigger(inputs) {
  return {
    id: uid(),
    name: 'Trigger',
    type: 'n8n-nodes-base.executeWorkflowTrigger',
    typeVersion: 1.2,
    position: [0, 0],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: { values: inputs },
    },
  };
}

async function upsertWorkflow(name, nodes, connections, description) {
  const existing = await client.query(
    `SELECT id, "activeVersionId" FROM workflow_entity WHERE name=$1 LIMIT 1`,
    [name],
  );
  let id = existing.rows[0]?.id;
  const versionId = uid();
  if (!id) {
    id = wfId();
    await client.query(
      `INSERT INTO workflow_entity (
        id, name, active, nodes, connections, settings, "staticData", "pinData",
        "versionId", "triggerCount", meta, "parentFolderId", "createdAt", "updatedAt",
        "isArchived", "activeVersionId"
      ) VALUES ($1,$2,true,$3::json,$4::json,$5::json,NULL,NULL,$6,0,$7::json,NULL,NOW(),NOW(),false,NULL)`,
      [
        id,
        name,
        JSON.stringify(nodes),
        JSON.stringify(connections),
        JSON.stringify({ executionOrder: 'v1', availableInMCP: true }),
        versionId,
        JSON.stringify({ builderVariant: 'etapa21-cwm' }),
      ],
    );
    try {
      await client.query(
        `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
         VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [id, PROJECT],
      );
    } catch (_) {}
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
       VALUES ($1::varchar,$2,'etapa21',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
      [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name, description || ''],
    );
    await client.query(
      `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar, active=true WHERE id=$2`,
      [versionId, id],
    );
  } else {
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`,
      [JSON.stringify(nodes), JSON.stringify(connections), id],
    );
    if (existing.rows[0].activeVersionId) {
      await client.query(
        `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
         WHERE "workflowId"=$3 AND "versionId"=$4`,
        [JSON.stringify(nodes), JSON.stringify(connections), id, existing.rows[0].activeVersionId],
      );
    } else {
      await client.query(
        `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
         VALUES ($1::varchar,$2,'etapa21',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
        [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name, description || ''],
      );
      await client.query(
        `UPDATE workflow_entity SET "activeVersionId"=$1::varchar, "versionId"=$1::varchar WHERE id=$2`,
        [versionId, id],
      );
    }
  }
  return id;
}

// ---------- CARREGAR CONTEXT CONFIG ----------
const loadNodes = [
  trigger([
    { name: 'contextConfigVersionId', type: 'string' },
    { name: 'contextConfigOverrideAllowed', type: 'string' },
    { name: 'requestId', type: 'string' },
  ]),
  {
    id: uid(),
    name: 'Carregar versão',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [260, 0],
    credentials: { postgres: PG_CRED },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `WITH req AS (
  SELECT
    NULLIF(TRIM('{{ $json.contextConfigVersionId || "" }}'),'')::uuid AS override_id,
    LOWER(TRIM('{{ $json.contextConfigOverrideAllowed || "false" }}')) IN ('true','1','yes') AS override_allowed
)
SELECT
  v.id AS "versionId",
  v.version_label AS "versionLabel",
  v.version_number AS "versionNumber",
  v.status,
  v.mode,
  v.environment,
  v.model_name AS "modelName",
  v.configuration,
  v.content_hash AS "contentHash",
  d.id AS "configId",
  d.code,
  CASE WHEN req.override_allowed AND req.override_id IS NOT NULL AND v.id = req.override_id THEN true ELSE false END AS "modeOverrideUsed"
FROM ai_context_configs d
JOIN ai_context_config_versions v ON v.context_config_id = d.id
CROSS JOIN req
WHERE d.code = 'AI_QUERY_CONTEXT' AND d.active = true
  AND (
    (req.override_allowed AND req.override_id IS NOT NULL AND v.id = req.override_id AND v.status IN ('DRAFT','VALIDATING','PUBLISHED'))
    OR (NOT (req.override_allowed AND req.override_id IS NOT NULL) AND v.status = 'PUBLISHED')
  )
ORDER BY CASE WHEN req.override_allowed AND req.override_id IS NOT NULL AND v.id = req.override_id THEN 0 ELSE 1 END, v.published_at DESC NULLS LAST
LIMIT 1`,
    },
    alwaysOutputData: true,
  },
  code(
    'Normalizar',
    [520, 0],
    `const row=$input.first().json||{};
if(!row.versionId){
  return [{json:{ok:false,code:'CONTEXT_CONFIG_NOT_FOUND',error:'Nenhuma configuração de contexto disponível.'}}];
}
let cfg=row.configuration;
if(typeof cfg==='string'){try{cfg=JSON.parse(cfg);}catch(_){cfg={};}}
if(!cfg||typeof cfg!=='object') cfg={};
const mode=String(row.mode||cfg.mode||'LEGACY').toUpperCase();
return [{json:{
  ok:true,
  versionId:row.versionId,
  versionLabel:row.versionLabel,
  versionNumber:row.versionNumber,
  status:row.status,
  mode,
  code:row.code||'AI_QUERY_CONTEXT',
  modelName:row.modelName||cfg.modelName||'gpt-4.1-mini',
  configuration:cfg,
  configurationJson:JSON.stringify(cfg),
  contentHash:row.contentHash||null,
  modeOverrideUsed:!!row.modeOverrideUsed,
}}];`,
  ),
];
const loadConn = {
  Trigger: { main: [[{ node: 'Carregar versão', type: 'main', index: 0 }]] },
  'Carregar versão': { main: [[{ node: 'Normalizar', type: 'main', index: 0 }]] },
};
const LOAD_ID = await upsertWorkflow(
  'IA - CARREGAR CONTEXT CONFIG',
  loadNodes,
  loadConn,
  'Carrega versão publicada ou override autorizado da janela de contexto',
);

// ---------- VALIDAR CONTEXT CONFIG ----------
const validateNodes = [
  trigger([
    { name: 'mode', type: 'string' },
    { name: 'configurationJson', type: 'string' },
    { name: 'versionLabel', type: 'string' },
    { name: 'modelName', type: 'string' },
  ]),
  code(
    'Validar',
    [260, 0],
    `const t=$input.first().json||{};
const errors=[];
const allowedModes=new Set(['LEGACY','BUDGETED','BUDGETED_WITH_NEIGHBORS']);
const mode=String(t.mode||'').toUpperCase();
if(!allowedModes.has(mode)) errors.push({field:'mode',message:'Modo inválido.'});
let cfg={};
try{cfg=typeof t.configurationJson==='string'?JSON.parse(t.configurationJson||'{}'):(t.configuration||{});}catch(_){
  errors.push({field:'configuration',message:'JSON inválido.'});
  cfg={};
}
if(cfg&&typeof cfg==='object'){
  const unknown=Object.keys(cfg).filter(k=>![
    'mode','modelName','contextLimitTokens','maxInputTokens','reservedResponseTokens','reservedSystemTokens',
    'safetyMarginTokens','maxChunks','maxChunksPerDocument','minChunkScore','enableNeighbors','maxNeighborsPerChunk',
    'enableRedundancyRemoval','redundancyThreshold','enableConflictPreservation','tokenizer','notes'
  ].includes(k));
  for(const f of unknown) errors.push({field:f,message:'Campo desconhecido.'});
  const boolFields=['enableNeighbors','enableRedundancyRemoval','enableConflictPreservation'];
  for(const f of boolFields){
    if(cfg[f]!==undefined && typeof cfg[f]!=='boolean') errors.push({field:f,message:'Deve ser boolean real.'});
  }
  const nums=['contextLimitTokens','maxInputTokens','reservedResponseTokens','reservedSystemTokens','safetyMarginTokens','maxChunks','maxChunksPerDocument','minChunkScore','maxNeighborsPerChunk','redundancyThreshold'];
  for(const f of nums){
    if(cfg[f]!==undefined && (typeof cfg[f]!=='number' || Number.isNaN(cfg[f]))) errors.push({field:f,message:'Deve ser número.'});
  }
  const limit=Number(cfg.contextLimitTokens||0);
  const reserved=Number(cfg.reservedResponseTokens||0)+Number(cfg.reservedSystemTokens||0)+Number(cfg.safetyMarginTokens||0);
  if(limit<=0) errors.push({field:'contextLimitTokens',message:'Limite deve ser positivo.'});
  if(reserved>=limit) errors.push({field:'reservedResponseTokens',message:'Reservas devem ser menores que o limite.'});
  if(Number(cfg.maxChunks||0)<=0) errors.push({field:'maxChunks',message:'maxChunks inválido.'});
  if(Number(cfg.maxChunksPerDocument||0)<=0) errors.push({field:'maxChunksPerDocument',message:'maxChunksPerDocument inválido.'});
  if(cfg.enableNeighbors===true && Number(cfg.maxNeighborsPerChunk||0)<0) errors.push({field:'maxNeighborsPerChunk',message:'Inválido.'});
}
const model=String(t.modelName||cfg.modelName||'').trim();
const allowedModels=['gpt-4.1-mini','gpt-4.1','gpt-4o-mini','gpt-4o'];
if(model && !allowedModels.includes(model)) errors.push({field:'modelName',message:'Modelo não permitido.'});
const label=String(t.versionLabel||'').trim();
if(label.length>80) errors.push({field:'versionLabel',message:'Rótulo muito longo.'});
return [{json:{ok:errors.length===0, errors, mode, configuration:cfg, modelName:model||null}}];`,
  ),
];
const validateConn = {
  Trigger: { main: [[{ node: 'Validar', type: 'main', index: 0 }]] },
};
const VALIDATE_ID = await upsertWorkflow(
  'IA - VALIDAR CONTEXT CONFIG',
  validateNodes,
  validateConn,
  'Valida configuração da janela de contexto',
);

// ---------- GERENCIAR JANELA DE CONTEXTO ----------
const cwmAlgo = `const t0=Date.now();
function estTokens(text){
  const s=String(text||'');
  if(!s) return 0;
  // Estimativa conservadora (PT/UTF-8): ~3 chars/token + 8% margem embutida via ceil
  return Math.ceil(s.length / 3);
}
function normText(s){
  return String(s||'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\s+/g,' ').trim();
}
function contentHash(s){
  const t=normText(s);
  let h=0; for(const ch of t){h=((h<<5)-h)+ch.charCodeAt(0); h|=0;}
  return Math.abs(h).toString(16);
}
function overlapRatio(a,b){
  const na=normText(a), nb=normText(b);
  if(!na||!nb) return 0;
  if(na===nb) return 1;
  const shorter=na.length<=nb.length?na:nb;
  const longer=na.length>nb.length?na:nb;
  if(longer.includes(shorter) && shorter.length/longer.length>=0.85) return shorter.length/longer.length;
  return 0;
}

try{
const inp=$input.first().json||{};
const question=String(inp.question||'').trim();
let classification=inp.classification||{};
if(typeof classification==='string'){try{classification=JSON.parse(classification);}catch(_){classification={};}}
let chunks=Array.isArray(inp.selectedChunks)?inp.selectedChunks:[];
if(!chunks.length && inp.selectedChunksJson){
  try{chunks=JSON.parse(inp.selectedChunksJson);}catch(_){chunks=[];}
}
let retrievalMeta=inp.retrievalMeta||{};
if(typeof retrievalMeta==='string'){try{retrievalMeta=JSON.parse(retrievalMeta);}catch(_){retrievalMeta={};}}
let promptCfg=inp.promptConfiguration||{};
if(typeof promptCfg==='string'){try{promptCfg=JSON.parse(promptCfg);}catch(_){promptCfg={};}}
if(inp.promptConfigurationJson){try{promptCfg={...promptCfg,...JSON.parse(inp.promptConfigurationJson)};}catch(_){}}

const cfgNode=$('Após carregar config').first().json||{};
const cfg=cfgNode.configuration||{};
const mode=String(cfgNode.mode||cfg.mode||'LEGACY').toUpperCase();
const modelName=String(promptCfg.modelName||cfgNode.modelName||cfg.modelName||'gpt-4.1-mini');
const systemPrompt=String(promptCfg.systemPrompt||promptCfg.content||'');
const maxOut=Number(promptCfg.maxTokens||cfg.reservedResponseTokens||800)||800;

const modelContextLimit=Number(cfg.contextLimitTokens||32000)||32000;
const reservedResponseTokens=Math.max(maxOut, Number(cfg.reservedResponseTokens||1200)||1200);
const reservedSystemTokens=Math.max(estTokens(systemPrompt), Number(cfg.reservedSystemTokens||2000)||2000);
const safetyMarginTokens=Number(cfg.safetyMarginTokens||800)||800;
const questionTokens=estTokens(question);
const availableContextTokens=Math.max(0, modelContextLimit - reservedResponseTokens - reservedSystemTokens - questionTokens - safetyMarginTokens);

const maxChunks=Number(cfg.maxChunks||12)||12;
const maxPerDoc=Number(cfg.maxChunksPerDocument||4)||4;
const minScore=Number(cfg.minChunkScore||0)||0;
const enableRedundancy=cfg.enableRedundancyRemoval===true || mode==='BUDGETED' || mode==='BUDGETED_WITH_NEIGHBORS';
const redundancyThreshold=Number(cfg.redundancyThreshold||0.92)||0.92;
const enableNeighbors=cfg.enableNeighbors===true && mode==='BUDGETED_WITH_NEIGHBORS';
const enableConflict=cfg.enableConflictPreservation!==false;

function scoreOf(c){
  const v=c.rerankScore??c.hybridScore??c.relevance??c.mergedScore??c.textScore??c.vectorScore??0;
  const n=Number(v); return Number.isFinite(n)?n:0;
}

const normalized=chunks.map((c,i)=>({
  chunkId:c.chunkId||null,
  documentId:c.documentId||null,
  documentTitle:c.documentTitle||c.document||null,
  sectorId:c.sectorId??null,
  sectorName:c.sectorName||null,
  categoryId:c.categoryId??null,
  categoryName:c.categoryName||null,
  subcategoryId:c.subcategoryId??null,
  subcategoryName:c.subcategoryName||null,
  vigencyDate:c.vigencyDate||c.expirationDate||null,
  chunkOrder:c.chunkOrder??c.chunkIndex??i,
  chunkKind:String(c.chunkKind||'text').toLowerCase(),
  sheetName:c.sheetName||null,
  rowStart:c.rowStart??null,
  rowEnd:c.rowEnd??null,
  text:String(c.content||c.text||c.chunkText||''),
  vectorScore:c.vectorScore??null,
  textScore:c.textScore??null,
  hybridScore:c.hybridScore??c.mergedScore??null,
  rerankScore:c.rerankScore??null,
  relevance:scoreOf(c),
  ocrQualityGrade:c.ocrQualityGrade||c.ocrQuality||null,
  contentHash:c.contentHash||contentHash(c.content||c.text||c.chunkText||''),
  rankIndex:i,
})).filter(c=>c.text && c.documentId);

let redundancyRemovedCount=0;
const afterRedundant=[];
const seenIds=new Set();
const seenHash=new Set();
for(const c of normalized){
  if(c.chunkId && seenIds.has(String(c.chunkId))){ redundancyRemovedCount++; continue; }
  if(c.contentHash && seenHash.has(c.contentHash)){ redundancyRemovedCount++; continue; }
  if(enableRedundancy){
    let dup=false;
    for(const p of afterRedundant){
      if(c.chunkKind==='tabular' && p.chunkKind==='tabular'){
        if(c.documentId===p.documentId && c.sheetName===p.sheetName && c.rowStart!=null && p.rowStart!=null && c.rowStart===p.rowStart && c.rowEnd===p.rowEnd){dup=true;break;}
        continue;
      }
      if(overlapRatio(c.text,p.text)>=redundancyThreshold){dup=true;break;}
    }
    if(dup){ redundancyRemovedCount++; continue; }
  }
  if(c.chunkId) seenIds.add(String(c.chunkId));
  if(c.contentHash) seenHash.add(c.contentHash);
  afterRedundant.push(c);
}

const excluded=[];
const candidates=[];
for(const c of afterRedundant){
  const grade=String(c.ocrQualityGrade||'').toUpperCase();
  if(['POOR','FAILED','MANUAL_REVIEW'].includes(grade)){
    excluded.push({...c, exclusionReason:'LOW_OCR_QUALITY'});
    continue;
  }
  // minScore only when scale looks like 0..1 or 0..1000 relevance from hybrid
  if(minScore>0){
    const s=c.relevance;
    const scaled=s>1?s/1000:s;
    if(scaled<minScore && mode!=='LEGACY'){
      excluded.push({...c, exclusionReason:'LOW_SCORE'});
      continue;
    }
  }
  candidates.push(c);
}

function formatBlock(c, index){
  const isTab=c.chunkKind==='tabular' || !!c.sheetName;
  if(isTab){
    return [
      \`[FONTE \${index} — TABELA]\`,
      \`Documento: \${c.documentTitle||'Não informado'}\`,
      \`Setor: \${c.sectorName||'Não informado'}\`,
      \`Categoria: \${c.categoryName||'Não informada'}\`,
      \`Subcategoria: \${c.subcategoryName||'Não informada'}\`,
      \`Vigência: \${c.vigencyDate||'Não informada'}\`,
      \`Aba: \${c.sheetName||'Não informada'}\`,
      (c.rowStart!=null||c.rowEnd!=null) ? \`Linhas: \${c.rowStart??'?'}–\${c.rowEnd??'?'}\` : null,
      'Dados:',
      c.text,
    ].filter(Boolean).join('\\n');
  }
  return [
    \`[FONTE \${index}]\`,
    \`Documento: \${c.documentTitle||'Não informado'}\`,
    \`Setor: \${c.sectorName||'Não informado'}\`,
    \`Categoria: \${c.categoryName||'Não informada'}\`,
    \`Subcategoria: \${c.subcategoryName||'Não informada'}\`,
    \`Vigência: \${c.vigencyDate||'Não informada'}\`,
    'Conteúdo:',
    c.text,
  ].join('\\n');
}

let included=[];
let truncated=false;
let conflictDetected=false;
let neighborsAddedCount=0;

if(mode==='LEGACY'){
  included=candidates.slice(0,maxChunks);
} else {
  const perDoc=new Map();
  let used=0;
  for(const c of candidates){
    if(included.length>=maxChunks){ truncated=true; excluded.push({...c, exclusionReason:'TOKEN_BUDGET'}); continue; }
    const docId=String(c.documentId);
    const n=perDoc.get(docId)||0;
    if(n>=maxPerDoc){ excluded.push({...c, exclusionReason:'DOCUMENT_LIMIT'}); continue; }
    const block=formatBlock(c, included.length+1);
    const cost=estTokens(block)+8;
    if(used+cost>availableContextTokens){
      truncated=true;
      excluded.push({...c, exclusionReason:'TOKEN_BUDGET'});
      continue;
    }
    included.push(c);
    perDoc.set(docId,n+1);
    used+=cost;
  }
}

// Conflict detection (informational)
if(enableConflict && included.length>=2){
  const byDoc=new Map();
  for(const c of included){
    const k=String(c.documentId);
    if(!byDoc.has(k)) byDoc.set(k,{title:c.documentTitle,vigency:c.vigencyDate});
  }
  if(byDoc.size>=2){
    const vals=[...byDoc.values()];
    const vigencies=vals.map(v=>String(v.vigency||'')).filter(Boolean);
    if(new Set(vigencies).size>1) conflictDetected=true;
    else if(byDoc.size>=2) conflictDetected=true; // multiple independent sources
  }
}

const insufficientContext=included.length===0;
let context='';
if(insufficientContext){
  context='[SEM EVIDÊNCIA DOCUMENTAL]\\nNão há trechos documentais suficientes para responder com base na base disponível. Abstenha-se.';
} else {
  const blocks=included.map((c,i)=>formatBlock(c,i+1));
  if(conflictDetected){
    blocks.unshift('[AVISO INTERNO]\\nHá múltiplas evidências documentais potencialmente divergentes. Priorize vigência mais recente e não invente reconciliação.');
  }
  context=blocks.join('\\n\\n------------------------------\\n\\n');
}

const unique=new Map();
for(const s of included){
  if(!s.documentId) continue;
  const e=unique.get(s.documentId);
  if(!e) unique.set(s.documentId,{documentId:s.documentId,documentTitle:s.documentTitle,sectorId:s.sectorId,sectorName:s.sectorName,categoryId:s.categoryId,categoryName:s.categoryName,subcategoryId:s.subcategoryId,subcategoryName:s.subcategoryName,vigencyDate:s.vigencyDate,relevance:s.relevance});
  else if(Number(s.relevance)>Number(e.relevance)) e.relevance=s.relevance;
}
const sources=[...unique.values()].sort((a,b)=>Number(b.relevance)-Number(a.relevance)).map((s,i)=>({
  index:i+1,
  documentId:s.documentId,
  documentTitle:s.documentTitle,
  sectorId:s.sectorId,
  sectorName:s.sectorName,
  categoryId:s.categoryId,
  categoryName:s.categoryName,
  subcategoryId:s.subcategoryId,
  subcategoryName:s.subcategoryName,
  vigencyDate:s.vigencyDate,
  expirationDate:s.vigencyDate??null,
}));

const estimatedContextTokens=estTokens(context);
const includedChunkIds=included.map(c=>c.chunkId||\`\${c.documentId}:\${c.chunkOrder}\`).filter(Boolean);
const excludedChunkIds=excluded.map(c=>c.chunkId||\`\${c.documentId}:\${c.chunkOrder}\`).filter(Boolean);
const includedDocumentIds=[...new Set(included.map(c=>c.documentId).filter(Boolean))];
const sourceDocumentIds=sources.map(s=>s.documentId);

const contextMeta={
  mode,
  configCode:cfgNode.code||'AI_QUERY_CONTEXT',
  configVersionId:cfgNode.versionId||null,
  configVersion:cfgNode.versionLabel||null,
  modelName,
  modelContextLimit,
  inputBudgetTokens:modelContextLimit-reservedResponseTokens,
  reservedResponseTokens,
  reservedPromptTokens:reservedSystemTokens,
  questionTokens,
  availableContextTokens,
  estimatedContextTokens,
  includedChunkCount:included.length,
  excludedChunkCount:excluded.length,
  includedDocumentCount:includedDocumentIds.length,
  sourceCount:sources.length,
  truncated,
  insufficientContext,
  conflictDetected,
  redundancyRemovedCount,
  neighborsAddedCount,
  durationMs:Date.now()-t0,
  fallbackUsed:false,
  fallbackReason:null,
  includedChunkIds,
  excludedChunkIds,
  includedDocumentIds,
  sourceDocumentIds,
  requestId:inp.requestId||null,
  tokenizer:'conservative_char_div_3',
  modeOverrideUsed:!!cfgNode.modeOverrideUsed,
};

const includedChunks=included.map(c=>({chunkId:c.chunkId,documentId:c.documentId,content:c.text,chunkIndex:c.chunkOrder,chunkKind:c.chunkKind,sheetName:c.sheetName,hybridScore:c.hybridScore,rerankScore:c.rerankScore,documentTitle:c.documentTitle}));
const excludedChunks=excluded.map(c=>({chunkId:c.chunkId,documentId:c.documentId,exclusionReason:c.exclusionReason,documentTitle:c.documentTitle}));

return [{json:{
  ok:true,
  context,
  sources,
  includedChunks,
  excludedChunks,
  contextMeta,
  question,
  classification,
  retrievalMeta,
  promptMeta:{
    promptVersionId:promptCfg.promptVersionId||null,
    promptCode:promptCfg.promptCode||null,
    modelName,
    temperature:promptCfg.temperature??null,
    maxTokens:maxOut,
    systemPrompt,
  },
}}];
}catch(err){
  // Fallback: use legacy context if provided
  const inp=$input.first().json||{};
  const legacyContext=String(inp.legacyContext||inp.context||'');
  const legacySources=Array.isArray(inp.sources)?inp.sources:[];
  return [{json:{
    ok:true,
    context:legacyContext,
    sources:legacySources,
    includedChunks:[],
    excludedChunks:[],
    contextMeta:{
      mode:'LEGACY',
      configCode:'AI_QUERY_CONTEXT',
      configVersionId:null,
      configVersion:null,
      modelName:null,
      modelContextLimit:0,
      inputBudgetTokens:0,
      reservedResponseTokens:0,
      reservedPromptTokens:0,
      questionTokens:0,
      availableContextTokens:0,
      estimatedContextTokens:estTokens(legacyContext),
      includedChunkCount:0,
      excludedChunkCount:0,
      includedDocumentCount:legacySources.length,
      sourceCount:legacySources.length,
      truncated:false,
      insufficientContext:!legacyContext,
      conflictDetected:false,
      redundancyRemovedCount:0,
      neighborsAddedCount:0,
      durationMs:Date.now()-t0,
      fallbackUsed:true,
      fallbackReason:String(err&&err.message||err||'context_manager_error').slice(0,200),
      includedChunkIds:[],
      excludedChunkIds:[],
      includedDocumentIds:legacySources.map(s=>s.documentId).filter(Boolean),
      sourceDocumentIds:legacySources.map(s=>s.documentId).filter(Boolean),
      requestId:inp.requestId||null,
    },
    question:inp.question||'',
    classification:inp.classification||{},
    retrievalMeta:inp.retrievalMeta||{},
  }}];
}`;

const cwmNodes = [
  trigger([
    { name: 'question', type: 'string' },
    { name: 'classificationJson', type: 'string' },
    { name: 'selectedChunksJson', type: 'string' },
    { name: 'retrievalMetaJson', type: 'string' },
    { name: 'promptConfigurationJson', type: 'string' },
    { name: 'legacyContext', type: 'string' },
    { name: 'sourcesJson', type: 'string' },
    { name: 'contextConfigVersionId', type: 'string' },
    { name: 'contextConfigOverrideAllowed', type: 'string' },
    { name: 'requestId', type: 'string' },
    { name: 'userId', type: 'string' },
    { name: 'sessionId', type: 'string' },
  ]),
  code(
    'Preparar entrada',
    [220, 0],
    `const t=$input.first().json||{};
let classification={}; try{classification=typeof t.classificationJson==='string'?JSON.parse(t.classificationJson||'{}'):(t.classification||{});}catch(_){classification={};}
let selectedChunks=[]; try{selectedChunks=typeof t.selectedChunksJson==='string'?JSON.parse(t.selectedChunksJson||'[]'):(t.selectedChunks||[]);}catch(_){selectedChunks=[];}
let retrievalMeta={}; try{retrievalMeta=typeof t.retrievalMetaJson==='string'?JSON.parse(t.retrievalMetaJson||'{}'):(t.retrievalMeta||{});}catch(_){retrievalMeta={};}
let promptConfiguration={}; try{promptConfiguration=typeof t.promptConfigurationJson==='string'?JSON.parse(t.promptConfigurationJson||'{}'):(t.promptConfiguration||{});}catch(_){promptConfiguration={};}
let sources=[]; try{sources=typeof t.sourcesJson==='string'?JSON.parse(t.sourcesJson||'[]'):(t.sources||[]);}catch(_){sources=[];}
return [{json:{
  question:String(t.question||'').trim(),
  classification,
  selectedChunks,
  selectedChunksJson:JSON.stringify(selectedChunks),
  retrievalMeta,
  retrievalMetaJson:JSON.stringify(retrievalMeta),
  promptConfiguration,
  promptConfigurationJson:JSON.stringify(promptConfiguration),
  legacyContext:String(t.legacyContext||t.context||''),
  sources,
  sourcesJson:JSON.stringify(sources),
  contextConfigVersionId:String(t.contextConfigVersionId||'').trim(),
  contextConfigOverrideAllowed:String(t.contextConfigOverrideAllowed||'false'),
  requestId:t.requestId||'',
  userId:t.userId||'',
  sessionId:t.sessionId||'',
  startedAtMs:Date.now(),
}}];`,
  ),
  exec(
    'Auditar START',
    [440, 0],
    AUDIT,
    'AUDITORIA - REGISTRAR',
    {
      action: 'AI_CONTEXT_BUILD_STARTED',
      resourceType: 'ai_context',
      resourceId: '={{ $json.requestId || "" }}',
      success: '={{ true }}',
      requestId: '={{ $json.requestId || "" }}',
      userId: '={{ $json.userId || "" }}',
      sessionId: '={{ $json.sessionId || "" }}',
      metadata: '={{ { contextConfigVersionId: $json.contextConfigVersionId || null } }}',
    },
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
  code('Após audit start', [660, 0], `return [$('Preparar entrada').first()];`),
  exec(
    'Carregar context config',
    [880, 0],
    LOAD_ID,
    'IA - CARREGAR CONTEXT CONFIG',
    {
      contextConfigVersionId: '={{ $json.contextConfigVersionId || "" }}',
      contextConfigOverrideAllowed: '={{ $json.contextConfigOverrideAllowed || "false" }}',
      requestId: '={{ $json.requestId || "" }}',
    },
  ),
  code(
    'Após carregar config',
    [1100, 0],
    `const prep=$('Preparar entrada').first().json||{};
const cfg=$input.first().json||{};
if(!cfg.ok){
  return [{json:{...prep, configuration:{}, mode:'LEGACY', versionId:null, versionLabel:null, code:'AI_QUERY_CONTEXT', loadError:cfg.error||cfg.code||'missing'}}];
}
return [{json:{...prep, ...cfg}}];`,
  ),
  code('Montar janela', [1320, 0], cwmAlgo, { onError: 'continueRegularOutput', alwaysOutputData: true }),
  exec(
    'Auditar SUCCESS',
    [1540, 0],
    AUDIT,
    'AUDITORIA - REGISTRAR',
    {
      action: "={{ $json.contextMeta && $json.contextMeta.fallbackUsed ? 'AI_CONTEXT_BUILD_FALLBACK' : 'AI_CONTEXT_BUILD_SUCCESS' }}",
      resourceType: 'ai_context',
      resourceId: '={{ $json.contextMeta && $json.contextMeta.requestId || "" }}',
      success: '={{ true }}',
      requestId: '={{ $json.contextMeta && $json.contextMeta.requestId || "" }}',
      metadata:
        "={{ { mode: $json.contextMeta && $json.contextMeta.mode, configVersion: $json.contextMeta && $json.contextMeta.configVersion, includedChunkCount: $json.contextMeta && $json.contextMeta.includedChunkCount, excludedChunkCount: $json.contextMeta && $json.contextMeta.excludedChunkCount, estimatedContextTokens: $json.contextMeta && $json.contextMeta.estimatedContextTokens, fallbackUsed: !!( $json.contextMeta && $json.contextMeta.fallbackUsed ), insufficientContext: !!( $json.contextMeta && $json.contextMeta.insufficientContext ), durationMs: $json.contextMeta && $json.contextMeta.durationMs } }}",
    },
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
  code('Retorno', [1760, 0], `return [$('Montar janela').first()];`),
];

const cwmConn = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Auditar START', type: 'main', index: 0 }]] },
  'Auditar START': { main: [[{ node: 'Após audit start', type: 'main', index: 0 }]] },
  'Após audit start': { main: [[{ node: 'Carregar context config', type: 'main', index: 0 }]] },
  'Carregar context config': { main: [[{ node: 'Após carregar config', type: 'main', index: 0 }]] },
  'Após carregar config': { main: [[{ node: 'Montar janela', type: 'main', index: 0 }]] },
  'Montar janela': { main: [[{ node: 'Auditar SUCCESS', type: 'main', index: 0 }]] },
  'Auditar SUCCESS': { main: [[{ node: 'Retorno', type: 'main', index: 0 }]] },
};

const CWM_ID = await upsertWorkflow(
  'IA - GERENCIAR JANELA DE CONTEXTO',
  cwmNodes,
  cwmConn,
  'Monta o contexto final dentro do orçamento de tokens',
);

writeFileSync(
  new URL('./_cwm-ids.json', import.meta.url),
  JSON.stringify({ LOAD_ID, VALIDATE_ID, CWM_ID }, null, 2),
);
console.log(JSON.stringify({ LOAD_ID, VALIDATE_ID, CWM_ID }, null, 2));
await client.end();
