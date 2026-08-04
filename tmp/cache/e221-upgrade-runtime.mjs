#!/usr/bin/env node
/**
 * Etapa 22.1 — upgrade IA - CACHE RUNTIME:
 * fingerprint v2, enrich from DB, deps, lazy validation, eligibility, TTL, cleanup/LRU.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const RUNTIME_ID = 'c22CacheRuntime0001';
const INVALIDATE_ID = 'c221InvalidateEvent01';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function upsertWorkflow({ id, name, nodes, connections, active = true, description = 'Etapa 22.1' }) {
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
     VALUES ($1::varchar,$2,'etapa22.1',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, nodesJson, connJson, name, description],
  );
  await client.query(
    `UPDATE workflow_entity SET name=$1, nodes=$2::json, connections=$3::json, "versionId"=$4::varchar, "activeVersionId"=$4::varchar, active=$5, "updatedAt"=NOW() WHERE id=$6`,
    [name, nodesJson, connJson, versionId, active, id],
  );
  await client.query('COMMIT');
  console.log('WF', name, id, versionId);
  return versionId;
}

const prepareCode = `const crypto=require('crypto');
const sha256=(s)=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const canonical=(v)=>{if(v===null||v===undefined)return'null';if(typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';const ks=Object.keys(v).sort();return'{'+ks.map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';};
const normalizeQuestion=(raw)=>{let q=String(raw||'').normalize('NFKC').trim().toLowerCase();q=q.replace(/[?!.,;:]+$/g,'');q=q.replace(/[^\\p{L}\\p{N}\\s\\-./@]+/gu,' ');return q.replace(/\\s+/g,' ').trim();};
const detectSensitive=(s)=>{s=String(s||'');return/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/.test(s)||/\\b\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}\\b/.test(s)||/CRM[-\\s]?[A-Z]{0,2}[-\\s]?\\d{2,}/i.test(s)||/COREN[-\\s]?[A-Z]{0,2}[-\\s]?\\d{2,}/i.test(s)||/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i.test(s)||/prontu[aá]rio|matr[ií]cula|sal[aá]rio|remunera/i.test(s);};
const redact=(q)=>String(q||'').replace(/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/g,'[CPF]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi,'[EMAIL]').replace(/CRM[-\\s]?\\d{2,}/gi,'[CRM]');
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
const sourceDocumentIds=[...new Set((Array.isArray(documentVersions)?documentVersions:[]).map(d=>String(d.documentId||d.document_id||d.id||'')).filter(Boolean))];
const sourceVersionIds=[...new Set((Array.isArray(documentVersions)?documentVersions:[]).map(d=>String(d.documentVersionId||d.document_version_id||d.versionId||'')).filter(Boolean))];
const includedChunkIds=[...new Set((Array.isArray(documentVersions)?documentVersions:[]).flatMap(d=>Array.isArray(d.chunkIds)?d.chunkIds:(Array.isArray(d.includedChunkIds)?d.includedChunkIds:[])).map(String))];
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
  reason:String(t.reason||t.reasonCode||'MANUAL'),
  eventType:String(t.eventType||''),
  documentId:t.documentId||null,
  documentVersionId:t.documentVersionId||null,
  promptVersionIdIn:t.promptVersionId||null,
  retrievalConfigVersionIdIn:t.retrievalConfigVersionId||null,
  contextConfigVersionIdIn:t.contextConfigVersionId||null,
  modelNameIn:t.modelName||null,
  userId:t.userId||null,
  normalizedQuestion:sensitive?redact(normalizedQuestion):normalizedQuestion,
  questionHash:sha256(normalizeQuestion(question)),
  scopeHash,sensitive,
  sourceDocumentIds,sourceVersionIds,includedChunkIds,
  promptVersionId:String(t.promptVersionId||''),
  promptHash:String(t.promptHash||''),
  retrievalConfigVersionId:t.retrievalConfigVersionId||retrievalMeta.configVersionId||null,
  retrievalConfigHash:t.retrievalConfigHash||retrievalMeta.contentHash||null,
  contextConfigVersionId:t.contextConfigVersionId||contextMeta.configVersionId||null,
  contextConfigHash:t.contextConfigHash||null,
  modelName:String(t.modelName||'gpt-4.1-mini'),
  modelParametersHash:String(t.modelParametersHash||''),
  conflictDetected:!!(contextMeta.conflictDetected),
  insufficientContext:!!(contextMeta.insufficientContext),
  fallbackUsed:!!(contextMeta.fallbackUsed),
  startedAtMs:Date.now(),
}}];`;

const buildKeysCode = `const crypto=require('crypto');
const sha256=(s)=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const canonical=(v)=>{if(v===null||v===undefined)return'null';if(typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return'['+v.map(canonical).join(',')+']';const ks=Object.keys(v).sort();return'{'+ks.map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';};
const prep=$('Preparar entrada').first().json||{};
const enrich=$input.first().json||{};
let docs=[];
try{
  const raw=enrich.enrich_json??enrich.enrichJson??enrich.docs??null;
  if(typeof raw==='string') docs=JSON.parse(raw||'[]');
  else if(Array.isArray(raw)) docs=raw;
  else if(raw&&typeof raw==='object'&&Array.isArray(raw.documents)) docs=raw.documents;
}catch(_){docs=[];}
if(!docs.length && Array.isArray(prep.documentVersions)) {
  docs=prep.documentVersions.map(d=>({
    documentId:String(d.documentId||d.document_id||d.id||''),
    documentVersionId:String(d.documentVersionId||d.document_version_id||d.versionId||''),
    versionNumber:d.versionNumber??d.version_number??null,
    contentHash:String(d.contentHash||d.content_hash||d.checksum||''),
    updatedAt:d.updatedAt||d.updated_at||null,
    expirationDate:d.expirationDate||d.expiration_date||null,
    isCurrent:d.isCurrent??d.is_current??true,
    chunks:[]
  })).filter(d=>d.documentId);
}
const list=docs.map(d=>{
  const chunks=(Array.isArray(d.chunks)?d.chunks:[]).map(c=>({chunkId:String(c.chunkId||c.chunk_id||c.id||''),contentHash:String(c.contentHash||c.content_hash||'')})).filter(c=>c.chunkId).sort((a,b)=>a.chunkId.localeCompare(b.chunkId));
  return {
    documentId:String(d.documentId||d.document_id||''),
    documentVersionId:String(d.documentVersionId||d.document_version_id||''),
    versionNumber:d.versionNumber??d.version_number??null,
    contentHash:String(d.contentHash||d.content_hash||d.checksum||''),
    updatedAt:d.updatedAt||d.updated_at||null,
    expirationDate:d.expirationDate||d.expiration_date||null,
    isCurrent:d.isCurrent??d.is_current??true,
    processingStatus:d.processingStatus||d.processing_status||null,
    validationStatus:d.validationStatus||d.validation_status||null,
    ocrExtractionMethod:d.ocrExtractionMethod||d.extraction_method||d.ocr_engine||null,
    ocrQualityGrade:d.ocrQualityGrade||d.ocr_quality_grade||null,
    ocrStatus:d.ocrStatus||d.ocr_status||null,
    tabularProcessingVersion:d.tabularProcessingVersion||null,
    tableRowCount:d.tableRowCount??d.table_row_count??null,
    tableColumnCount:d.tableColumnCount??d.table_column_count??null,
    embeddingModel:d.embeddingModel||d.embedding_model||null,
    embeddingStatus:d.embeddingStatus||d.embedding_status||null,
    qdrantSyncStatus:d.qdrantSyncStatus||d.qdrant_sync_status||null,
    qdrantSyncedCount:d.qdrantSyncedCount??d.qdrant_synced_count??null,
    includedChunkIds:chunks.map(c=>c.chunkId),
    chunkHashes:chunks
  };
}).filter(d=>d.documentId).sort((a,b)=>(a.documentId+':'+a.documentVersionId).localeCompare(b.documentId+':'+b.documentVersionId));
const payload={schemaVersion:'source-fingerprint-v2',documents:list};
const sourceFingerprint=sha256(canonical(payload));
const nearestSourceExpiration=list.map(d=>d.expirationDate).filter(Boolean).sort()[0]||null;
const hasTabular=list.some(d=>(d.tableRowCount||0)>0||(d.tableColumnCount||0)>0);
const cacheKeyHash=sha256(canonical({
  cacheSchemaVersion:'v1',
  normalizedQuestion:prep.normalizedQuestion,
  questionType:null,
  classification:prep.classification,
  scopeHash:prep.scopeHash,
  promptVersionId:prep.promptVersionId,
  promptContentHash:prep.promptHash,
  retrievalConfigVersionId:prep.retrievalConfigVersionId,
  retrievalConfigHash:prep.retrievalConfigHash,
  contextConfigVersionId:prep.contextConfigVersionId,
  contextConfigHash:prep.contextConfigHash,
  modelName:prep.modelName,
  modelParametersHash:prep.modelParametersHash,
  sourceFingerprint,
  systemVersion:'oftalmocentro-v1'
}));
const deps=list.map(d=>({
  dependency_type:'DOCUMENT_VERSION',
  document_id:d.documentId,
  document_version_id:d.documentVersionId||null,
  document_version_number:d.versionNumber,
  document_content_hash:d.contentHash||null,
  chunk_id:null,
  chunk_content_hash:null,
  expiration_date:d.expirationDate||null,
  updated_at_snapshot:d.updatedAt||null,
  content_hash:d.contentHash||null
}));
return [{json:{
  ...prep,
  sourceFingerprint,
  sourceFingerprintVersion:'source-fingerprint-v2',
  fingerprintPayload:payload,
  cacheKeyHash,
  documentVersionIds:list.map(d=>d.documentVersionId).filter(Boolean),
  sourceDocumentIds:list.map(d=>d.documentId).filter(Boolean),
  nearestSourceExpiration,
  hasTabular,
  dependencyRows:deps,
  enrichOk:!!list.length
}}];`;

const decideCode = `const crypto=require('crypto');
const sha256=(s)=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const normAns=(a)=>String(a||'').normalize('NFKC').trim().toLowerCase().replace(/\\s+/g,' ');
const answersAgree=(a,b)=>{const na=normAns(a),nb=normAns(b);if(!na||!nb)return false;if(na===nb)return true;const s=na.length<=nb.length?na:nb,l=na.length>nb.length?na:nb;return l.includes(s)&&s.length/l.length>=0.85;};
const sourcesAgree=(a,b)=>{const A=new Set((Array.isArray(a)?a:[]).map(x=>String(x.documentId||x.document_id||x.id||'')).filter(Boolean));const B=new Set((Array.isArray(b)?b:[]).map(x=>String(x.documentId||x.document_id||x.id||'')).filter(Boolean));if(!A.size&&!B.size)return true;if(!A.size||!B.size)return false;let i=0;for(const id of A)if(B.has(id))i++;return i/new Set([...A,...B]).size>=0.8;};
const extractIds=(t)=>{const s=String(t||'');const out=[];const m1=s.match(/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/g);if(m1)out.push(...m1);const m2=s.match(/R\\$\\s*\\d[\\d.,]*/gi);if(m2)out.push(...m2);const m3=s.match(/\\b\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}\\b/g);if(m3)out.push(...m3);return [...new Set(out.map(x=>x.toLowerCase()))].sort();};
const prep=$('Build keys').first().json||{};
const cfgRow=$('Load config').first().json||{};
let configuration={};try{configuration=typeof cfgRow.configuration==='string'?JSON.parse(cfgRow.configuration):(cfgRow.configuration||{});}catch(_){configuration={};}
if(prep.configurationIn) configuration={...configuration,...prep.configurationIn};
const mode=String(configuration.mode||cfgRow.mode||'SHADOW').toUpperCase();
const versionLabel=cfgRow.version_label||'cache-shadow-v1';
const versionId=cfgRow.id||null;
const t0=Number(prep.startedAtMs||Date.now());
const latency=()=>Date.now()-t0;
const baseMeta=(extra={})=>({mode,configVersion:versionLabel,configVersionId:versionId,lookupPerformed:false,hit:false,hitType:null,missReason:null,lookupLatencyMs:latency(),semanticSimilarity:null,entryAgeSeconds:null,scopeHashMatched:true,sourceFingerprintMatched:false,answerFromCache:false,shadowCandidateFound:false,shadowAgreement:null,estimatedTokensSaved:0,estimatedCostSaved:0,estimatedLatencySavedMs:0,fallbackUsed:false,fallbackReason:null,requestId:prep.requestId||'',sourceFingerprintVersion:prep.sourceFingerprintVersion||'source-fingerprint-v2',...extra});

const evalEligibility=(p,cfg)=>({
  eligible: !!(p.answer||true) && !p.sensitive && !p.conflictDetected && !p.insufficientContext && !p.fallbackUsed && !!p.sourceFingerprint && Array.isArray(p.documentVersionIds) && p.documentVersionIds.length>0 && !(p.nearestSourceExpiration && new Date(p.nearestSourceExpiration).getTime()<=Date.now()),
  reasonCodes: (()=>{const r=[]; if(p.sensitive)r.push('SENSITIVE_QUERY'); if(p.conflictDetected)r.push('CONFLICT'); if(p.insufficientContext)r.push('INSUFFICIENT_CONTEXT'); if(p.fallbackUsed)r.push('FALLBACK'); if(!p.sourceFingerprint)r.push('FINGERPRINT_MISSING'); if(!p.documentVersionIds||!p.documentVersionIds.length)r.push('DEPENDENCIES_INCOMPLETE'); if(p.nearestSourceExpiration && new Date(p.nearestSourceExpiration).getTime()<=Date.now())r.push('DOCUMENT_EXPIRED'); return r;})(),
  containsSensitiveData:!!p.sensitive,
  ttlSeconds:Number(cfg.ttlSeconds||86400),
  scopeMode:'PERMISSION_SET'
});

const computeTtl=(p,cfg)=>{
  let effective=Number(cfg.ttlSeconds||86400);
  let ttlPolicy='CONFIG_TTL';
  if(p.hasTabular){effective=Math.min(effective,6*3600);ttlPolicy='TABULAR_6H';}
  else {effective=Math.min(effective,24*3600);ttlPolicy='INSTITUTIONAL_24H';}
  if(p.nearestSourceExpiration){
    const rem=Math.floor((new Date(p.nearestSourceExpiration).getTime()-Date.now())/1000);
    if(rem<=0) return {ttlPolicy:'SOURCE_EXPIRED',effectiveTtlSeconds:0,nearestSourceExpiration:p.nearestSourceExpiration};
    if(rem<effective){effective=rem;ttlPolicy='SOURCE_EXPIRATION';}
  }
  return {ttlPolicy,effectiveTtlSeconds:Math.max(0,effective),nearestSourceExpiration:p.nearestSourceExpiration||null};
};

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

if(prep.operation==='eligibility'||prep.operation==='evaluate_eligibility'){
  const el=evalEligibility({...prep,answer:prep.answer||'ok'},configuration);
  const ttl=computeTtl(prep,configuration);
  return [{json:{...el,ttlSeconds:ttl.effectiveTtlSeconds,ttlPolicy:ttl.ttlPolicy,nearestSourceExpiration:ttl.nearestSourceExpiration,cacheMeta:baseMeta()}}];
}

if(prep.operation==='invalidate'||prep.operation==='invalidate_event'){
  return [{json:{
    doInvalidate:true,
    eventType:prep.eventType||'MANUAL',
    reason:prep.reason||prep.eventType||'MANUAL',
    documentId:prep.documentId,
    documentVersionId:prep.documentVersionId,
    promptVersionId:prep.promptVersionIdIn||prep.promptVersionId,
    retrievalConfigVersionId:prep.retrievalConfigVersionIdIn||prep.retrievalConfigVersionId,
    contextConfigVersionId:prep.contextConfigVersionIdIn||prep.contextConfigVersionId,
    modelName:prep.modelNameIn||null,
    requestId:prep.requestId,
    cacheMeta:baseMeta(),
    auditAction:'AI_CACHE_INVALIDATE'
  }}];
}
if(prep.operation==='cleanup'){
  return [{json:{doCleanup:true,maxEntries:Number(configuration.maxEntries||5000),maxEntriesPerScope:Number(configuration.maxEntriesPerScope||500),cacheMeta:baseMeta(),auditAction:'AI_CACHE_CLEANUP'}}];
}

if(prep.operation==='lookup'){
  if(mode==='DISABLED') return [{json:{serveFromCache:false,cacheMeta:baseMeta({lookupPerformed:false,missReason:'CACHE_DISABLED'}),prepared:{...prep,versionId,versionLabel,mode,...computeTtl(prep,configuration)},doSave:false}}];
  const entry=$('Lookup exact').first()?.json||{};
  const depsRow=$('Load deps').first()?.json||{};
  let deps=[];
  try{deps=typeof depsRow.deps_json==='string'?JSON.parse(depsRow.deps_json||'[]'):(depsRow.deps_json||[]);}catch(_){deps=[];}
  const found=!!(entry&&entry.id&&entry.cache_key_hash);
  let missReason=null, hit=false, hitType=null, entryAgeSeconds=null, sourceFingerprintMatched=false, scopeHashMatched=true;
  let invalidateEntryId=null, invalidateReason=null;
  if(!found) missReason='NOT_FOUND';
  else {
    entryAgeSeconds=Math.max(0,Math.floor((Date.now()-new Date(entry.created_at).getTime())/1000));
    if(entry.status!=='VALID') missReason=entry.status==='EXPIRED'?'EXPIRED':(entry.status==='INVALIDATED'?'INVALIDATED':'QUARANTINED');
    else if(new Date(entry.expires_at).getTime()<=Date.now()) {missReason='EXPIRED';}
    else if(String(entry.scope_hash)!==String(prep.scopeHash)){missReason='SCOPE_MISMATCH';scopeHashMatched=false;}
    else if(configuration.requireSamePromptVersion!==false && String(entry.prompt_version_id)!==String(prep.promptVersionId)) missReason='PROMPT_VERSION_CHANGED';
    else if(configuration.requireSameRetrievalVersion!==false && String(entry.retrieval_config_version_id||'')!==String(prep.retrievalConfigVersionId||'')) missReason='RETRIEVAL_VERSION_CHANGED';
    else if(configuration.requireSameContextVersion!==false && String(entry.context_config_version_id||'')!==String(prep.contextConfigVersionId||'')) missReason='CONTEXT_VERSION_CHANGED';
    else if(configuration.requireSameModel!==false && String(entry.model_name)!==String(prep.modelName)) missReason='MODEL_CHANGED';
    else if(configuration.requireSameSources!==false && String(entry.source_fingerprint)!==String(prep.sourceFingerprint)) {
      missReason='SOURCE_FINGERPRINT_CHANGED';
      invalidateEntryId=entry.id; invalidateReason='DOCUMENT_HASH_CHANGED';
    }
    else {
      // lazy dependency validation
      let lazyFail=null;
      if(!deps.length && (entry.document_version_ids||[]).length) lazyFail='DEPENDENCY_MISSING';
      for(const d of deps){
        if(String(d.live_is_current)==='false'||d.live_is_current===false){lazyFail='DOCUMENT_NOT_CURRENT';break;}
        if(d.live_deleted_at){lazyFail='DOCUMENT_INACTIVE';break;}
        if(d.live_expiration_date && new Date(d.live_expiration_date).getTime()<=Date.now()){lazyFail='DOCUMENT_EXPIRED';break;}
        if(d.document_content_hash && d.live_checksum && String(d.document_content_hash)!==String(d.live_checksum)){lazyFail='DOCUMENT_HASH_CHANGED';break;}
        if(d.chunk_content_hash && d.live_chunk_hash && String(d.chunk_content_hash)!==String(d.live_chunk_hash)){lazyFail='CHUNK_HASH_CHANGED';break;}
        if(d.live_ocr_status && d.snap_ocr_status && String(d.live_ocr_status)!==String(d.snap_ocr_status)){lazyFail='OCR_STATE_CHANGED';break;}
        if(d.live_embedding_status && d.snap_embedding_status && String(d.live_embedding_status)!==String(d.snap_embedding_status)){lazyFail='EMBEDDING_STATE_CHANGED';break;}
        if(d.live_qdrant_sync_status && d.snap_qdrant_sync_status && String(d.live_qdrant_sync_status)!==String(d.snap_qdrant_sync_status)){lazyFail='QDRANT_STATE_CHANGED';break;}
      }
      if(lazyFail){
        missReason=lazyFail;
        invalidateEntryId=entry.id;
        invalidateReason=lazyFail;
      } else if(entry.conflict_detected) missReason='CONFLICT_RESPONSE_NOT_CACHEABLE';
      else if(entry.insufficient_context) missReason='INSUFFICIENT_CONTEXT_NOT_CACHEABLE';
      else if(entry.contains_sensitive_data || (prep.sensitive && configuration.cacheSensitiveQueries!==true)) missReason='SENSITIVE_QUERY_NOT_CACHEABLE';
      else {hit=true;hitType='EXACT';sourceFingerprintMatched=true;}
    }
  }
  const serveFromCache = hit && ['EXACT_ONLY','NORMALIZED','SEMANTIC'].includes(mode) && !prep.sensitive;
  const shadowCandidateFound = mode==='SHADOW' && hit;
  const ttl=computeTtl(prep,configuration);
  const cacheMeta=baseMeta({
    lookupPerformed:true,
    hit:serveFromCache,
    hitType:serveFromCache?hitType:null,
    missReason:serveFromCache?null:(shadowCandidateFound?'SHADOW_MODE':(missReason||'NOT_FOUND')),
    entryAgeSeconds, scopeHashMatched, sourceFingerprintMatched,
    answerFromCache:false, // SHADOW/etapa22.1 never serve; also EXACT_ONLY not published
    shadowCandidateFound,
    invalidationPreventedHit:!!(invalidateEntryId&&!hit),
    estimatedLatencySavedMs:serveFromCache?800:0,
    estimatedTokensSaved:serveFromCache?500:0,
    ttlPolicy:ttl.ttlPolicy,
    effectiveTtlSeconds:ttl.effectiveTtlSeconds,
  });
  // Force never serve in SHADOW
  const reallyServe = serveFromCache && mode!=='SHADOW';
  cacheMeta.answerFromCache=reallyServe;
  cacheMeta.hit=reallyServe;
  let sources=entry.sources; try{if(typeof sources==='string') sources=JSON.parse(sources);}catch(_){sources=[];}
  return [{json:{
    serveFromCache:reallyServe,
    cachedAnswer:reallyServe?entry.answer:null,
    cachedSources:reallyServe?sources:null,
    candidateEntryId:found?entry.id:null,
    candidateAnswer:found?entry.answer:null,
    candidateSources:found?sources:null,
    cacheMeta,
    prepared:{cacheKeyHash:prep.cacheKeyHash,questionHash:prep.questionHash,scopeHash:prep.scopeHash,sourceFingerprint:prep.sourceFingerprint,sourceFingerprintVersion:prep.sourceFingerprintVersion,sensitive:prep.sensitive,normalizedQuestion:prep.normalizedQuestion,classificationHash:sha256(JSON.stringify(prep.classification||{})),promptVersionId:prep.promptVersionId,promptHash:prep.promptHash,retrievalConfigVersionId:prep.retrievalConfigVersionId,retrievalConfigHash:prep.retrievalConfigHash,contextConfigVersionId:prep.contextConfigVersionId,contextConfigHash:prep.contextConfigHash,modelName:prep.modelName,modelParametersHash:prep.modelParametersHash,conflictDetected:prep.conflictDetected,insufficientContext:prep.insufficientContext,fallbackUsed:prep.fallbackUsed,documentVersionIds:prep.documentVersionIds,sourceDocumentIds:prep.sourceDocumentIds,dependencyRows:prep.dependencyRows||[],versionId,versionLabel,mode,...ttl,hasTabular:!!prep.hasTabular},
    doSave:false,
    doBumpHit:shadowCandidateFound||reallyServe,
    doLazyInvalidate:!!invalidateEntryId,
    entryId:found?entry.id:null,
    lazyInvalidateId:invalidateEntryId,
    lazyInvalidateReason:invalidateReason,
    auditAction:reallyServe?'AI_CACHE_HIT':(shadowCandidateFound?'AI_CACHE_SHADOW_MATCH':(invalidateEntryId?'AI_CACHE_DEPENDENCY_MISMATCH':'AI_CACHE_LOOKUP')),
  }}];
}

if(prep.operation==='save'){
  const prepared=prep.preparedIn||{};
  const answer=String(prep.answer||'');
  const outSources=Array.isArray(prep.sources)?prep.sources:[];
  const lookupMeta=prep.cacheMetaIn||{};
  let answerAgreement=null, sourceAgreement=null, shadowAgreement=null, falseHit=false, criticalFalseHit=false, comparisonClass='INCONCLUSIVE';
  if(lookupMeta.shadowCandidateFound && prep.candidateAnswer!=null){
    answerAgreement=answersAgree(answer, prep.candidateAnswer);
    sourceAgreement=sourcesAgree(outSources, prep.candidateSources);
    const liveIds=extractIds(answer), cachedIds=extractIds(prep.candidateAnswer);
    const idMismatch=liveIds.length&&cachedIds.length&&liveIds.some(id=>!cachedIds.includes(id))&&cachedIds.some(id=>!liveIds.includes(id));
    const liveAbstain=/n[aã]o (encontrei|localizei|possui)|sem evid[eê]ncia/i.test(answer);
    const cachedAbstain=/n[aã]o (encontrei|localizei|possui)|sem evid[eê]ncia/i.test(String(prep.candidateAnswer||''));
    if(liveAbstain!==cachedAbstain||idMismatch){criticalFalseHit=true;falseHit=true;comparisonClass='CRITICAL_FALSE_HIT';}
    else if(!sourceAgreement){falseHit=true;comparisonClass='FALSE_HIT';}
    else if(!answerAgreement){comparisonClass='NON_CRITICAL_DIVERGENCE';}
    else {comparisonClass='SAFE_MATCH';}
    shadowAgreement=comparisonClass==='SAFE_MATCH';
  }
  const eligInput={...prepared,answer,sensitive:prepared.sensitive,nearestSourceExpiration:prepared.nearestSourceExpiration,documentVersionIds:prepared.documentVersionIds||prep.documentVersionIds};
  const reasonCodes=[];
  if(!answer||!answer.trim()) reasonCodes.push('EMPTY_ANSWER');
  if(prepared.sensitive) reasonCodes.push('SENSITIVE_QUERY');
  if(prepared.conflictDetected) reasonCodes.push('CONFLICT');
  if(prepared.insufficientContext) reasonCodes.push('INSUFFICIENT_CONTEXT');
  if(prepared.fallbackUsed) reasonCodes.push('FALLBACK');
  if(!prepared.sourceFingerprint && !prep.sourceFingerprint) reasonCodes.push('FINGERPRINT_MISSING');
  const docIds=prepared.documentVersionIds||prep.documentVersionIds||[];
  if(!docIds.length) reasonCodes.push('DEPENDENCIES_INCOMPLETE');
  if(prepared.nearestSourceExpiration && new Date(prepared.nearestSourceExpiration).getTime()<=Date.now()) reasonCodes.push('DOCUMENT_EXPIRED');
  const canSave=reasonCodes.length===0;
  const ttl=computeTtl({hasTabular:prepared.hasTabular,nearestSourceExpiration:prepared.nearestSourceExpiration},configuration);
  const cacheMeta=baseMeta({
    lookupPerformed:!!lookupMeta.lookupPerformed,
    missReason:lookupMeta.missReason||null,
    shadowCandidateFound:!!lookupMeta.shadowCandidateFound,
    shadowAgreement, answerFromCache:false,
    sourceFingerprintMatched:!!lookupMeta.sourceFingerprintMatched,
    entryAgeSeconds:lookupMeta.entryAgeSeconds??null,
    ttlPolicy:ttl.ttlPolicy,
    effectiveTtlSeconds:ttl.effectiveTtlSeconds,
  });
  cacheMeta.answerAgreement=answerAgreement;
  cacheMeta.sourceAgreement=sourceAgreement;
  cacheMeta.falseHit=falseHit;
  cacheMeta.criticalFalseHit=criticalFalseHit;
  cacheMeta.comparisonClass=comparisonClass;
  if(!canSave){
    cacheMeta.saved=false;
    cacheMeta.saveSkippedReason=reasonCodes[0]||'NOT_CACHEABLE';
    cacheMeta.notCacheableReason=reasonCodes[0]||'NOT_CACHEABLE';
    return [{json:{doSave:false,cacheMeta,metrics:{falseHit,criticalFalseHit,shadowAgreement,answerAgreement,sourceAgreement,comparisonClass},auditAction:criticalFalseHit?'AI_CACHE_CRITICAL_FALSE_HIT':(falseHit?'AI_CACHE_FALSE_HIT':'AI_CACHE_LOOKUP')}}];
  }
  return [{json:{
    doSave:true,
    cacheMeta:{...cacheMeta,saved:true},
    saveRow:{
      cache_key_hash:prepared.cacheKeyHash||prep.cacheKeyHash,
      question_hash:prepared.questionHash||prep.questionHash,
      normalized_question:prepared.normalizedQuestion||prep.normalizedQuestion,
      scope_hash:prepared.scopeHash||prep.scopeHash,
      classification_hash:prepared.classificationHash||sha256(JSON.stringify(prep.classification||{})),
      prompt_version_id:prepared.promptVersionId,
      prompt_hash:prepared.promptHash||'',
      retrieval_config_version_id:prepared.retrievalConfigVersionId,
      retrieval_config_hash:prepared.retrievalConfigHash,
      context_config_version_id:prepared.contextConfigVersionId,
      context_config_hash:prepared.contextConfigHash,
      model_name:prepared.modelName,
      model_parameters_hash:prepared.modelParametersHash||'',
      source_fingerprint:prepared.sourceFingerprint||prep.sourceFingerprint,
      source_fingerprint_version:prepared.sourceFingerprintVersion||'source-fingerprint-v2',
      document_version_ids:JSON.stringify(prepared.documentVersionIds||prep.documentVersionIds||[]),
      source_document_ids:JSON.stringify(prepared.sourceDocumentIds||prep.sourceDocumentIds||[]),
      answer,
      sources:JSON.stringify(outSources),
      classification:JSON.stringify(prep.classification||{}),
      response_hash:sha256(normAns(answer)),
      ttl:ttl.effectiveTtlSeconds,
      ttl_policy:ttl.ttlPolicy,
      effective_ttl_seconds:ttl.effectiveTtlSeconds,
      nearest_source_expiration:ttl.nearestSourceExpiration,
      conflict_detected:!!prepared.conflictDetected,
      insufficient_context:!!prepared.insufficientContext,
      contains_sensitive_data:!!prepared.sensitive,
      cache_config_version_id:prepared.versionId||versionId,
      dependencyRows:JSON.stringify(prepared.dependencyRows||prep.dependencyRows||[]),
    },
    metrics:{falseHit,criticalFalseHit,shadowAgreement,answerAgreement,sourceAgreement,comparisonClass},
    auditAction:criticalFalseHit?'AI_CACHE_CRITICAL_FALSE_HIT':(falseHit?'AI_CACHE_FALSE_HIT':'AI_CACHE_SAVE'),
  }}];
}

return [{json:{serveFromCache:false,cacheMeta:baseMeta({fallbackUsed:true,fallbackReason:'UNKNOWN_OPERATION',missReason:'OTHER'}),doSave:false}}];
}catch(err){
  return [{json:{serveFromCache:false,cacheMeta:baseMeta({fallbackUsed:true,fallbackReason:'CACHE_RUNTIME_ERROR',missReason:'OTHER'}),doSave:false,errorCode:'CACHE_RUNTIME_ERROR',errorMessage:String(err&&err.message||err).slice(0,200)}}];
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
          'candidateAnswer','candidateSourcesJson','configurationJson','reason','reasonCode','documentId','documentVersionId',
          'cacheConfigVersionId','eventType','userId',
        ].map((name) => ({ name, type: 'string' })),
      },
    },
  },
  {
    id: randomUUID(),
    name: 'Preparar entrada',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [220, 0],
    parameters: { jsCode: prepareCode },
  },
  {
    id: randomUUID(),
    name: 'Load config',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [440, 0],
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
    name: 'Enrich sources',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [660, 0],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const prep = $('Preparar entrada').first().json || {};
  const op = String(prep.operation || '');
  if (op === 'invalidate' || op === 'invalidate_event' || op === 'cleanup' || op === 'validateconfig') {
    return "SELECT '[]'::jsonb AS enrich_json";
  }
  const ids = (prep.sourceDocumentIds || []).filter(Boolean).map(String).filter(id => /^[0-9a-f-]{36}$/i.test(id));
  const vids = (prep.sourceVersionIds || []).filter(Boolean).map(String).filter(id => /^[0-9a-f-]{36}$/i.test(id));
  if (!ids.length && !vids.length) return "SELECT '[]'::jsonb AS enrich_json";
  const idList = ids.map(i => "'" + i + "'::uuid").join(',');
  const vidList = vids.map(i => "'" + i + "'::uuid").join(',');
  const where = vids.length
    ? ("dv.id IN (" + vidList + ") OR (dv.is_current = true AND dv.document_id IN (" + (idList || "NULL") + "))")
    : ("dv.is_current = true AND dv.document_id IN (" + idList + ")");
  return \`SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x."documentId", x."documentVersionId"), '[]'::jsonb) AS enrich_json
FROM (
  SELECT DISTINCT ON (dv.document_id)
    dv.document_id AS "documentId",
    dv.id AS "documentVersionId",
    dv.version_number AS "versionNumber",
    COALESCE(dv.checksum, '') AS "contentHash",
    dv.created_at AS "updatedAt",
    COALESCE(dv.expiration_date, d.expiration_date) AS "expirationDate",
    dv.is_current AS "isCurrent",
    dv.processing_status AS "processingStatus",
    dv.validation_status AS "validationStatus",
    dv.extraction_method AS "ocrExtractionMethod",
    dv.ocr_quality_grade AS "ocrQualityGrade",
    dv.ocr_status AS "ocrStatus",
    dv.table_row_count AS "tableRowCount",
    dv.table_column_count AS "tableColumnCount",
    dv.embedding_model AS "embeddingModel",
    dv.embedding_status AS "embeddingStatus",
    dv.qdrant_sync_status AS "qdrantSyncStatus",
    dv.qdrant_synced_count AS "qdrantSyncedCount",
    d.deleted_at AS "deletedAt",
    (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'chunkId', c.id, 'contentHash', COALESCE(c.content_hash,''),
        'embeddingHash', c.embedding_hash
      ) ORDER BY c.chunk_order NULLS LAST, c.chunk_index NULLS LAST), '[]'::jsonb)
      FROM document_chunks c WHERE c.document_version_id = dv.id
    ) AS chunks
  FROM document_versions dv
  JOIN documents d ON d.id = dv.document_id
  WHERE \${where}
  ORDER BY dv.document_id, dv.is_current DESC, dv.version_number DESC
) x\`;
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Build keys',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [880, 0],
    parameters: { jsCode: buildKeysCode },
  },
  {
    id: randomUUID(),
    name: 'Lookup exact',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [1100, 0],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const op = String($('Build keys').first().json.operation || '');
  if (op !== 'lookup') return "SELECT NULL::uuid AS id, NULL::text AS cache_key_hash WHERE true";
  const h = String($('Build keys').first().json.cacheKeyHash || '').replace(/'/g, "''");
  if (!h) return "SELECT NULL::uuid AS id, NULL::text AS cache_key_hash WHERE true";
  return "SELECT id, cache_key_hash, scope_hash, prompt_version_id, retrieval_config_version_id, context_config_version_id, model_name, source_fingerprint, source_fingerprint_version, answer, sources, status, expires_at, created_at, conflict_detected, insufficient_context, contains_sensitive_data, hit_count, document_version_ids, source_document_ids FROM ai_semantic_cache_entries WHERE cache_key_hash='" + h + "' LIMIT 1 UNION ALL SELECT NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL WHERE NOT EXISTS (SELECT 1 FROM ai_semantic_cache_entries WHERE cache_key_hash='" + h + "') LIMIT 1";
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Load deps',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [1320, 0],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const op = String($('Build keys').first().json.operation || '');
  if (op !== 'lookup') return "SELECT '[]'::jsonb AS deps_json";
  const entry = $('Lookup exact').first().json || {};
  const id = String(entry.id || '').replace(/'/g,"''");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return "SELECT '[]'::jsonb AS deps_json";
  return \`SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb) AS deps_json FROM (
    SELECT dep.id, dep.cache_entry_id, dep.dependency_type, dep.document_id, dep.document_version_id,
      dep.document_version_number, dep.document_content_hash, dep.chunk_id, dep.chunk_content_hash,
      dep.expiration_date, dep.updated_at_snapshot, dep.content_hash,
      dv.is_current AS live_is_current,
      dv.checksum AS live_checksum,
      COALESCE(dv.expiration_date, d.expiration_date) AS live_expiration_date,
      d.deleted_at AS live_deleted_at,
      dv.ocr_status AS live_ocr_status,
      dv.ocr_quality_grade AS live_ocr_quality_grade,
      dv.embedding_status AS live_embedding_status,
      dv.qdrant_sync_status AS live_qdrant_sync_status,
      dv.table_row_count AS live_table_row_count,
      c.content_hash AS live_chunk_hash
    FROM ai_semantic_cache_dependencies dep
    LEFT JOIN document_versions dv ON dv.id = dep.document_version_id
    LEFT JOIN documents d ON d.id = dep.document_id
    LEFT JOIN document_chunks c ON c.id = dep.chunk_id
    WHERE dep.cache_entry_id = '\${id}'::uuid
  ) x\`;
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Decidir',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1540, 0],
    parameters: { jsCode: decideCode },
  },
  {
    id: randomUUID(),
    name: 'Persistir se necessário',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [1760, 0],
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const j = $json;
  const esc = (v) => v == null ? 'NULL' : ("'" + String(v).replace(/'/g, "''") + "'");
  const escJ = (v) => v == null ? "'[]'::jsonb" : ("'" + String(v).replace(/'/g, "''") + "'::jsonb");
  if (j.doLazyInvalidate && j.lazyInvalidateId) {
    const id = String(j.lazyInvalidateId).replace(/'/g,"''");
    const reason = String(j.lazyInvalidateReason||'DEPENDENCY_MISMATCH').replace(/'/g,"''").slice(0,80);
    return "UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE id='" + id + "'::uuid AND status='VALID' RETURNING id, 1 AS invalidated";
  }
  if (j.doSave && j.saveRow) {
    const r = j.saveRow;
    let deps = [];
    try { deps = JSON.parse(r.dependencyRows || '[]'); } catch(_) { deps = []; }
    const nearest = r.nearest_source_expiration ? esc(r.nearest_source_expiration) + '::timestamptz' : 'NULL';
    const insert = \`WITH upsert AS (
      INSERT INTO ai_semantic_cache_entries (
        cache_key_hash, question_hash, normalized_question, scope_hash, classification_hash,
        prompt_version_id, prompt_hash, retrieval_config_version_id, retrieval_config_hash,
        context_config_version_id, context_config_hash, model_name, model_parameters_hash,
        source_fingerprint, source_fingerprint_version, document_version_ids, source_document_ids,
        answer, sources, classification, response_hash, status, expires_at,
        conflict_detected, insufficient_context, contains_sensitive_data, cache_config_version_id,
        ttl_policy, effective_ttl_seconds, nearest_source_expiration
      ) VALUES (
        \${esc(r.cache_key_hash)}, \${esc(r.question_hash)}, \${esc(r.normalized_question)}, \${esc(r.scope_hash)}, \${esc(r.classification_hash)},
        \${esc(r.prompt_version_id)}::uuid, \${esc(r.prompt_hash)}, \${r.retrieval_config_version_id ? esc(r.retrieval_config_version_id)+'::uuid' : 'NULL'}, \${esc(r.retrieval_config_hash)},
        \${r.context_config_version_id ? esc(r.context_config_version_id)+'::uuid' : 'NULL'}, \${esc(r.context_config_hash)}, \${esc(r.model_name)}, \${esc(r.model_parameters_hash)},
        \${esc(r.source_fingerprint)}, \${esc(r.source_fingerprint_version||'source-fingerprint-v2')}, \${escJ(r.document_version_ids)}, \${escJ(r.source_document_ids)},
        \${esc(r.answer)}, \${escJ(r.sources)}, \${escJ(r.classification)},
        \${esc(r.response_hash)}, 'VALID', NOW() + (\${Number(r.ttl)||86400}) * INTERVAL '1 second',
        \${r.conflict_detected? 'true':'false'}, \${r.insufficient_context? 'true':'false'}, \${r.contains_sensitive_data? 'true':'false'},
        \${r.cache_config_version_id ? esc(r.cache_config_version_id)+'::uuid' : 'NULL'},
        \${esc(r.ttl_policy||'CONFIG_TTL')}, \${Number(r.effective_ttl_seconds||r.ttl)||86400}, \${nearest}
      )
      ON CONFLICT (cache_key_hash) DO UPDATE SET
        answer=EXCLUDED.answer, sources=EXCLUDED.sources, response_hash=EXCLUDED.response_hash,
        source_fingerprint=EXCLUDED.source_fingerprint, source_fingerprint_version=EXCLUDED.source_fingerprint_version,
        document_version_ids=EXCLUDED.document_version_ids, source_document_ids=EXCLUDED.source_document_ids,
        expires_at=EXCLUDED.expires_at, status='VALID', invalidated_at=NULL, invalidation_reason=NULL,
        ttl_policy=EXCLUDED.ttl_policy, effective_ttl_seconds=EXCLUDED.effective_ttl_seconds,
        nearest_source_expiration=EXCLUDED.nearest_source_expiration,
        last_hit_at=COALESCE(ai_semantic_cache_entries.last_hit_at, NOW())
      RETURNING id
    ), wipe AS (
      DELETE FROM ai_semantic_cache_dependencies WHERE cache_entry_id = (SELECT id FROM upsert)
    )\`;
    const depValues = (deps || []).filter(d => d.document_id).map(d => {
      return \`((SELECT id FROM upsert), \${esc(d.dependency_type||'DOCUMENT_VERSION')}, \${esc(d.document_id)}::uuid, \${d.document_version_id?esc(d.document_version_id)+'::uuid':'NULL'}, \${d.document_version_number!=null?Number(d.document_version_number):'NULL'}, \${esc(d.document_content_hash)}, NULL, NULL, \${d.expiration_date?esc(d.expiration_date)+'::timestamptz':'NULL'}, \${d.updated_at_snapshot?esc(d.updated_at_snapshot)+'::timestamptz':'NULL'}, \${esc(d.content_hash||d.document_content_hash)})\`;
    });
    if (depValues.length) {
      return insert + \`, insdep AS (
        INSERT INTO ai_semantic_cache_dependencies (
          cache_entry_id, dependency_type, document_id, document_version_id, document_version_number,
          document_content_hash, chunk_id, chunk_content_hash, expiration_date, updated_at_snapshot, content_hash
        ) VALUES \${depValues.join(',')}
        RETURNING id
      )
      SELECT (SELECT id FROM upsert) AS id, (SELECT COUNT(*) FROM insdep)::int AS deps_saved\`;
    }
    return insert + \` SELECT id, 0 AS deps_saved FROM upsert\`;
  }
  if (j.doBumpHit && j.entryId) {
    const id = String(j.entryId).replace(/'/g,"''");
    const shadow = j.cacheMeta && j.cacheMeta.shadowCandidateFound ? 1 : 0;
    const served = j.serveFromCache ? 1 : 0;
    return "UPDATE ai_semantic_cache_entries SET hit_count=hit_count+1, last_hit_at=NOW(), validation_count=validation_count+1, shadow_candidate_count=shadow_candidate_count+" + shadow + ", served_hit_count=served_hit_count+" + served + " WHERE id='" + id + "'::uuid RETURNING id";
  }
  if (j.doInvalidate) {
    const reason = String(j.reason||j.eventType||'MANUAL').replace(/'/g,"''").slice(0,80);
    if (j.documentVersionId) {
      const v = String(j.documentVersionId).replace(/'/g,"''");
      return "SELECT * FROM ai_cache_invalidate_by_document_version('" + v + "'::uuid, '" + reason + "')";
    }
    if (j.documentId) {
      const d = String(j.documentId).replace(/'/g,"''");
      return "SELECT * FROM ai_cache_invalidate_by_document('" + d + "'::uuid, '" + reason + "')";
    }
    if (j.promptVersionId) {
      const p = String(j.promptVersionId).replace(/'/g,"''");
      return "WITH u AS (UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND prompt_version_id='" + p + "'::uuid RETURNING id) SELECT COUNT(*)::int AS matched_entries, COUNT(*)::int AS invalidated_entries FROM u";
    }
    if (j.contextConfigVersionId) {
      const c = String(j.contextConfigVersionId).replace(/'/g,"''");
      return "WITH u AS (UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND context_config_version_id='" + c + "'::uuid RETURNING id) SELECT COUNT(*)::int AS matched_entries, COUNT(*)::int AS invalidated_entries FROM u";
    }
    if (j.retrievalConfigVersionId) {
      const r = String(j.retrievalConfigVersionId).replace(/'/g,"''");
      return "WITH u AS (UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND retrieval_config_version_id='" + r + "'::uuid RETURNING id) SELECT COUNT(*)::int AS matched_entries, COUNT(*)::int AS invalidated_entries FROM u";
    }
    if (j.modelName) {
      const m = String(j.modelName).replace(/'/g,"''");
      return "WITH u AS (UPDATE ai_semantic_cache_entries SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='" + reason + "' WHERE status='VALID' AND model_name='" + m + "' RETURNING id) SELECT COUNT(*)::int AS matched_entries, COUNT(*)::int AS invalidated_entries FROM u";
    }
    return "SELECT 0 AS matched_entries, 0 AS invalidated_entries";
  }
  if (j.doCleanup) {
    const maxEntries = Number(j.maxEntries||5000);
    const maxPerScope = Number(j.maxEntriesPerScope||500);
    return \`WITH exp AS (
        UPDATE ai_semantic_cache_entries SET status='EXPIRED'
        WHERE status='VALID' AND expires_at < NOW() RETURNING id
      ),
      lru_global AS (
        UPDATE ai_semantic_cache_entries e SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='LRU_MAX_ENTRIES'
        WHERE e.id IN (
          SELECT id FROM ai_semantic_cache_entries
          WHERE status='VALID'
          ORDER BY COALESCE(last_hit_at, created_at) ASC
          OFFSET \${maxEntries}
        ) AND e.status='VALID'
        RETURNING id
      ),
      lru_scope AS (
        UPDATE ai_semantic_cache_entries e SET status='INVALIDATED', invalidated_at=NOW(), invalidation_reason='LRU_MAX_PER_SCOPE'
        WHERE e.id IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY scope_hash ORDER BY COALESCE(last_hit_at, created_at) DESC) AS rn
            FROM ai_semantic_cache_entries WHERE status='VALID'
          ) t WHERE rn > \${maxPerScope}
        ) AND e.status='VALID'
        RETURNING id
      ),
      del AS (
        DELETE FROM ai_semantic_cache_entries
        WHERE status IN ('EXPIRED','INVALIDATED')
          AND COALESCE(invalidated_at, expires_at, created_at) < NOW() - INTERVAL '30 days'
        RETURNING id
      ),
      orphan AS (
        DELETE FROM ai_semantic_cache_dependencies dep
        WHERE NOT EXISTS (SELECT 1 FROM ai_semantic_cache_entries e WHERE e.id = dep.cache_entry_id)
        RETURNING id
      )
      SELECT (SELECT COUNT(*) FROM exp)::int AS expired,
             (SELECT COUNT(*) FROM lru_global)::int AS evicted_global,
             (SELECT COUNT(*) FROM lru_scope)::int AS evicted_scope,
             (SELECT COUNT(*) FROM del)::int AS deleted,
             (SELECT COUNT(*) FROM orphan)::int AS orphan_deps\`;
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
    position: [1980, 0],
    parameters: {
      jsCode: `const decided=$('Decidir').first().json||{};
const persist=$input.first().json||{};
const out={...decided, persistResult:persist};
if(decided.doInvalidate){
  out.success=true;
  out.matchedEntries=Number(persist.matched_entries??persist.invalidated??0)||0;
  out.invalidatedEntries=Number(persist.invalidated_entries??persist.invalidated??persist.matched_entries??0)||0;
  out.durationMs=(decided.cacheMeta&&decided.cacheMeta.lookupLatencyMs)||0;
}
if(decided.doCleanup){
  out.cleanup=persist;
}
return [{json:out}];`,
    },
  },
];

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Load config', type: 'main', index: 0 }]] },
  'Load config': { main: [[{ node: 'Enrich sources', type: 'main', index: 0 }]] },
  'Enrich sources': { main: [[{ node: 'Build keys', type: 'main', index: 0 }]] },
  'Build keys': { main: [[{ node: 'Lookup exact', type: 'main', index: 0 }]] },
  'Lookup exact': { main: [[{ node: 'Load deps', type: 'main', index: 0 }]] },
  'Load deps': { main: [[{ node: 'Decidir', type: 'main', index: 0 }]] },
  Decidir: { main: [[{ node: 'Persistir se necessário', type: 'main', index: 0 }]] },
  'Persistir se necessário': { main: [[{ node: 'Retornar', type: 'main', index: 0 }]] },
};

const runtimeVid = await upsertWorkflow({
  id: RUNTIME_ID,
  name: 'IA - CACHE RUNTIME',
  nodes,
  connections,
  active: true,
  description: 'Etapa 22.1 fingerprint v2 + lazy + deps',
});

// ---- IA - INVALIDAR CACHE POR EVENTO ----
const invNodes = [
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
          'eventType','documentId','documentVersionId','promptVersionId','retrievalConfigVersionId',
          'contextConfigVersionId','modelName','reasonCode','requestId','userId',
        ].map((name) => ({ name, type: 'string' })),
      },
    },
  },
  {
    id: randomUUID(),
    name: 'Chamar CACHE RUNTIME',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [280, 0],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: RUNTIME_ID },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          operation: "={{ 'invalidate_event' }}",
          eventType: '={{ $json.eventType || "" }}',
          documentId: '={{ $json.documentId || "" }}',
          documentVersionId: '={{ $json.documentVersionId || "" }}',
          promptVersionId: '={{ $json.promptVersionId || "" }}',
          retrievalConfigVersionId: '={{ $json.retrievalConfigVersionId || "" }}',
          contextConfigVersionId: '={{ $json.contextConfigVersionId || "" }}',
          modelName: '={{ $json.modelName || "" }}',
          reason: '={{ $json.reasonCode || $json.eventType || "EVENT" }}',
          reasonCode: '={{ $json.reasonCode || $json.eventType || "EVENT" }}',
          requestId: '={{ $json.requestId || "" }}',
          userId: '={{ $json.userId || "" }}',
        },
      },
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Normalizar saída',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [560, 0],
    parameters: {
      jsCode: `const t=$('Trigger').first().json||{};
const r=$input.first().json||{};
return [{json:{
  success: r.success !== false,
  matchedEntries: Number(r.matchedEntries||0),
  invalidatedEntries: Number(r.invalidatedEntries||0),
  durationMs: Number(r.durationMs||0),
  eventType: t.eventType||null,
  reasonCode: t.reasonCode||t.eventType||null,
  requestId: t.requestId||null
}}];`,
    },
  },
];

const invConn = {
  Trigger: { main: [[{ node: 'Chamar CACHE RUNTIME', type: 'main', index: 0 }]] },
  'Chamar CACHE RUNTIME': { main: [[{ node: 'Normalizar saída', type: 'main', index: 0 }]] },
};

const invVid = await upsertWorkflow({
  id: INVALIDATE_ID,
  name: 'IA - INVALIDAR CACHE POR EVENTO',
  nodes: invNodes,
  connections: invConn,
  active: true,
  description: 'Etapa 22.1 central invalidation',
});

writeFileSync(
  new URL('./_e221-runtime.json', import.meta.url),
  JSON.stringify({ RUNTIME_ID, runtimeVid, INVALIDATE_ID, invVid }, null, 2),
);

await client.end();
console.log('done');
