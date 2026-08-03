#!/usr/bin/env node
/**
 * Etapa 22 — create IA - CACHE RUNTIME + wire Consulta IA (SHADOW).
 */
import pg from 'pg';
import { randomUUID, createHash } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const CONSULTA = '8EXk5RkFW5cxnenL';
const RUNTIME_ID = 'c22CacheRuntime0001';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function upsertWorkflow({ id, name, nodes, connections, active = true }) {
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  const exists = await client.query(`SELECT id FROM workflow_entity WHERE id=$1`, [id]);
  await client.query('BEGIN');
  if (!exists.rowCount) {
    await client.query(
      `INSERT INTO workflow_entity (id,name,active,nodes,connections,"versionId","activeVersionId","createdAt","updatedAt",settings,"isArchived")
       VALUES ($1,$2,false,$3::json,$4::json,$5::varchar,NULL,NOW(),NOW(),'{}'::json,false)`,
      [id, name, nodesJson, connJson, versionId],
    );
    try {
      await client.query(
        `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
         VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
        [id, PROJECT],
      );
    } catch (_) {}
  }
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22',$3::json,$4::json,$5,'Etapa 22',false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  console.log('WF', name, id, versionId);
  return versionId;
}

const prepareCode = `const crypto = require('crypto');
const sha256=(s)=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const canonical=(v)=>{if(v===null||v===undefined)return'null';if(typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';const ks=Object.keys(v).sort();return'{'+ks.map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';};
const normalizeQuestion=(raw)=>{let q=String(raw||'').normalize('NFKC').trim().toLowerCase();q=q.replace(/[?!.,;:]+$/g,'');q=q.replace(/[^\\p{L}\\p{N}\\s\\-./@]+/gu,' ');return q.replace(/\\s+/g,' ').trim();};
const detectSensitive=(s)=>{s=String(s||'');return/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/.test(s)||/CRM[-\\s]?\\d{2,}/i.test(s)||/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i.test(s)||/prontu[aá]rio|sal[aá]rio|remunera/i.test(s);};
const redact=(q)=>String(q||'').replace(/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/g,'[CPF]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi,'[EMAIL]');
const t=$input.first().json||{};
const parse=(s,fb)=>{try{return typeof s==='string'&&s?JSON.parse(s):(s??fb);}catch(_){return fb;}};
const operation=String(t.operation||'lookup').toLowerCase();
const question=String(t.question||'');
const classification=parse(t.classificationJson,{});
const sources=parse(t.sourcesJson,[]);
const documentVersions=parse(t.documentVersionsJson,sources);
const contextMeta=parse(t.contextMetaJson,{});
const retrievalMeta=parse(t.retrievalMetaJson,{});
const permissions=parse(t.permissionsJson,[]);
const isMaster=t.isMaster===true||t.isMaster==='true';
const normalizedQuestion=normalizeQuestion(question);
const sensitive=detectSensitive(question);
const scopeHash=sha256(canonical({isMaster,permissions:[...new Set(permissions.map(p=>String(p).toLowerCase()))].sort(),sectorId:t.sectorId||null,environment:'production',scopeMode:'PERMISSION_SET'}));
const fpList=(Array.isArray(documentVersions)?documentVersions:[]).map(d=>({documentId:String(d.documentId||d.document_id||d.id||''),documentVersionId:String(d.documentVersionId||d.document_version_id||d.versionId||''),versionNumber:d.versionNumber??d.version_number??null,contentHash:String(d.contentHash||d.content_hash||''),updatedAt:d.updatedAt||d.updated_at||null,isCurrent:d.isCurrent??d.is_current??true,expirationDate:d.expirationDate||d.expiration_date||null})).filter(d=>d.documentId).sort((a,b)=>(a.documentId+':'+a.documentVersionId).localeCompare(b.documentId+':'+b.documentVersionId));
const sourceFingerprint=sha256(canonical(fpList));
const promptVersionId=String(t.promptVersionId||'');
const promptHash=String(t.promptHash||'');
const retrievalConfigVersionId=t.retrievalConfigVersionId||retrievalMeta.configVersionId||null;
const retrievalConfigHash=t.retrievalConfigHash||retrievalMeta.contentHash||null;
const contextConfigVersionId=t.contextConfigVersionId||contextMeta.configVersionId||null;
const contextConfigHash=t.contextConfigHash||null;
const modelName=String(t.modelName||'gpt-4.1-mini');
const modelParametersHash=String(t.modelParametersHash||'');
const cacheKeyHash=sha256(canonical({cacheSchemaVersion:'v1',normalizedQuestion,questionType:null,classification,scopeHash,promptVersionId,promptContentHash:promptHash,retrievalConfigVersionId,retrievalConfigHash,contextConfigVersionId,contextConfigHash,modelName,modelParametersHash,sourceFingerprint,systemVersion:'oftalmocentro-v1'}));
const questionHash=sha256(normalizedQuestion);
return [{json:{
  operation,question,classification,sources,documentVersions,contextMeta,retrievalMeta,
  permissions,isMaster,sectorId:t.sectorId||null,requestId:String(t.requestId||''),
  answer:String(t.answer||''),
  preparedIn:parse(t.preparedJson,null),
  cacheMetaIn:parse(t.cacheMetaJson,null),
  candidateAnswer:t.candidateAnswer||null,
  candidateSources:parse(t.candidateSourcesJson,null),
  configurationIn:parse(t.configurationJson,null),
  cacheConfigVersionId:t.cacheConfigVersionId||null,
  reason:String(t.reason||'MANUAL'),
  documentId:t.documentId||null,
  normalizedQuestion:sensitive?redact(normalizedQuestion):normalizedQuestion,
  questionHash,scopeHash,sourceFingerprint,cacheKeyHash,sensitive,
  promptVersionId,promptHash,retrievalConfigVersionId,retrievalConfigHash,
  contextConfigVersionId,contextConfigHash,modelName,modelParametersHash,
  conflictDetected:!!(contextMeta.conflictDetected),
  insufficientContext:!!(contextMeta.insufficientContext),
  fallbackUsed:!!(contextMeta.fallbackUsed),
  documentVersionIds:fpList.map(d=>d.documentVersionId).filter(Boolean),
  sourceDocumentIds:fpList.map(d=>d.documentId).filter(Boolean),
  startedAtMs:Date.now(),
}}];`;

const decideCode = `const crypto=require('crypto');
const sha256=(s)=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const normAns=(a)=>String(a||'').normalize('NFKC').trim().toLowerCase().replace(/\\s+/g,' ');
const answersAgree=(a,b)=>{const na=normAns(a),nb=normAns(b);if(!na||!nb)return false;if(na===nb)return true;const s=na.length<=nb.length?na:nb,l=na.length>nb.length?na:nb;return l.includes(s)&&s.length/l.length>=0.85;};
const sourcesAgree=(a,b)=>{const A=new Set((Array.isArray(a)?a:[]).map(x=>String(x.documentId||x.document_id||x.id||'')).filter(Boolean));const B=new Set((Array.isArray(b)?b:[]).map(x=>String(x.documentId||x.document_id||x.id||'')).filter(Boolean));if(!A.size&&!B.size)return true;if(!A.size||!B.size)return false;let i=0;for(const id of A)if(B.has(id))i++;return i/new Set([...A,...B]).size>=0.8;};
const prep=$('Preparar entrada').first().json||{};
const cfgRow=$('Load config').first().json||{};
let configuration={};try{configuration=typeof cfgRow.configuration==='string'?JSON.parse(cfgRow.configuration):(cfgRow.configuration||{});}catch(_){configuration={};}
if(prep.configurationIn) configuration={...configuration,...prep.configurationIn};
const mode=String(configuration.mode||cfgRow.mode||'SHADOW').toUpperCase();
const versionLabel=cfgRow.version_label||'cache-shadow-v1';
const versionId=cfgRow.id||null;
const t0=Number(prep.startedAtMs||Date.now());
const latency=()=>Date.now()-t0;
const baseMeta=(extra={})=>({mode,configVersion:versionLabel,configVersionId:versionId,lookupPerformed:false,hit:false,hitType:null,missReason:null,lookupLatencyMs:latency(),semanticSimilarity:null,entryAgeSeconds:null,scopeHashMatched:true,sourceFingerprintMatched:false,answerFromCache:false,shadowCandidateFound:false,shadowAgreement:null,estimatedTokensSaved:0,estimatedCostSaved:0,estimatedLatencySavedMs:0,fallbackUsed:false,fallbackReason:null,requestId:prep.requestId||'',...extra});

try{
if(prep.operation==='validateconfig'){
  const raw=prep.configurationIn||{};
  const errors=[];
  const modes=['DISABLED','SHADOW','EXACT_ONLY','NORMALIZED','SEMANTIC'];
  const m=String(raw.mode||'').toUpperCase();
  if(!modes.includes(m)) errors.push({field:'mode',message:'mode inválido'});
  if(typeof raw.ttlSeconds==='string'||!Number.isFinite(Number(raw.ttlSeconds))||Number(raw.ttlSeconds)<=0) errors.push({field:'ttlSeconds',message:'TTL inválido'});
  if(raw.semanticEnabled===true){const thr=Number(raw.semanticThreshold); if(!Number.isFinite(thr)||thr<0.8||thr>0.99) errors.push({field:'semanticThreshold',message:'threshold inválido'});}
  for(const b of ['exactEnabled','normalizedEnabled','semanticEnabled','cacheNegativeAnswers','cacheInsufficientContext','cacheConflictResponses','cacheSensitiveQueries','requireSameSources','requireSameDocumentVersions','requireSamePromptVersion','requireSameRetrievalVersion','requireSameContextVersion','requireSameModel']){
    if(raw[b]!==undefined && typeof raw[b]!=='boolean') errors.push({field:b,message:'deve ser boolean real'});
  }
  for(const n of ['maxEntries','maxEntriesPerScope']){ if(raw[n]!==undefined && (typeof raw[n]==='string'||!Number.isFinite(Number(raw[n]))||Number(raw[n])<1)) errors.push({field:n,message:'deve ser número >=1'});}
  if(raw.cacheConflictResponses===true) errors.push({field:'cacheConflictResponses',message:'deve ser false'});
  if(raw.cacheInsufficientContext===true) errors.push({field:'cacheInsufficientContext',message:'deve ser false'});
  const known=new Set(['mode','exactEnabled','normalizedEnabled','semanticEnabled','semanticThreshold','ttlSeconds','maxEntries','maxEntriesPerScope','cacheNegativeAnswers','cacheInsufficientContext','cacheConflictResponses','cacheSensitiveQueries','requireSameSources','requireSameDocumentVersions','requireSamePromptVersion','requireSameRetrievalVersion','requireSameContextVersion','requireSameModel','scopeMode','cacheSchemaVersion','qdrantCollection','notes']);
  for(const k of Object.keys(raw||{})) if(!known.has(k)) errors.push({field:k,message:'campo desconhecido'});
  return [{json:{ok:errors.length===0,errors,configuration:raw,contentHash:sha256(JSON.stringify(raw)),mode:m,cacheMeta:baseMeta({missReason:'OTHER'})}}];
}

if(prep.operation==='invalidate'){
  return [{json:{doInvalidate:true,reason:prep.reason||'MANUAL',documentId:prep.documentId,promptVersionId:prep.promptVersionId,retrievalConfigVersionId:prep.retrievalConfigVersionId,contextConfigVersionId:prep.contextConfigVersionId,cacheMeta:baseMeta(),auditAction:'AI_CACHE_INVALIDATE'}}];
}
if(prep.operation==='cleanup'){
  return [{json:{doCleanup:true,maxEntries:Number(configuration.maxEntries||5000),cacheMeta:baseMeta(),auditAction:'AI_CACHE_EXPIRE'}}];
}

if(prep.operation==='lookup'){
  if(mode==='DISABLED') return [{json:{serveFromCache:false,cacheMeta:baseMeta({lookupPerformed:false,missReason:'CACHE_DISABLED'}),prepared:{...prep,versionId,versionLabel,mode,ttlSeconds:Number(configuration.ttlSeconds||86400)},doSave:false}}];
  const entry=$('Lookup exact').first()?.json||{};
  const found=!!(entry&&entry.id&&entry.cache_key_hash);
  let missReason=null, hit=false, hitType=null, entryAgeSeconds=null, sourceFingerprintMatched=false, scopeHashMatched=true;
  if(!found) missReason='NOT_FOUND';
  else {
    entryAgeSeconds=Math.max(0,Math.floor((Date.now()-new Date(entry.created_at).getTime())/1000));
    if(entry.status!=='VALID') missReason=entry.status==='EXPIRED'?'EXPIRED':(entry.status==='INVALIDATED'?'INVALIDATED':'QUARANTINED');
    else if(new Date(entry.expires_at).getTime()<=Date.now()) missReason='EXPIRED';
    else if(String(entry.scope_hash)!==String(prep.scopeHash)){missReason='SCOPE_MISMATCH';scopeHashMatched=false;}
    else if(configuration.requireSamePromptVersion!==false && String(entry.prompt_version_id)!==String(prep.promptVersionId)) missReason='PROMPT_VERSION_CHANGED';
    else if(configuration.requireSameRetrievalVersion!==false && String(entry.retrieval_config_version_id||'')!==String(prep.retrievalConfigVersionId||'')) missReason='RETRIEVAL_VERSION_CHANGED';
    else if(configuration.requireSameContextVersion!==false && String(entry.context_config_version_id||'')!==String(prep.contextConfigVersionId||'')) missReason='CONTEXT_VERSION_CHANGED';
    else if(configuration.requireSameModel!==false && String(entry.model_name)!==String(prep.modelName)) missReason='MODEL_CHANGED';
    else if(configuration.requireSameSources!==false && String(entry.source_fingerprint)!==String(prep.sourceFingerprint)) missReason='SOURCE_FINGERPRINT_CHANGED';
    else if(entry.conflict_detected) missReason='CONFLICT_RESPONSE_NOT_CACHEABLE';
    else if(entry.insufficient_context) missReason='INSUFFICIENT_CONTEXT_NOT_CACHEABLE';
    else if(entry.contains_sensitive_data || (prep.sensitive && configuration.cacheSensitiveQueries!==true)) missReason='SENSITIVE_QUERY_NOT_CACHEABLE';
    else {hit=true;hitType='EXACT';sourceFingerprintMatched=true;}
  }
  const serveFromCache = hit && ['EXACT_ONLY','NORMALIZED','SEMANTIC'].includes(mode) && !prep.sensitive;
  const shadowCandidateFound = mode==='SHADOW' && hit;
  const cacheMeta=baseMeta({
    lookupPerformed:true,
    hit:serveFromCache,
    hitType:serveFromCache?hitType:null,
    missReason:serveFromCache?null:(shadowCandidateFound?'SHADOW_MODE':(missReason||'NOT_FOUND')),
    entryAgeSeconds, scopeHashMatched, sourceFingerprintMatched,
    answerFromCache:serveFromCache,
    shadowCandidateFound,
    estimatedLatencySavedMs:serveFromCache?800:0,
    estimatedTokensSaved:serveFromCache?500:0,
  });
  let sources=entry.sources; try{if(typeof sources==='string') sources=JSON.parse(sources);}catch(_){sources=[];}
  return [{json:{
    serveFromCache,
    cachedAnswer:serveFromCache?entry.answer:null,
    cachedSources:serveFromCache?sources:null,
    candidateEntryId:found?entry.id:null,
    candidateAnswer:found?entry.answer:null,
    candidateSources:found?sources:null,
    cacheMeta,
    prepared:{cacheKeyHash:prep.cacheKeyHash,questionHash:prep.questionHash,scopeHash:prep.scopeHash,sourceFingerprint:prep.sourceFingerprint,sensitive:prep.sensitive,normalizedQuestion:prep.normalizedQuestion,classificationHash:sha256(JSON.stringify(prep.classification||{})),promptVersionId:prep.promptVersionId,promptHash:prep.promptHash,retrievalConfigVersionId:prep.retrievalConfigVersionId,retrievalConfigHash:prep.retrievalConfigHash,contextConfigVersionId:prep.contextConfigVersionId,contextConfigHash:prep.contextConfigHash,modelName:prep.modelName,modelParametersHash:prep.modelParametersHash,conflictDetected:prep.conflictDetected,insufficientContext:prep.insufficientContext,fallbackUsed:prep.fallbackUsed,documentVersionIds:prep.documentVersionIds,sourceDocumentIds:prep.sourceDocumentIds,versionId,versionLabel,mode,ttlSeconds:Number(configuration.ttlSeconds||86400)},
    doSave:false,
    doBumpHit:serveFromCache||shadowCandidateFound,
    entryId:found?entry.id:null,
    auditAction:serveFromCache?'AI_CACHE_HIT':(shadowCandidateFound?'AI_CACHE_SHADOW_MATCH':'AI_CACHE_MISS'),
  }}];
}

if(prep.operation==='save'){
  const prepared=prep.preparedIn||{};
  const answer=String(prep.answer||'');
  const outSources=Array.isArray(prep.sources)?prep.sources:[];
  const lookupMeta=prep.cacheMetaIn||{};
  let answerAgreement=null, sourceAgreement=null, shadowAgreement=null, falseHit=false;
  if(lookupMeta.shadowCandidateFound && prep.candidateAnswer!=null){
    answerAgreement=answersAgree(answer, prep.candidateAnswer);
    sourceAgreement=sourcesAgree(outSources, prep.candidateSources);
    shadowAgreement=!!(answerAgreement&&sourceAgreement);
    falseHit=!(answerAgreement&&sourceAgreement);
  }
  const canSave=!!answer && !prepared.sensitive && !prepared.conflictDetected && !prepared.insufficientContext && !prepared.fallbackUsed && !!prepared.cacheKeyHash && !!prepared.sourceFingerprint;
  const cacheMeta=baseMeta({
    lookupPerformed:!!lookupMeta.lookupPerformed,
    missReason:lookupMeta.missReason||null,
    shadowCandidateFound:!!lookupMeta.shadowCandidateFound,
    shadowAgreement, answerFromCache:false,
    sourceFingerprintMatched:!!lookupMeta.sourceFingerprintMatched,
    entryAgeSeconds:lookupMeta.entryAgeSeconds??null,
  });
  cacheMeta.answerAgreement=answerAgreement;
  cacheMeta.sourceAgreement=sourceAgreement;
  cacheMeta.falseHit=falseHit;
  if(!canSave){
    cacheMeta.saved=false;
    cacheMeta.saveSkippedReason=prepared.sensitive?'SENSITIVE_QUERY_NOT_CACHEABLE':prepared.conflictDetected?'CONFLICT_RESPONSE_NOT_CACHEABLE':prepared.insufficientContext?'INSUFFICIENT_CONTEXT_NOT_CACHEABLE':prepared.fallbackUsed?'FALLBACK_NOT_CACHEABLE':'NOT_CACHEABLE';
    return [{json:{doSave:false,cacheMeta,metrics:{falseHit,shadowAgreement,answerAgreement,sourceAgreement}}}];
  }
  const ttl=Number(prepared.ttlSeconds||86400);
  return [{json:{
    doSave:true,
    cacheMeta:{...cacheMeta,saved:true},
    saveRow:{
      cache_key_hash:prepared.cacheKeyHash,
      question_hash:prepared.questionHash,
      normalized_question:prepared.normalizedQuestion,
      scope_hash:prepared.scopeHash,
      classification_hash:prepared.classificationHash||'',
      prompt_version_id:prepared.promptVersionId,
      prompt_hash:prepared.promptHash||'',
      retrieval_config_version_id:prepared.retrievalConfigVersionId,
      retrieval_config_hash:prepared.retrievalConfigHash,
      context_config_version_id:prepared.contextConfigVersionId,
      context_config_hash:prepared.contextConfigHash,
      model_name:prepared.modelName,
      model_parameters_hash:prepared.modelParametersHash||'',
      source_fingerprint:prepared.sourceFingerprint,
      document_version_ids:JSON.stringify(prepared.documentVersionIds||[]),
      source_document_ids:JSON.stringify(prepared.sourceDocumentIds||[]),
      answer,
      sources:JSON.stringify(outSources),
      classification:JSON.stringify(prep.classification||{}),
      response_hash:sha256(normAns(answer)),
      ttl,
      conflict_detected:!!prepared.conflictDetected,
      insufficient_context:!!prepared.insufficientContext,
      contains_sensitive_data:!!prepared.sensitive,
      cache_config_version_id:prepared.versionId,
    },
    metrics:{falseHit,shadowAgreement,answerAgreement,sourceAgreement},
    auditAction:'AI_CACHE_SAVE',
  }}];
}

return [{json:{serveFromCache:false,cacheMeta:baseMeta({fallbackUsed:true,fallbackReason:'UNKNOWN_OPERATION',missReason:'OTHER'}),doSave:false}}];
}catch(err){
  return [{json:{serveFromCache:false,cacheMeta:baseMeta({fallbackUsed:true,fallbackReason:'CACHE_RUNTIME_ERROR',missReason:'OTHER'}),doSave:false,errorCode:'CACHE_RUNTIME_ERROR'}}];
}`;

const nodes = [
  {
    id: randomUUID(),
    name: 'Trigger',
    type: 'n8n-nodes-base.executeWorkflowTrigger',
    typeVersion: 1.1,
    position: [0, 0],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          'operation','question','classificationJson','sourcesJson','documentVersionsJson','contextMetaJson','retrievalMetaJson',
          'promptVersionId','promptHash','retrievalConfigVersionId','retrievalConfigHash','contextConfigVersionId','contextConfigHash',
          'modelName','modelParametersHash','permissionsJson','isMaster','sectorId','requestId','answer','preparedJson','cacheMetaJson',
          'candidateAnswer','candidateSourcesJson','configurationJson','reason','documentId','cacheConfigVersionId',
        ].map((name) => ({ name, type: 'string' })),
      },
    },
  },
  {
    id: randomUUID(),
    name: 'Preparar entrada',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [240, 0],
    parameters: { jsCode: prepareCode },
  },
  {
    id: randomUUID(),
    name: 'Load config',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [480, 0],
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const id = String($json.cacheConfigVersionId || '').trim();
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    return "SELECT id, version_label, mode, status, configuration FROM ai_cache_config_versions WHERE id='" + id + "' LIMIT 1";
  }
  return "SELECT id, version_label, mode, status, configuration FROM ai_cache_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1";
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Lookup exact',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [720, 0],
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const op = String($('Preparar entrada').first().json.operation || '');
  if (op !== 'lookup') return "SELECT NULL::uuid AS id WHERE false";
  const h = String($('Preparar entrada').first().json.cacheKeyHash || '').replace(/'/g, "''");
  if (!h) return "SELECT NULL::uuid AS id WHERE false";
  return "SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id, model_name, source_fingerprint, answer, sources, status, expires_at, created_at, conflict_detected, insufficient_context, contains_sensitive_data, hit_count FROM ai_semantic_cache_entries WHERE cache_key_hash='" + h + "' LIMIT 1";
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Decidir',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [960, 0],
    parameters: { jsCode: decideCode },
  },
  {
    id: randomUUID(),
    name: 'Persistir se necessário',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [1200, 0],
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const j = $json;
  if (j.doSave && j.saveRow) {
    const r = j.saveRow;
    const esc = (v) => v == null ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
    const escJ = (v) => v == null ? "'[]'::jsonb" : ("'" + String(v).replace(/'/g, "''") + "'::jsonb");
    return \`INSERT INTO ai_semantic_cache_entries (
      cache_key_hash, question_hash, normalized_question, scope_hash, classification_hash,
      prompt_version_id, prompt_hash, retrieval_config_version_id, retrieval_config_hash,
      context_config_version_id, context_config_hash, model_name, model_parameters_hash,
      source_fingerprint, document_version_ids, source_document_ids, answer, sources, classification,
      response_hash, status, expires_at, conflict_detected, insufficient_context, contains_sensitive_data, cache_config_version_id
    ) VALUES (
      \${esc(r.cache_key_hash)}, \${esc(r.question_hash)}, \${esc(r.normalized_question)}, \${esc(r.scope_hash)}, \${esc(r.classification_hash)},
      \${esc(r.prompt_version_id)}::uuid, \${esc(r.prompt_hash)}, \${r.retrieval_config_version_id ? esc(r.retrieval_config_version_id)+'::uuid' : 'NULL'}, \${esc(r.retrieval_config_hash)},
      \${r.context_config_version_id ? esc(r.context_config_version_id)+'::uuid' : 'NULL'}, \${esc(r.context_config_hash)}, \${esc(r.model_name)}, \${esc(r.model_parameters_hash)},
      \${esc(r.source_fingerprint)}, \${escJ(r.document_version_ids)}, \${escJ(r.source_document_ids)}, \${esc(r.answer)}, \${escJ(r.sources)}, \${escJ(r.classification)},
      \${esc(r.response_hash)}, 'VALID', NOW() + (\${Number(r.ttl)||86400}) * INTERVAL '1 second',
      \${r.conflict_detected? 'true':'false'}, \${r.insufficient_context? 'true':'false'}, \${r.contains_sensitive_data? 'true':'false'},
      \${r.cache_config_version_id ? esc(r.cache_config_version_id)+'::uuid' : 'NULL'}
    )
    ON CONFLICT (cache_key_hash) DO UPDATE SET
      answer=EXCLUDED.answer, sources=EXCLUDED.sources, response_hash=EXCLUDED.response_hash,
      expires_at=EXCLUDED.expires_at, status='VALID', invalidated_at=NULL, invalidation_reason=NULL,
      last_hit_at=COALESCE(ai_semantic_cache_entries.last_hit_at, NOW())
    RETURNING id\`;
  }
  if (j.doBumpHit && j.entryId) {
    const id = String(j.entryId).replace(/'/g,"''");
    return "UPDATE ai_semantic_cache_entries SET hit_count=hit_count+1, last_hit_at=NOW(), validation_count=validation_count+1 WHERE id='" + id + "'::uuid RETURNING id";
  }
  if (j.doInvalidate) {
    const reason = String(j.reason||'MANUAL').replace(/'/g,"''").slice(0,80);
    if (j.documentId) {
      const d = String(j.documentId).replace(/'/g,"''");
      return "UPDATE ai_semantic_cache_entries e SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND (source_document_ids ? '" + d + "' OR source_document_ids @> '\\"\\"" + d + "\\"\\"'::jsonb) RETURNING id";
    }
    if (j.promptVersionId) {
      const p = String(j.promptVersionId).replace(/'/g,"''");
      return "UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND prompt_version_id='" + p + "'::uuid RETURNING id";
    }
    if (j.contextConfigVersionId) {
      const c = String(j.contextConfigVersionId).replace(/'/g,"''");
      return "UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND context_config_version_id='" + c + "'::uuid RETURNING id";
    }
    if (j.retrievalConfigVersionId) {
      const r = String(j.retrievalConfigVersionId).replace(/'/g,"''");
      return "UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND retrieval_config_version_id='" + r + "'::uuid RETURNING id";
    }
    return "SELECT NULL::uuid AS id WHERE false";
  }
  if (j.doCleanup) {
    return "WITH exp AS (UPDATE ai_semantic_cache_entries SET status='EXPIRED' WHERE status='VALID' AND expires_at < NOW() RETURNING id), del AS (DELETE FROM ai_semantic_cache_entries WHERE status IN ('EXPIRED','INVALIDATED') AND COALESCE(invalidated_at, expires_at, created_at) < NOW() - INTERVAL '30 days' RETURNING id) SELECT (SELECT COUNT(*) FROM exp)::int AS expired, (SELECT COUNT(*) FROM del)::int AS deleted";
  }
  return "SELECT 1 AS ok";
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Retornar',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1440, 0],
    parameters: {
      jsCode: `const decided=$('Decidir').first().json||{};
const persist=$input.first().json||{};
return [{json:{...decided, persistResult:persist}}];`,
    },
  },
];

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Load config', type: 'main', index: 0 }]] },
  'Load config': { main: [[{ node: 'Lookup exact', type: 'main', index: 0 }]] },
  'Lookup exact': { main: [[{ node: 'Decidir', type: 'main', index: 0 }]] },
  Decidir: { main: [[{ node: 'Persistir se necessário', type: 'main', index: 0 }]] },
  'Persistir se necessário': { main: [[{ node: 'Retornar', type: 'main', index: 0 }]] },
};

const runtimeVid = await upsertWorkflow({
  id: RUNTIME_ID,
  name: 'IA - CACHE RUNTIME',
  nodes,
  connections,
  active: true,
});

writeFileSync(new URL('./_runtime-id.json', import.meta.url), JSON.stringify({ RUNTIME_ID, runtimeVid }, null, 2));

// ---- Wire Consulta IA ----
{
  const { rows } = await client.query(`SELECT nodes, connections, name FROM workflow_entity WHERE id=$1`, [CONSULTA]);
  const nodesC = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connC = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  // Remove previous etapa22 nodes if re-run
  const skipNames = new Set([
    'IA - CONSULTAR CACHE',
    'Aplicar cache lookup',
    'Cache serve?',
    'Montar resposta cache',
    'IA - SALVAR CACHE',
    'Aplicar cache save',
  ]);
  const filtered = nodesC.filter((n) => !skipNames.has(n.name));

  const callInputs = {
    operation: "={{ 'lookup' }}",
    question: "={{ $('Aplicar janela de contexto').first().json.question || $('Normalizar request').first().json.body.question || '' }}",
    classificationJson: "={{ JSON.stringify($('Aplicar janela de contexto').first().json.classification || {}) }}",
    sourcesJson: "={{ JSON.stringify($('Aplicar janela de contexto').first().json.sources || []) }}",
    documentVersionsJson: "={{ JSON.stringify($('Aplicar janela de contexto').first().json.sources || []) }}",
    contextMetaJson: "={{ JSON.stringify($('Aplicar janela de contexto').first().json.contextMeta || {}) }}",
    retrievalMetaJson: "={{ JSON.stringify($('Aplicar janela de contexto').first().json.retrievalMeta || {}) }}",
    promptVersionId: "={{ String($('Aplicar prompt carregado').first().json.promptVersionId || $('Aplicar prompt carregado').first().json.versionId || '') }}",
    promptHash: "={{ String($('Aplicar prompt carregado').first().json.contentHash || $('Aplicar prompt carregado').first().json.promptHash || '') }}",
    retrievalConfigVersionId: "={{ String(($('Aplicar janela de contexto').first().json.retrievalMeta || {}).configVersionId || '') }}",
    retrievalConfigHash: "={{ String(($('Aplicar janela de contexto').first().json.retrievalMeta || {}).contentHash || '') }}",
    contextConfigVersionId: "={{ String(($('Aplicar janela de contexto').first().json.contextMeta || {}).configVersionId || '') }}",
    contextConfigHash: "={{ '' }}",
    modelName: "={{ String($('Aplicar prompt carregado').first().json.modelName || 'gpt-4.1-mini') }}",
    permissionsJson: `={{ JSON.stringify((() => { try { const a=$('Validar auth').first().json||{}; const u=a.user||{}; return [...(a.permissions||[]),...(u.permissions||[])]; } catch(_) { return []; } })()) }}`,
    isMaster: `={{ (() => { try { const a=$('Validar auth').first().json||{}; return a.isMaster===true|| (a.user||{}).isMaster===true ? 'true':'false'; } catch(_) { return 'false'; } })() }}`,
    requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
    cacheConfigVersionId: `={{ (() => { const b=$('Normalizar request').first().json.body||{}; return String(b.cacheConfigVersionId||''); })() }}`,
  };

  filtered.push({
    id: randomUUID(),
    name: 'IA - CONSULTAR CACHE',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [1600, 400],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: RUNTIME_ID },
      workflowInputs: { mappingMode: 'defineBelow', value: callInputs },
      options: {},
    },
  });

  filtered.push({
    id: randomUUID(),
    name: 'Aplicar cache lookup',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1820, 400],
    parameters: {
      jsCode: `const ctx=$('Aplicar janela de contexto').first().json||{};
const cache=$input.first().json||{};
return [{json:{...ctx, cacheMeta:cache.cacheMeta||null, serveFromCache:!!cache.serveFromCache, cachedAnswer:cache.cachedAnswer||null, cachedSources:cache.cachedSources||null, cachePrepared:cache.prepared||null, cacheCandidateAnswer:cache.candidateAnswer||null, cacheCandidateSources:cache.candidateSources||null}}];`,
    },
  });

  filtered.push({
    id: randomUUID(),
    name: 'Cache serve?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [2040, 400],
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
        conditions: [
          {
            id: randomUUID(),
            leftValue: '={{ $json.serveFromCache === true }}',
            rightValue: true,
            operator: { type: 'boolean', operation: 'true', singleValue: true },
          },
        ],
        combinator: 'and',
      },
    },
  });

  filtered.push({
    id: randomUUID(),
    name: 'Montar resposta cache',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2260, 280],
    parameters: {
      jsCode: `const ctx=$('Aplicar cache lookup').first().json||{};
const prompt=$('Aplicar prompt carregado').first().json||{};
const answer=String(ctx.cachedAnswer||'');
const sources=(ctx.cachedSources||ctx.sources||[]).map(s=>({...s, expirationDate:s.expirationDate??s.vigencyDate??null}));
const requestId=$('Normalizar request').first().json.requestId;
return [{json:{data:{question:ctx.question,answer,sources,classification:ctx.classification,retrievalMeta:ctx.retrievalMeta||null,contextMeta:ctx.contextMeta||null,cacheMeta:ctx.cacheMeta||null,promptVersion:prompt.versionNumber||prompt.promptVersion||null,modelName:prompt.modelName||null},requestId}}];`,
    },
  });

  filtered.push({
    id: randomUUID(),
    name: 'IA - SALVAR CACHE',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [2260, 520],
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: RUNTIME_ID },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          operation: "={{ 'save' }}",
          question: "={{ $('Aplicar cache lookup').first().json.question || '' }}",
          answer: "={{ $json.output?.[0]?.content?.[0]?.text ?? '' }}",
          sourcesJson: "={{ JSON.stringify($('Aplicar cache lookup').first().json.sources || []) }}",
          classificationJson: "={{ JSON.stringify($('Aplicar cache lookup').first().json.classification || {}) }}",
          preparedJson: "={{ JSON.stringify($('Aplicar cache lookup').first().json.cachePrepared || {}) }}",
          cacheMetaJson: "={{ JSON.stringify($('Aplicar cache lookup').first().json.cacheMeta || {}) }}",
          candidateAnswer: "={{ $('Aplicar cache lookup').first().json.cacheCandidateAnswer || '' }}",
          candidateSourcesJson: "={{ JSON.stringify($('Aplicar cache lookup').first().json.cacheCandidateSources || []) }}",
          requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
          cacheConfigVersionId: `={{ (() => { const b=$('Normalizar request').first().json.body||{}; return String(b.cacheConfigVersionId||''); })() }}`,
        },
      },
      options: {},
    },
  });

  filtered.push({
    id: randomUUID(),
    name: 'Aplicar cache save',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2480, 520],
    parameters: {
      jsCode: `const openai=$('Message a model').first().json||{};
const lookup=$('Aplicar cache lookup').first().json||{};
const save=$input.first().json||{};
const answer=openai.output?.[0]?.content?.[0]?.text ?? '';
const prompt=$('Aplicar prompt carregado').first().json||{};
const sources=(lookup.sources||[]).map(s=>({...s, expirationDate:s.expirationDate??s.vigencyDate??null}));
const requestId=$('Normalizar request').first().json.requestId;
const cacheMeta={...(lookup.cacheMeta||{}), ...(save.cacheMeta||{}), answerFromCache:false};
return [{json:{data:{question:lookup.question,answer,sources,classification:lookup.classification,retrievalMeta:lookup.retrievalMeta||null,contextMeta:lookup.contextMeta||null,cacheMeta,promptVersion:prompt.versionNumber||prompt.promptVersion||null,modelName:prompt.modelName||null},requestId}}];`,
    },
  });

  // Rewire connections
  connC['Aplicar janela de contexto'] = { main: [[{ node: 'IA - CONSULTAR CACHE', type: 'main', index: 0 }]] };
  connC['IA - CONSULTAR CACHE'] = { main: [[{ node: 'Aplicar cache lookup', type: 'main', index: 0 }]] };
  connC['Aplicar cache lookup'] = { main: [[{ node: 'Cache serve?', type: 'main', index: 0 }]] };
  connC['Cache serve?'] = {
    main: [
      [{ node: 'Montar resposta cache', type: 'main', index: 0 }], // true
      [{ node: 'Message a model', type: 'main', index: 0 }], // false (SHADOW always here)
    ],
  };
  connC['Message a model'] = { main: [[{ node: 'IA - SALVAR CACHE', type: 'main', index: 0 }]] };
  connC['IA - SALVAR CACHE'] = { main: [[{ node: 'Aplicar cache save', type: 'main', index: 0 }]] };
  connC['Aplicar cache save'] = { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] };
  connC['Montar resposta cache'] = { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] };

  // Update Montar resposta path unused for OpenAI path - Preparar sucesso must accept data from Aplicar cache save
  // Check Preparar sucesso expects $('Montar resposta') - may need patch
  const prepSucesso = filtered.find((n) => n.name === 'Preparar sucesso');
  // It's an executeWorkflow - check inputs
  const montarOld = filtered.find((n) => n.name === 'Montar resposta');
  // Keep Montar resposta node but disconnect from Message - or update Preparar sucesso data expression

  // Find who feeds Preparar sucesso data
  const ps = filtered.find((n) => n.name === 'Preparar sucesso');
  if (ps?.parameters?.workflowInputs?.value?.data) {
    // leave as is if expression uses $json
    console.log('Preparar sucesso data expr', String(ps.parameters.workflowInputs.value.data).slice(0, 200));
  }

  // Patch audit metadata to include cacheMeta summary (sanitized)
  const montar = filtered.find((n) => n.name === 'Montar resposta');
  if (montar?.parameters?.jsCode && !montar.parameters.jsCode.includes('cacheMeta')) {
    montar.parameters.jsCode = montar.parameters.jsCode.replace(
      'contextMeta: contextMeta,',
      `contextMeta: contextMeta,
      cacheMeta: null,`,
    );
  }

  const consultaVid = await upsertWorkflow({
    id: CONSULTA,
    name: rows[0].name,
    nodes: filtered,
    connections: connC,
    active: true,
  });
  writeFileSync(
    new URL('./_consulta-wired.json', import.meta.url),
    JSON.stringify({ consultaVid, RUNTIME_ID }, null, 2),
  );
}

await client.end();
console.log('done');
