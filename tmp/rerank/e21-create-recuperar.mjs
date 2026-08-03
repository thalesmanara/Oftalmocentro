#!/usr/bin/env node
/**
 * Create IA - RECUPERAR CONTEXTO and refactor Consulta IA to call it.
 * Preserves HYBRID/hybrid-v1 behavior; does not publish hybrid-rerank-v1.
 */
import pg from 'pg';
import { readFileSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const PG_CRED = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const OAI_CRED = { id: 'g6QTP6n02dss9A0d', name: 'OpenAI account' };
const PROJECT = 'WbvMM1wAedTR9qrk';
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const LOAD_CFG = 'sClDEVNVS0TGG2uq';
const QDRANT = 'YDnrXjzYUOrZVE6N';
const RERANK = 'nivEQHAqHWIwP8P8';

const dump = JSON.parse(readFileSync(new URL('./_e21_dump/8EXk5RkFW5cxnenL.json', import.meta.url), 'utf8'));
const textQuery = dump.nodes['Buscar chunks relevantes'].parameters.query;

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function codeNode(id, name, position, jsCode, extra = {}) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode },
    ...extra,
  };
}

function execWf(id, name, position, workflowId, cachedName, inputs, extra = {}) {
  return {
    id,
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

function ifNode(id, name, position, leftExpr) {
  return {
    id,
    name,
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position,
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [
          {
            id: 'c1',
            leftValue: leftExpr,
            rightValue: true,
            operator: { type: 'boolean', operation: 'true' },
          },
        ],
      },
      looseTypeValidation: true,
    },
  };
}

const ids = {
  trigger: randomUUID(),
  prep: randomUUID(),
  loadCfg: randomUUID(),
  applyMode: randomUUID(),
  needVector: randomUUID(),
  prepEmbed: randomUUID(),
  embed: randomUUID(),
  extractVec: randomUUID(),
  skipVec: randomUUID(),
  callQdrant: randomUUID(),
  afterVec: randomUUID(),
  needText: randomUUID(),
  prepText: randomUUID(),
  textSearch: randomUUID(),
  skipText: randomUUID(),
  awaitBoth: randomUUID(),
  merge: randomUUID(),
  prepSel: randomUUID(),
  useRr: randomUUID(),
  callRr: randomUUID(),
  corte: randomUUID(),
  resolve: randomUUID(),
  montar: randomUUID(),
  auditStart: randomUUID(),
  auditOk: randomUUID(),
  ret: randomUUID(),
};

// --- Code payloads ---
const PREP_JS = `
const t=$input.first().json||{};
let classification={};
try { classification = typeof t.classificationJson==='string' ? JSON.parse(t.classificationJson||'{}') : (t.classification||{}); } catch(_) { classification={}; }
const question=String(t.question||classification.question||'').trim();
const normalizedQuestion=question.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim();
const requestId=String(t.requestId||'');
const userId=String(t.userId||'');
const sessionId=String(t.sessionId||'');
const retrievalConfigVersionId=String(t.retrievalConfigVersionId||t.versionId||'').trim();
const modeOverrideAllowed=t.modeOverrideAllowed===true || t.modeOverrideAllowed==='true' || !!retrievalConfigVersionId;
const startedAtMs=Date.now();
const questionHash=require('crypto').createHash('sha256').update(normalizedQuestion).digest('hex').slice(0,32);
return [{json:{
  question, normalizedQuestion, questionHash, classification,
  categoryId: classification.categoryId||null,
  subcategoryId: classification.subcategoryId||null,
  categoryName: classification.categoryName||null,
  subcategoryName: classification.subcategoryName||null,
  searchTerms: Array.isArray(classification.searchTerms)?classification.searchTerms:[],
  retrievalConfigVersionId, modeOverrideAllowed,
  requestId, userId, sessionId, startedAtMs,
  versionId: modeOverrideAllowed ? retrievalConfigVersionId : '',
}}];
`.trim();

const APPLY_MODE_JS = `
const prep=$('Preparar entrada').first().json||{};
const cfgNode=$input.first().json||{};
const cfg=cfgNode.configuration||{};
const mode=String(cfgNode.mode||cfg.mode||'HYBRID').toUpperCase();
const candidateLimit=Math.min(Math.max(Number(cfg.candidateLimit||30)||30,1),80);
const finalLimit=Math.min(Math.max(Number(cfg.finalLimit||12)||12,1),40);
const maxChunksPerDocument=Math.min(Math.max(Number(cfg.maxChunksPerDocument||4)||4,1),finalLimit);
const weights=cfg.weights||{semantic:0.65,lexical:0.35};
const needVector = mode==='VECTOR_ONLY' || mode==='HYBRID' || mode==='HYBRID_RERANK';
const needText = mode==='TEXT_ONLY' || mode==='HYBRID' || mode==='HYBRID_RERANK' || mode==='VECTOR_ONLY';
// VECTOR_ONLY also uses text enrichment path after vector via optional text; keep needText true for HYBRID parity.
// For VECTOR_ONLY we still run text search for content enrichment (same as current hybrid merge needs chunkText).
const runText = mode!=='VECTOR_ONLY' ? needText : true; // enrich content; for VECTOR_ONLY scores will prefer vector
const runVector = needVector;
return [{json:{
  ...prep,
  mode,
  runText, runVector,
  needVector: runVector,
  needText: runText,
  candidateLimit, finalLimit, maxChunksPerDocument, weights,
  configuration: cfg,
  configurationJson: JSON.stringify({...cfg, mode}),
  versionLabel: cfgNode.versionLabel||null,
  versionId: cfgNode.versionId||cfgNode.id||null,
  configCode: cfgNode.code||'AI_QUERY_RETRIEVAL',
  modeOverrideUsed: !!cfgNode.modeOverrideUsed || !!prep.retrievalConfigVersionId,
  contentHash: cfgNode.contentHash||null,
  cfgLoadedAtMs: Date.now(),
}}];
`.trim();

const SKIP_VEC_JS = `const p=$('Aplicar modo').first().json||{}; return [{json:{...p, hits:[], count:0, retrievalMode:'vector_skipped', vectorOk:false, vectorLatencyMs:0, queryVectorJson:'[]'}}];`;

const AFTER_VEC_JS = `
const mode=$('Aplicar modo').first().json||{};
const vec=$input.first().json||{};
const vectorLatencyMs=Date.now()-Number(mode.cfgLoadedAtMs||Date.now());
return [{json:{
  ...mode,
  hits: Array.isArray(vec.hits)?vec.hits:[],
  count: Number(vec.count||0),
  vectorOk: vec.ok===true,
  retrievalMode: vec.retrievalMode||'vector',
  vectorLatencyMs,
  queryVectorJson: mode.queryVectorJson||'[]',
}}];
`.trim();

const PREP_TEXT_JS = `
const base=$('Mesclar vetor').first().json||{};
// Buscar chunks expects classification-like fields on $json
return [{json:{
  ...base,
  question: base.question,
  categoryId: base.categoryId||'',
  subcategoryId: base.subcategoryId||'',
  categoryName: base.categoryName||'',
  subcategoryName: base.subcategoryName||'',
  searchTerms: base.searchTerms||[],
  textStartedAtMs: Date.now(),
}}];
`.trim();

const SKIP_TEXT_JS = `
const base=$('Mesclar vetor').first().json||{};
return [{json:{...base, textRows:[], textLatencyMs:0, textSkipped:true}}];
`.trim();

const MERGE_JS = `
const modeInfo=$('Aplicar modo').first().json||{};
const t0=Date.now();
const items=$input.all().map(i=>i.json);
let vectorHits=[];
const textRows=[];
let vectorLatencyMs=Number(modeInfo.vectorLatencyMs||0);
let textLatencyMs=0;
for(const it of items){
  if(Array.isArray(it.hits)) { vectorHits=it.hits; if(it.vectorLatencyMs!=null) vectorLatencyMs=Number(it.vectorLatencyMs); }
  else if(it.chunkText||it.documentId) textRows.push(it);
}
// text latency from prep if available
try { const pt=$('Preparar busca texto').first().json; if(pt&&pt.textStartedAtMs) textLatencyMs=Date.now()-Number(pt.textStartedAtMs); } catch(_){}
const wV=Number(modeInfo.weights?.semantic ?? 0.65);
const wT=Number(modeInfo.weights?.lexical ?? 0.35);
const maxText=Math.max(1,...textRows.map(r=>Number(r.relevance||0)));
const byKey=new Map();
function keyOf(docId,order){return String(docId)+':'+String(order);}
for(const h of vectorHits){
  const k=keyOf(h.documentId,h.chunkIndex);
  byKey.set(k,{chunkId:h.chunkId||null,documentId:h.documentId,documentTitle:h.documentTitle,sectorId:h.sectorId,categoryId:h.categoryId,subcategoryId:h.subcategoryId,chunkIndex:h.chunkIndex,chunkKind:h.chunkKind,sheetName:h.sheetName,ocrQuality:h.ocrQuality,vectorScore:Number(h.vectorScore||0),textScore:0,chunkText:null,versionId:h.documentVersionId,isCurrent:h.isCurrent!==false});
}
for(const r of textRows){
  const k=keyOf(r.documentId,r.chunkOrder);
  const textScore=Number(r.relevance||0)/maxText;
  const row=byKey.get(k)||{chunkId:r.chunkId||null,documentId:r.documentId,documentTitle:r.documentTitle,sectorId:r.sectorId,categoryId:r.categoryId,subcategoryId:r.subcategoryId,chunkIndex:r.chunkOrder,chunkKind:r.chunkKind,sheetName:r.sheetName,ocrQuality:null,vectorScore:0,textScore:0,chunkText:null,versionId:r.versionId,isCurrent:true};
  row.textScore=Math.max(row.textScore||0,textScore);
  row.chunkText=r.chunkText||row.chunkText;
  row.chunkId=row.chunkId||r.chunkId||null;
  row.documentTitle=r.documentTitle||row.documentTitle;
  row.sectorName=r.sectorName; row.categoryName=r.categoryName; row.subcategoryName=r.subcategoryName;
  row.categoryDescription=r.categoryDescription; row.subcategoryDescription=r.subcategoryDescription;
  row.vigencyDate=r.vigencyDate; row.documentUpdatedAt=r.documentUpdatedAt; row.versionNumber=r.versionNumber; row.versionId=r.versionId||row.versionId;
  byKey.set(k,row);
}
const catId=modeInfo.categoryId||null, subId=modeInfo.subcategoryId||null;
const merged=[];
for(const row of byKey.values()){
  if(!row.chunkText) continue;
  let boost=0;
  if(subId&&row.subcategoryId===subId) boost+=0.15; else if(catId&&row.categoryId===catId) boost+=0.10;
  const ocr=String(row.ocrQuality||'').toUpperCase();
  if(ocr==='EXCELLENT'||ocr==='GOOD') boost+=0.05;
  if(String(row.chunkKind||'').toLowerCase()==='tabular') boost+=0.05;
  if(row.isCurrent!==false) boost+=0.05;
  const vectorNorm=Math.max(0,Math.min(1,Number(row.vectorScore||0)));
  const textNorm=Math.max(0,Math.min(1,Number(row.textScore||0)));
  const mergedScore=wV*vectorNorm+wT*textNorm+boost;
  merged.push({chunkId:row.chunkId,documentId:row.documentId,documentTitle:row.documentTitle,sectorId:row.sectorId,sectorName:row.sectorName,categoryId:row.categoryId,categoryName:row.categoryName,categoryDescription:row.categoryDescription,subcategoryId:row.subcategoryId,subcategoryName:row.subcategoryName,subcategoryDescription:row.subcategoryDescription,vigencyDate:row.vigencyDate,documentUpdatedAt:row.documentUpdatedAt,versionNumber:row.versionNumber,versionId:row.versionId,chunkOrder:row.chunkIndex,chunkText:row.chunkText,chunkKind:row.chunkKind,sheetName:row.sheetName,relevance:Math.round(mergedScore*1000),vectorScore:vectorNorm,textScore:textNorm,mergedScore,hybridScore:mergedScore,retrievalMode:vectorHits.length?'hybrid':(textRows.length?'text_only':'empty')});
}
merged.sort((a,b)=>b.mergedScore-a.mergedScore);
const candidatePool=Number(modeInfo.candidateLimit||30);
const top=merged.slice(0,candidatePool);
const mergeLatencyMs=Date.now()-t0;
const fallbackUsed = modeInfo.runVector && !vectorHits.length && textRows.length>0;
const fallbackReason = fallbackUsed ? 'vector_empty_text_fallback' : null;
const metaBase={
  mode: modeInfo.mode,
  configCode: modeInfo.configCode||'AI_QUERY_RETRIEVAL',
  configVersionId: modeInfo.versionId||null,
  configVersion: modeInfo.versionLabel||null,
  rankingVersion: modeInfo.versionLabel||null,
  candidateCount: top.length,
  deduplicatedCount: byKey.size,
  vectorLatencyMs, textLatencyMs, mergeLatencyMs,
  fallbackUsed, fallbackReason,
  modeOverrideUsed: !!modeInfo.modeOverrideUsed,
  requestId: modeInfo.requestId||null,
};
if(!top.length){
  const fb=textRows.slice(0,12).map(r=>({json:{...r,retrievalMode:'text_fallback', _pipelineMeta:metaBase, _modeInfo:modeInfo}}));
  if(fb.length) return fb;
  return [{json:{_empty:true,_pipelineMeta:metaBase,_modeInfo:modeInfo}}];
}
return top.map((r,i)=>({json:{...r, hybridRank:i+1, candidatePool, _pipelineMeta:metaBase, _modeInfo:modeInfo}}));
`.trim();

const PREP_SEL_JS = `
const rows=$input.all().map(i=>i.json).filter(r=>r&&!r._empty&&(r.chunkText||r.documentId));
const first=$input.first().json||{};
const modeInfo=first._modeInfo||$('Aplicar modo').first().json||{};
const meta=first._pipelineMeta||{};
const mode=String(modeInfo.mode||'HYBRID').toUpperCase();
const finalLimit=Number(modeInfo.finalLimit||12)||12;
const candidates=rows.map(({_pipelineMeta,_modeInfo,...rest})=>rest);
const useRerank=mode==='HYBRID_RERANK';
return [{json:{
  mode, useRerank, finalLimit,
  versionLabel: modeInfo.versionLabel||'hybrid-v1',
  versionId: modeInfo.versionId||null,
  configurationJson: modeInfo.configurationJson||JSON.stringify(modeInfo.configuration||{}),
  classificationJson: JSON.stringify({
    categoryId: modeInfo.categoryId||null,
    subcategoryId: modeInfo.subcategoryId||null,
    categoryName: modeInfo.categoryName||null,
    subcategoryName: modeInfo.subcategoryName||null,
    searchTerms: modeInfo.searchTerms||[],
  }),
  candidatesJson: JSON.stringify(candidates),
  candidates,
  question: modeInfo.question||'',
  requestId: modeInfo.requestId||'',
  userId: modeInfo.userId||'',
  sessionId: modeInfo.sessionId||'',
  pipelineMeta: meta,
  modeInfo,
  rerankStartedAtMs: Date.now(),
}}];
`.trim();

const RESOLVE_JS = `
const prep=$('Preparar seleção').first().json||{};
const mode=String(prep.mode||'HYBRID').toUpperCase();
const finalLimit=Number(prep.finalLimit||12)||12;
const hybridCandidates=Array.isArray(prep.candidates)?prep.candidates:[];
const maxPerDoc=Number(prep.modeInfo?.maxChunksPerDocument||4)||4;
let ranked=[];
let fallbackUsed=!!(prep.pipelineMeta&&prep.pipelineMeta.fallbackUsed);
let rankingMetadata={mode, fallbackUsed:false, selectedCount:0, durationMs:0};
const rerankLatencyMs = mode==='HYBRID_RERANK' ? (Date.now()-Number(prep.rerankStartedAtMs||Date.now())) : 0;
if(mode==='HYBRID_RERANK'){
  const rr=$input.first().json||{};
  if(rr.ok===true && Array.isArray(rr.rankedCandidates) && rr.rankedCandidates.length){
    ranked=rr.rankedCandidates;
    rankingMetadata=rr.rankingMetadata||rankingMetadata;
  } else {
    fallbackUsed=true;
    rankingMetadata={mode:'HYBRID_FALLBACK', fallbackUsed:true, selectedCount:0, durationMs:rerankLatencyMs, error:rr.error||'rerank_failed'};
    ranked=hybridCandidates.slice(0, finalLimit).map((c,i)=>({...c, rerankPosition:i+1, rerankScore:c.mergedScore||0, selectionReason:'hybrid_fallback', retrievalMode:'hybrid_fallback'}));
  }
} else {
  ranked=hybridCandidates.slice(0, finalLimit).map((c,i)=>({...c, rerankPosition:i+1, rerankScore:c.mergedScore||0, selectionReason:mode.toLowerCase(), retrievalMode:c.retrievalMode||mode.toLowerCase()}));
  rankingMetadata={mode, fallbackUsed:false, selectedCount:ranked.length, durationMs:0, versionLabel:prep.versionLabel||null};
}
// Diversidade: maxChunksPerDocument (preserva ordem)
const perDoc=new Map();
const diversified=[];
for(const c of ranked){
  const id=String(c.documentId||'');
  const n=perDoc.get(id)||0;
  if(n>=maxPerDoc) continue;
  perDoc.set(id,n+1);
  diversified.push(c);
  if(diversified.length>=finalLimit) break;
}
if(!diversified.length) diversified.push(...ranked.slice(0,finalLimit));
ranked=diversified;
rankingMetadata.fallbackUsed=fallbackUsed||!!rankingMetadata.fallbackUsed;
rankingMetadata.selectedCount=ranked.length;
rankingMetadata.versionLabel=prep.versionLabel||rankingMetadata.versionLabel||null;
rankingMetadata.candidateCount=hybridCandidates.length;
rankingMetadata.rerankLatencyMs=rerankLatencyMs;
rankingMetadata.pipelineMeta=prep.pipelineMeta||{};
return ranked.length ? ranked.map((r)=>({json:{...r, rankingMetadata, retrievalConfigVersion:prep.versionLabel||null, fallbackUsed:rankingMetadata.fallbackUsed, _prep:prep}}))
  : [{json:{_empty:true, rankingMetadata, retrievalConfigVersion:prep.versionLabel||null, fallbackUsed:rankingMetadata.fallbackUsed, _prep:prep}}];
`.trim();

const MONTAR_JS = `
const t0=Date.now();
const items=$input.all().map(i=>i.json).filter(r=>r&&!r._empty&&(r.chunkText||r.text||r.documentId));
const first=$input.first().json||{};
const prep=first._prep||$('Preparar seleção').first().json||{};
const modeInfo=prep.modeInfo||{};
const rankingMetadata=first.rankingMetadata||{};
const pipelineMeta=rankingMetadata.pipelineMeta||prep.pipelineMeta||{};
const question=String(modeInfo.question||prep.question||'');
const classification={
  categoryId: modeInfo.categoryId??null,
  categoryName: modeInfo.categoryName??null,
  categoryDescription: modeInfo.classification?.categoryDescription??null,
  subcategoryId: modeInfo.subcategoryId??null,
  subcategoryName: modeInfo.subcategoryName??null,
  subcategoryDescription: null,
};
const contextChunks=items.map((row,index)=>({
  index:index+1,
  chunkId: row.chunkId||null,
  documentId: row.documentId,
  documentTitle: row.documentTitle,
  sectorId: row.sectorId??null,
  sectorName: row.sectorName??null,
  categoryId: row.categoryId??null,
  categoryName: row.categoryName??null,
  subcategoryId: row.subcategoryId??null,
  subcategoryName: row.subcategoryName??null,
  vigencyDate: row.vigencyDate??null,
  chunkOrder: row.chunkOrder,
  relevance: row.relevance??0,
  text: row.chunkText??row.text??'',
  vectorScore: row.vectorScore??null,
  textScore: row.textScore??null,
  hybridScore: row.hybridScore??row.mergedScore??null,
  rerankScore: row.rerankScore??null,
}));
const context=contextChunks.map(source=>\`[Fontes \${source.index}]

Documento: \${source.documentTitle || 'Não informado'}
Setor: \${source.sectorName || 'Não informado'}
Categoria: \${source.categoryName || 'Não informada'}
Subcategoria: \${source.subcategoryName || 'Não informada'}
Data de vigência: \${source.vigencyDate || 'Não informada'}
Ordem do trecho: \${source.chunkOrder}
Relevância calculada: \${source.relevance}

Trecho documental:
\${source.text}\`.trim()).join('\\n\\n------------------------------\\n\\n');
const uniqueSourcesMap=new Map();
for(const source of contextChunks){
  if(!source.documentId) continue;
  const existing=uniqueSourcesMap.get(source.documentId);
  if(!existing){
    uniqueSourcesMap.set(source.documentId,{
      documentId:source.documentId, documentTitle:source.documentTitle,
      sectorId:source.sectorId, sectorName:source.sectorName,
      categoryId:source.categoryId, categoryName:source.categoryName,
      subcategoryId:source.subcategoryId, subcategoryName:source.subcategoryName,
      vigencyDate:source.vigencyDate, relevance:source.relevance
    });
  } else if(Number(source.relevance)>Number(existing.relevance)) existing.relevance=source.relevance;
}
const sources=[...uniqueSourcesMap.values()].sort((a,b)=>Number(b.relevance)-Number(a.relevance)).map((source,index)=>({
  index:index+1,
  documentId:source.documentId,
  documentTitle:source.documentTitle,
  sectorId:source.sectorId,
  sectorName:source.sectorName,
  categoryId:source.categoryId,
  categoryName:source.categoryName,
  subcategoryId:source.subcategoryId,
  subcategoryName:source.subcategoryName,
  vigencyDate:source.vigencyDate,
}));
const rankedDocumentIds=contextChunks.map(c=>c.documentId).filter(Boolean);
const rankedChunkIds=contextChunks.map(c=>c.chunkId).filter(Boolean);
const sourceDocumentIds=sources.map(s=>s.documentId).filter(Boolean);
const contextBuildLatencyMs=Date.now()-t0;
const retrievalLatencyMs=Date.now()-Number(modeInfo.startedAtMs||Date.now());
const retrievalMeta={
  mode: rankingMetadata.mode||modeInfo.mode||'HYBRID',
  configCode: modeInfo.configCode||'AI_QUERY_RETRIEVAL',
  configVersionId: modeInfo.versionId||null,
  configVersion: modeInfo.versionLabel||null,
  rankingVersion: modeInfo.versionLabel||null,
  candidateCount: Number(rankingMetadata.candidateCount??pipelineMeta.candidateCount??0),
  deduplicatedCount: Number(pipelineMeta.deduplicatedCount??0),
  rerankedCount: String(modeInfo.mode||'').toUpperCase()==='HYBRID_RERANK' && !rankingMetadata.fallbackUsed ? contextChunks.length : 0,
  selectedCount: contextChunks.length,
  retrievalLatencyMs,
  vectorLatencyMs: Number(pipelineMeta.vectorLatencyMs??0),
  textLatencyMs: Number(pipelineMeta.textLatencyMs??0),
  mergeLatencyMs: Number(pipelineMeta.mergeLatencyMs??0),
  rerankLatencyMs: Number(rankingMetadata.rerankLatencyMs??0),
  contextBuildLatencyMs,
  fallbackUsed: !!(rankingMetadata.fallbackUsed||pipelineMeta.fallbackUsed),
  fallbackReason: rankingMetadata.fallbackUsed ? (rankingMetadata.error||'rerank_fallback') : (pipelineMeta.fallbackReason||null),
  rankedDocumentIds,
  rankedChunkIds,
  sourceDocumentIds,
  requestId: modeInfo.requestId||null,
  modeOverrideUsed: !!modeInfo.modeOverrideUsed,
  normalizedQuestion: modeInfo.normalizedQuestion||null,
  questionHash: modeInfo.questionHash||null,
};
const selectedChunks=contextChunks.map(c=>({
  chunkId:c.chunkId, documentId:c.documentId, documentVersionId:null, content:c.text,
  chunkIndex:c.chunkOrder, vectorScore:c.vectorScore, textScore:c.textScore, hybridScore:c.hybridScore, rerankScore:c.rerankScore,
  documentTitle:c.documentTitle, sectorName:c.sectorName, categoryName:c.categoryName, subcategoryName:c.subcategoryName,
}));
return [{json:{
  context, sources, selectedChunks, retrievalMeta,
  question, classification,
  diagnostic:{ totalChunks:contextChunks.length, totalDocuments:sources.length },
  requestId: modeInfo.requestId||'',
  userId: modeInfo.userId||'',
  sessionId: modeInfo.sessionId||'',
}}];
`.trim();

const nodes = [
  {
    id: ids.trigger,
    name: 'Trigger',
    type: 'n8n-nodes-base.executeWorkflowTrigger',
    typeVersion: 1.2,
    position: [0, 0],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'question', type: 'string' },
          { name: 'classificationJson', type: 'string' },
          { name: 'retrievalConfigVersionId', type: 'string' },
          { name: 'modeOverrideAllowed', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
        ],
      },
    },
  },
  codeNode(ids.prep, 'Preparar entrada', [220, 0], PREP_JS),
  execWf(ids.auditStart, 'Auditar START', [440, -120], AUDIT, 'AUDITORIA - REGISTRAR', {
    action: 'AI_RETRIEVAL_STARTED',
    resourceType: 'ai_retrieval',
    resourceId: '={{ $json.requestId || "" }}',
    success: '={{ true }}',
    requestId: '={{ $json.requestId || "" }}',
    userId: '={{ $json.userId || "" }}',
    sessionId: '={{ $json.sessionId || "" }}',
    metadata: '={{ { modeOverrideAllowed: !!$json.modeOverrideAllowed, hasVersionId: !!$json.retrievalConfigVersionId, questionHash: $json.questionHash || null } }}',
  }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
  codeNode(ids.prep + '-pass', 'Repassar após audit start', [660, -120], `return [$('Preparar entrada').first()];`),
  execWf(ids.loadCfg, 'Carregar retrieval config', [880, 0], LOAD_CFG, 'IA - CARREGAR RETRIEVAL CONFIG', {
    requestId: '={{ $json.requestId || "" }}',
    modeOverride: '',
    versionId: '={{ $json.versionId || "" }}',
  }),
  codeNode(ids.applyMode, 'Aplicar modo', [1100, 0], APPLY_MODE_JS),
  ifNode(ids.needVector, 'Precisa vetor?', [1320, 0], '={{ $json.needVector === true }}'),
  codeNode(ids.prepEmbed, 'Preparar embedding', [1540, -120], `const cls=$input.first().json||{};const question=String(cls.question||'').trim();return [{json:{...cls,openaiBody:{model:'text-embedding-3-small',input:question||' '},hasQuestion:!!question,embedStartedAtMs:Date.now()}}];`),
  {
    id: ids.embed,
    name: 'Embed pergunta',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [1760, -120],
    credentials: { openAiApi: OAI_CRED },
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/embeddings',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: "={{ $('Preparar embedding').first().json.openaiBody }}",
      options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  codeNode(
    ids.extractVec,
    'Extrair vetor',
    [1980, -120],
    `const cls=$('Preparar embedding').first().json||{};const resp=$input.first().json||{};const statusCode=Number(resp.statusCode??resp.status??0);let body=resp.body??resp.data??resp;if(typeof body==='string'){try{body=JSON.parse(body);}catch(_){body={};}}const emb=(body&&body.data&&body.data[0]&&body.data[0].embedding)||null;const ok=statusCode>=200&&statusCode<300&&Array.isArray(emb);const topK=Number(cls.candidateLimit||30)||30;return [{json:{...cls,queryVector:emb||[],queryVectorJson:JSON.stringify(emb||[]),vectorOk:ok,topK,categoryId:cls.categoryId||'',subcategoryId:cls.subcategoryId||''}}];`,
  ),
  execWf(ids.callQdrant, 'Busca vetorial Qdrant', [2200, -120], QDRANT, 'QDRANT - BUSCAR', {
    queryVectorJson: '={{ $json.queryVectorJson }}',
    topK: '={{ Number($json.topK || 12) }}',
    categoryId: '={{ $json.categoryId || "" }}',
    subcategoryId: '={{ $json.subcategoryId || "" }}',
  }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
  codeNode(ids.skipVec, 'Pular vetor', [1540, 120], SKIP_VEC_JS),
  codeNode(ids.afterVec, 'Mesclar vetor', [2420, 0], AFTER_VEC_JS),
  ifNode(ids.needText, 'Precisa texto?', [2640, 0], '={{ $json.needText === true }}'),
  codeNode(ids.prepText, 'Preparar busca texto', [2860, -80], PREP_TEXT_JS),
  {
    id: ids.textSearch,
    name: 'Buscar chunks relevantes',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [3080, -80],
    credentials: { postgres: PG_CRED },
    parameters: { operation: 'executeQuery', options: {}, query: textQuery },
    alwaysOutputData: true,
  },
  codeNode(ids.skipText, 'Pular texto', [2860, 120], SKIP_TEXT_JS),
  {
    id: ids.awaitBoth,
    name: 'Aguardar recuperações',
    type: 'n8n-nodes-base.merge',
    typeVersion: 3,
    position: [3300, 0],
    parameters: { mode: 'append', options: {} },
  },
  codeNode(ids.merge, 'Merge híbrido', [3520, 0], MERGE_JS),
  codeNode(ids.prepSel, 'Preparar seleção', [3740, 0], PREP_SEL_JS),
  ifNode(ids.useRr, 'Usar re-ranking?', [3960, 0], '={{ $json.useRerank === true }}'),
  execWf(ids.callRr, 'Chamar RE-RANQUEAR', [4180, -100], RERANK, 'IA - RE-RANQUEAR CANDIDATOS', {
    question: '={{ $json.question }}',
    classificationJson: '={{ $json.classificationJson }}',
    candidatesJson: '={{ $json.candidatesJson }}',
    configurationJson: '={{ $json.configurationJson }}',
    requestId: '={{ $json.requestId }}',
    userId: '={{ $json.userId }}',
    sessionId: '={{ $json.sessionId }}',
  }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
  codeNode(ids.corte, 'Corte hybrid padrão', [4180, 100], `const prep=$input.first().json||{}; return [{json:prep}];`),
  codeNode(ids.resolve, 'Resolver ranking final', [4400, 0], RESOLVE_JS),
  codeNode(ids.montar, 'Montar contexto atual', [4620, 0], MONTAR_JS),
  execWf(ids.auditOk, 'Auditar SUCCESS', [4840, 0], AUDIT, 'AUDITORIA - REGISTRAR', {
    action: 'AI_RETRIEVAL_SUCCESS',
    resourceType: 'ai_retrieval',
    resourceId: '={{ $json.requestId || "" }}',
    success: '={{ true }}',
    requestId: '={{ $json.requestId || "" }}',
    userId: '={{ $json.userId || "" }}',
    sessionId: '={{ $json.sessionId || "" }}',
    metadata: '={{ { mode: $json.retrievalMeta?.mode, configVersion: $json.retrievalMeta?.configVersion, selectedCount: $json.retrievalMeta?.selectedCount, candidateCount: $json.retrievalMeta?.candidateCount, fallbackUsed: !!$json.retrievalMeta?.fallbackUsed, retrievalLatencyMs: $json.retrievalMeta?.retrievalLatencyMs } }}',
  }, { onError: 'continueRegularOutput', alwaysOutputData: true }),
  codeNode(ids.ret, 'Retorno', [5060, 0], `return [$('Montar contexto atual').first()];`),
];

// Fix: audit start chain - I used prep+'-pass' as id incorrectly with codeNode helper
// Rebuild pass node id properly
const passId = randomUUID();
nodes.find((n) => n.name === 'Repassar após audit start').id = passId;

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Auditar START', type: 'main', index: 0 }]] },
  'Auditar START': { main: [[{ node: 'Repassar após audit start', type: 'main', index: 0 }]] },
  'Repassar após audit start': { main: [[{ node: 'Carregar retrieval config', type: 'main', index: 0 }]] },
  'Carregar retrieval config': { main: [[{ node: 'Aplicar modo', type: 'main', index: 0 }]] },
  'Aplicar modo': { main: [[{ node: 'Precisa vetor?', type: 'main', index: 0 }]] },
  'Precisa vetor?': {
    main: [
      [{ node: 'Preparar embedding', type: 'main', index: 0 }],
      [{ node: 'Pular vetor', type: 'main', index: 0 }],
    ],
  },
  'Preparar embedding': { main: [[{ node: 'Embed pergunta', type: 'main', index: 0 }]] },
  'Embed pergunta': { main: [[{ node: 'Extrair vetor', type: 'main', index: 0 }]] },
  'Extrair vetor': { main: [[{ node: 'Busca vetorial Qdrant', type: 'main', index: 0 }]] },
  'Busca vetorial Qdrant': { main: [[{ node: 'Mesclar vetor', type: 'main', index: 0 }]] },
  'Pular vetor': { main: [[{ node: 'Mesclar vetor', type: 'main', index: 0 }]] },
  'Mesclar vetor': { main: [[{ node: 'Precisa texto?', type: 'main', index: 0 }]] },
  'Precisa texto?': {
    main: [
      [{ node: 'Preparar busca texto', type: 'main', index: 0 }],
      [{ node: 'Pular texto', type: 'main', index: 0 }],
    ],
  },
  'Preparar busca texto': { main: [[{ node: 'Buscar chunks relevantes', type: 'main', index: 0 }]] },
  'Buscar chunks relevantes': { main: [[{ node: 'Aguardar recuperações', type: 'main', index: 0 }]] },
  'Pular texto': { main: [[{ node: 'Aguardar recuperações', type: 'main', index: 0 }]] },
  // Also feed vector side into merge via second input? Using append merge - need BOTH text and vector as separate items.
  // Current design: Mesclar vetor goes only to Precisa texto. Vector hits must reach Aguardar.
  // Fix connections: Mesclar vetor ALSO to Aguardar, and text to Aguardar.
  'Aguardar recuperações': { main: [[{ node: 'Merge híbrido', type: 'main', index: 0 }]] },
  'Merge híbrido': { main: [[{ node: 'Preparar seleção', type: 'main', index: 0 }]] },
  'Preparar seleção': { main: [[{ node: 'Usar re-ranking?', type: 'main', index: 0 }]] },
  'Usar re-ranking?': {
    main: [
      [{ node: 'Chamar RE-RANQUEAR', type: 'main', index: 0 }],
      [{ node: 'Corte hybrid padrão', type: 'main', index: 0 }],
    ],
  },
  'Chamar RE-RANQUEAR': { main: [[{ node: 'Resolver ranking final', type: 'main', index: 0 }]] },
  'Corte hybrid padrão': { main: [[{ node: 'Resolver ranking final', type: 'main', index: 0 }]] },
  'Resolver ranking final': { main: [[{ node: 'Montar contexto atual', type: 'main', index: 0 }]] },
  'Montar contexto atual': { main: [[{ node: 'Auditar SUCCESS', type: 'main', index: 0 }]] },
  'Auditar SUCCESS': { main: [[{ node: 'Retorno', type: 'main', index: 0 }]] },
};

// Fix vector path into Aguardar: after Mesclar vetor, we need vector item AND text items.
// Better: from Mesclar vetor → split: always send to Aguardar (vector envelope), AND Precisa texto.
connections['Mesclar vetor'] = {
  main: [
    [
      { node: 'Aguardar recuperações', type: 'main', index: 0 },
      { node: 'Precisa texto?', type: 'main', index: 0 },
    ],
  ],
};

const wfId = 'RcCtx' + randomUUID().replace(/-/g, '').slice(0, 12); // n8n ids are often 16 chars
const shortId = randomUUID().replace(/-/g, '').slice(0, 16);

const existing = await client.query(`SELECT id FROM workflow_entity WHERE name='IA - RECUPERAR CONTEXTO' LIMIT 1`);
let recuperarId = existing.rows[0]?.id;
if (!recuperarId) {
  recuperarId = shortId;
  await client.query(
    `INSERT INTO workflow_entity (
      id, name, active, nodes, connections, settings, "staticData",
      "pinData", "versionId", "triggerCount", meta, "parentFolderId",
      "createdAt", "updatedAt", "isArchived", "activeVersionId"
    ) VALUES (
      $1, 'IA - RECUPERAR CONTEXTO', true, $2::json, $3::json,
      $4::json, NULL, NULL, $5, 0, $6::json, NULL, NOW(), NOW(), false, NULL
    )`,
    [
      recuperarId,
      JSON.stringify(nodes),
      JSON.stringify(connections),
      JSON.stringify({ executionOrder: 'v1', availableInMCP: true }),
      randomUUID(),
      JSON.stringify({ aiBuilderAssisted: true, builderVariant: 'etapa21-recuperar-contexto' }),
    ],
  );
  // shared project link if table exists
  try {
    await client.query(
      `INSERT INTO shared_workflow ("workflowId", "projectId", role, "createdAt", "updatedAt")
       VALUES ($1, $2, 'workflow:owner', NOW(), NOW()) ON CONFLICT DO NOTHING`,
      [recuperarId, PROJECT],
    );
  } catch (_) {}
} else {
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(nodes), JSON.stringify(connections), recuperarId],
  );
}

writeFileSync(
  new URL('./_e21-recuperar-created.json', import.meta.url),
  JSON.stringify({ recuperarId, nodeCount: nodes.length, names: nodes.map((n) => n.name) }, null, 2),
);
console.log(JSON.stringify({ recuperarId, nodeCount: nodes.length }, null, 2));
await client.end();
