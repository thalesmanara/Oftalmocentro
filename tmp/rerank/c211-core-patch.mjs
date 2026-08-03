#!/usr/bin/env node
/**
 * Etapa 21.1 — harden validate, wire lab override, refine conflict, patch metrics helpers.
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';

const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function load(id) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes),
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : structuredClone(rows[0].connections),
  };
}
async function save(wf) {
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id],
  );
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId],
    );
  }
}

// ========== 1) HARDEN VALIDAR ==========
{
  const wf = await load('0289408b8d774379');
  const n = wf.nodes.find((x) => x.name === 'Validar');
  n.parameters.jsCode = `const t=$input.first().json||{};
const fields={};
function err(field,message){fields[field]=message;}
const allowedModes=new Set(['LEGACY','BUDGETED','BUDGETED_WITH_NEIGHBORS']);
const allowedModels=new Set(['gpt-4.1-mini','gpt-4.1','gpt-4o-mini','gpt-4o']);
const allowedKeys=new Set([
  'mode','modelName','contextLimitTokens','maxInputTokens','reservedResponseTokens','reservedSystemTokens',
  'safetyMarginTokens','maxChunks','maxChunksPerDocument','minChunkScore','enableNeighbors','maxNeighborsPerChunk',
  'enableRedundancyRemoval','redundancyThreshold','enableConflictPreservation','tokenizer','notes'
]);
const serverControlled=new Set([
  'id','status','publishedAt','publishedBy','validationRunId','validationScore','contentHash','createdBy',
  'createdAt','secrets','sql','workflowId','activeVersionId'
]);
const mode=String(t.mode||'').toUpperCase();
if(!allowedModes.has(mode)) err('mode','Modo inválido. Use LEGACY, BUDGETED ou BUDGETED_WITH_NEIGHBORS.');
let cfg={};
const rawCfg=t.configurationJson!=null?t.configurationJson:t.configuration;
if(rawCfg==null || rawCfg==='' || (typeof rawCfg==='object' && !Array.isArray(rawCfg) && Object.keys(rawCfg).length===0 && !t.mode)){
  // empty config only invalid if nothing useful provided; still require numeric essentials below via defaults check
}
try{
  if(typeof rawCfg==='string'){
    if(!String(rawCfg).trim()) err('configuration','JSON vazio.');
    else cfg=JSON.parse(rawCfg);
  } else if(rawCfg && typeof rawCfg==='object' && !Array.isArray(rawCfg)){
    cfg={...rawCfg};
  } else if(rawCfg!=null){
    err('configuration','JSON inválido.');
  }
}catch(_){ err('configuration','JSON inválido.'); }

if(cfg && typeof cfg==='object'){
  for(const k of Object.keys(cfg)){
    if(serverControlled.has(k)) err(k,'Campo controlado pelo servidor.');
    else if(!allowedKeys.has(k)) err(k,'Campo desconhecido.');
  }
}
function requireBool(field){
  if(cfg[field]===undefined) return;
  if(typeof cfg[field]!=='boolean') err(field,'Deve ser boolean real (não string).');
}
function requireNumber(field,{min=null,max=null,integer=false,allowZero=true}={}){
  if(cfg[field]===undefined) return null;
  if(typeof cfg[field]==='string') { err(field,'Deve ser número (não string).'); return null; }
  if(typeof cfg[field]!=='number' || Number.isNaN(cfg[field])) { err(field,'Deve ser número.'); return null; }
  if(integer && !Number.isInteger(cfg[field])) err(field,'Deve ser inteiro.');
  if(!allowZero && cfg[field]===0) err(field,'Deve ser positivo.');
  if(min!=null && cfg[field]<min) err(field,'Abaixo do mínimo permitido ('+min+').');
  if(max!=null && cfg[field]>max) err(field,'Acima do máximo permitido ('+max+').');
  return cfg[field];
}
requireBool('enableNeighbors');
requireBool('enableRedundancyRemoval');
requireBool('enableConflictPreservation');
const limit=requireNumber('contextLimitTokens',{min:1024,max:128000,integer:true,allowZero:false});
const reservedResp=requireNumber('reservedResponseTokens',{min:1,max:32000,integer:true,allowZero:false});
const reservedSys=requireNumber('reservedSystemTokens',{min:0,max:32000,integer:true,allowZero:true});
const safety=requireNumber('safetyMarginTokens',{min:0,max:8000,integer:true,allowZero:true});
const maxChunks=requireNumber('maxChunks',{min:1,max:50,integer:true,allowZero:false});
const maxPerDoc=requireNumber('maxChunksPerDocument',{min:1,max:50,integer:true,allowZero:false});
requireNumber('minChunkScore',{min:0,max:1});
requireNumber('redundancyThreshold',{min:0.5,max:1});
const maxNeighbors=requireNumber('maxNeighborsPerChunk',{min:0,max:5,integer:true,allowZero:true});
if(limit!=null && reservedResp!=null && reservedSys!=null && safety!=null){
  if(reservedResp+reservedSys+safety >= limit) err('reservedResponseTokens','Soma das reservas deve ser menor que contextLimitTokens.');
}
if(maxChunks!=null && maxPerDoc!=null && maxPerDoc>maxChunks) err('maxChunksPerDocument','Não pode ser maior que maxChunks.');
if(cfg.enableNeighbors===true && (maxNeighbors==null || maxNeighbors<1) && mode==='BUDGETED_WITH_NEIGHBORS'){
  err('maxNeighborsPerChunk','Obrigatório >=1 quando vizinhos estão ativos.');
}
if(cfg.enableNeighbors===true && mode==='LEGACY'){
  err('enableNeighbors','Vizinhos não são permitidos em LEGACY.');
}
const model=String(t.modelName||cfg.modelName||'').trim();
if(model && !allowedModels.has(model)) err('modelName','Modelo não permitido.');
const label=String(t.versionLabel||'').trim();
if(label.length>80) err('versionLabel','Rótulo muito longo.');
const ok=Object.keys(fields).length===0;
return [{json:{
  ok,
  valid:ok,
  errors: Object.entries(fields).map(([field,message])=>({field,message})),
  fields,
  code: ok? 'OK':'VALIDATION_ERROR',
  mode,
  configuration:cfg,
  modelName:model||null,
  versionLabel:label||null,
}}];`;
  await save(wf);
  console.log('VALIDAR hardened');
}

// ========== 2) WIRE LAB OVERRIDE ==========
{
  // EXECUTAR TESTE
  const wf = await load('KdpEmEGHNlPICOa4');
  const trigger = wf.nodes.find((n) => n.name === 'Trigger');
  const values = trigger.parameters.workflowInputs.values;
  if (!values.some((v) => v.name === 'contextConfigVersionId')) {
    values.push({ name: 'contextConfigVersionId', type: 'string' });
  }
  const call = wf.nodes.find((n) => n.name === 'Chamar Consulta IA');
  // Replace jsonBody to include context override + internal flag
  call.parameters.jsonBody = `={{ JSON.stringify(Object.assign(
  { question: $json.question },
  $json.prompt_version_id ? { promptVersionId: $json.prompt_version_id } : {},
  $('Trigger').first().json.retrievalConfigVersionId ? { retrievalConfigVersionId: $('Trigger').first().json.retrievalConfigVersionId, modeOverrideAllowed: true } : {},
  $('Trigger').first().json.contextConfigVersionId ? { contextConfigVersionId: $('Trigger').first().json.contextConfigVersionId, contextConfigOverrideAllowed: true } : {}
)) }}`;
  await save(wf);
  console.log('EXECUTAR TESTE wired');
}
{
  // EXECUTAR DATASET
  const wf = await load('12t0Ol6zWQJgAKPC');
  const trigger = wf.nodes.find((n) => n.name === 'Trigger');
  const values = trigger.parameters.workflowInputs.values;
  if (!values.some((v) => v.name === 'contextConfigVersionId')) {
    values.push({ name: 'contextConfigVersionId', type: 'string' });
  }
  const execCaso = wf.nodes.find((n) => n.name === 'Executar caso');
  execCaso.parameters.workflowInputs.value.contextConfigVersionId =
    "={{ $('Trigger').first().json.contextConfigVersionId || '' }}";
  // Patch Inserir run SQL to store context override columns if present
  const inserir = wf.nodes.find((n) => n.name === 'Inserir run');
  if (inserir?.parameters?.query && !inserir.parameters.query.includes('context_config_version_id')) {
    inserir.parameters.query = inserir.parameters.query
      .replace(
        'mode_override_used)',
        'mode_override_used, context_config_version_id, context_mode_override_used)',
      )
      .replace(
        /RETURNING([\s\S]*)$/i,
        ` ,
  NULLIF(TRIM('{{ $json.contextConfigVersionId || "" }}'),'')::uuid,
  CASE WHEN NULLIF(TRIM('{{ $json.contextConfigVersionId || "" }}'),'') IS NOT NULL THEN true ELSE false END
RETURNING$1`,
      );
    // The replace above may be fragile - do a safer append before RETURNING
    if (!inserir.parameters.query.includes('context_config_version_id')) {
      console.log('WARN: could not patch Inserir run SQL automatically');
    } else {
      // fix botched RETURNING if needed
      inserir.parameters.query = inserir.parameters.query.replace('RETURNING$1', 'RETURNING id, status, started_at, prompt_version, model_name, prompt_version_id, retrieval_mode, retrieval_config_version, retrieval_config_version_id, mode_override_used, context_config_version_id, context_mode_override_used');
    }
  }
  await save(wf);
  console.log('EXECUTAR DATASET wired');
}
{
  // run-dataset webhook
  const wf = await load('wTH2YV6pIlhzWDiY');
  const exec = wf.nodes.find((n) => n.name === 'Executar dataset');
  exec.parameters.workflowInputs.value.contextConfigVersionId =
    "={{ ($json.body && $json.body.contextConfigVersionId) || ($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.contextConfigVersionId) || ($('Webhook').first().json.body && $('Webhook').first().json.body.contextConfigVersionId) || '' }}";
  await save(wf);
  console.log('run-dataset wired');
}
{
  // run-case webhook
  const wf = await load('qVH5qtBf8IY32uiH');
  const exec = wf.nodes.find((n) => n.name === 'Executar dataset' || n.name.includes('Executar'));
  if (exec?.parameters?.workflowInputs?.value) {
    exec.parameters.workflowInputs.value.contextConfigVersionId =
      "={{ ($json.body && $json.body.contextConfigVersionId) || ($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.contextConfigVersionId) || ($('Webhook').first().json.body && $('Webhook').first().json.body.contextConfigVersionId) || '' }}";
    await save(wf);
    console.log('run-case wired', exec.name);
  } else {
    console.log('run-case exec node missing inputs');
  }
}

// ========== 3) REFINE CONFLICT in CWM ==========
{
  const wf = await load('e95a92295d7c4deb');
  const montar = wf.nodes.find((n) => n.name === 'Montar janela');
  let code = montar.parameters.jsCode;
  // Replace conflict detection block
  const oldConflict = `// Conflict detection (informational)
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
}`;

  const newConflict = `// Conflict detection — deterministic, not "multiple sources"
let conflictType='NO_CONFLICT';
let conflictDocumentIds=[];
let preferredDocumentId=null;
let conflictReasonCode=null;
function extractSignals(text){
  const t=String(text||'');
  const money=[...t.matchAll(/R\\$\\s*([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+)/g)].map(m=>m[1]);
  const cpf=[...t.matchAll(/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/g)].map(m=>m[0].replace(/\\D/g,''));
  const crm=[...t.matchAll(/\\bCRM\\s*[:#-]?\\s*([0-9]{3,7})\\b/gi)].map(m=>m[1]);
  const codes=[...t.matchAll(/\\b([A-Z]{2,5}-?\\d{2,6})\\b/g)].map(m=>m[1]);
  const bools=[];
  if(/\\b(sim|ativo|vigente|aprovado)\\b/i.test(t)) bools.push('POS');
  if(/\\b(não|nao|inativo|vencido|reprovado|suspenso)\\b/i.test(t)) bools.push('NEG');
  return {money,cpf,crm,codes,bools};
}
if(enableConflict && included.length>=2){
  const byDoc=new Map();
  for(const c of included){
    const k=String(c.documentId);
    if(!byDoc.has(k)) byDoc.set(k,{id:k,title:c.documentTitle||'',vigency:c.vigencyDate||null,updated:c.documentUpdatedAt||null,text:c.text||'',relevance:c.relevance||0});
    else byDoc.get(k).text += '\\n' + (c.text||'');
  }
  const docs=[...byDoc.values()];
  // Confirmed: same key with different values across docs
  const keyMaps={cpf:new Map(),crm:new Map(),money:new Map(),code:new Map()};
  for(const d of docs){
    const s=extractSignals(d.text);
    for(const v of s.cpf){ if(!keyMaps.cpf.has(v)) keyMaps.cpf.set(v,new Set()); keyMaps.cpf.get(v).add(d.id); }
    for(const v of s.crm){ if(!keyMaps.crm.has(v)) keyMaps.crm.set(v,new Set()); keyMaps.crm.get(v).add(d.id); }
    for(const v of s.money){ if(!keyMaps.money.has(v)) keyMaps.money.set(v,new Set()); keyMaps.money.get(v).add(d.id); }
    for(const v of s.codes){ if(!keyMaps.code.has(v)) keyMaps.code.set(v,new Set()); keyMaps.code.get(v).add(d.id); }
  }
  // different money values present with overlapping domain (>=2 docs with money)
  const moneyDocs=new Set(); for(const set of keyMaps.money.values()) for(const id of set) moneyDocs.add(id);
  if(keyMaps.money.size>=2 && moneyDocs.size>=2){
    conflictType='CONFIRMED_CONFLICT'; conflictReasonCode='DIVERGENT_MONETARY_VALUES';
    conflictDocumentIds=[...moneyDocs];
  }
  // potential: same normalized title theme + divergent vigency
  if(conflictType==='NO_CONFLICT'){
    const vigDocs=docs.filter(d=>d.vigency);
    const vigSet=new Set(vigDocs.map(d=>String(d.vigency).slice(0,10)));
    if(vigDocs.length>=2 && vigSet.size>=2){
      // only if titles share a significant token
      const tokens=vigDocs.map(d=>String(d.title||'').toLowerCase().split(/[^a-z0-9à-ü]+/).filter(x=>x.length>4));
      let share=false;
      for(let i=0;i<tokens.length;i++) for(let j=i+1;j<tokens.length;j++){
        if(tokens[i].some(t=>tokens[j].includes(t))) share=true;
      }
      if(share){
        conflictType='POTENTIAL_CONFLICT'; conflictReasonCode='DIVERGENT_VIGENCY';
        conflictDocumentIds=vigDocs.map(d=>d.id);
      }
    }
  }
  // potential: POS vs NEG boolean signals across docs on same codes
  if(conflictType==='NO_CONFLICT'){
    const pos=[], neg=[];
    for(const d of docs){
      const s=extractSignals(d.text);
      if(s.bools.includes('POS')) pos.push(d.id);
      if(s.bools.includes('NEG')) neg.push(d.id);
    }
    if(pos.length && neg.length && [...new Set([...pos,...neg])].length>=2){
      conflictType='POTENTIAL_CONFLICT'; conflictReasonCode='OPPOSING_STATUS';
      conflictDocumentIds=[...new Set([...pos,...neg])];
    }
  }
  conflictDetected = conflictType==='POTENTIAL_CONFLICT' || conflictType==='CONFIRMED_CONFLICT';
  if(conflictDetected){
    // preferred = highest relevance then newest vigency
    const ranked=[...docs].sort((a,b)=>{
      const vr=(Date.parse(b.vigency||0)||0)-(Date.parse(a.vigency||0)||0);
      if(vr) return vr;
      return Number(b.relevance||0)-Number(a.relevance||0);
    });
    preferredDocumentId=ranked[0]?.id||null;
  }
}`;

  if (code.includes(oldConflict)) {
    code = code.replace(oldConflict, newConflict);
  } else if (!code.includes("conflictType='NO_CONFLICT'") && !code.includes('conflictType="NO_CONFLICT"')) {
    // try softer insert before insufficientContext
    code = code.replace(
      'const insufficientContext=included.length===0;',
      newConflict + '\nconst insufficientContext=included.length===0;',
    );
  }

  // extend contextMeta with conflict fields and utilization helpers
  if (!code.includes('conflictType')) {
    code = code.replace(
      'conflictDetected,',
      `conflictDetected,
  conflictType,
  conflictDocumentIds,
  preferredDocumentId,
  conflictReasonCode,`,
    );
  } else {
    // ensure meta includes them
    code = code.replace(
      'conflictDetected,\n  redundancyRemovedCount',
      `conflictDetected,
  conflictType,
  conflictDocumentIds,
  preferredDocumentId,
  conflictReasonCode,
  redundancyRemovedCount`,
    );
  }

  // Fix aviso interno to only when conflictDetected
  code = code.replace(
    `if(conflictDetected){
    blocks.unshift('[AVISO INTERNO]\\nHá múltiplas evidências documentais potencialmente divergentes. Priorize vigência mais recente e não invente reconciliação.');
  }`,
    `if(conflictDetected){
    blocks.unshift('[AVISO INTERNO]\\nConflito documental '+conflictType+' ('+(conflictReasonCode||'n/d')+'). Priorize o documento vigente mais recente e preserve evidências divergentes sem inventar reconciliação.');
  }`,
  );

  montar.parameters.jsCode = code;
  await save(wf);
  console.log('CWM conflict refined', code.includes('CONFIRMED_CONFLICT'));
}

// ensure migration columns for runs
await client.query(`
ALTER TABLE ai_test_runs
  ADD COLUMN IF NOT EXISTS context_config_version_id uuid,
  ADD COLUMN IF NOT EXISTS context_mode_override_used boolean DEFAULT false;
ALTER TABLE ai_test_results
  ADD COLUMN IF NOT EXISTS relevant_context_rate numeric,
  ADD COLUMN IF NOT EXISTS source_coverage numeric,
  ADD COLUMN IF NOT EXISTS redundancy_rate numeric,
  ADD COLUMN IF NOT EXISTS overflow_detected boolean,
  ADD COLUMN IF NOT EXISTS empty_context boolean,
  ADD COLUMN IF NOT EXISTS source_count integer,
  ADD COLUMN IF NOT EXISTS conflict_type text;
`);

writeFileSync(new URL('./_c211-core-patch.json', import.meta.url), JSON.stringify({ ok: true }, null, 2));
await client.end();
