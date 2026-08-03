#!/usr/bin/env node
/**
 * Etapa 21 — create IA - RECUPERAR CONTEXTO (sequential pipeline) + refactor Consulta IA.
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
const CONSULTA = '8EXk5RkFW5cxnenL';

const dump = JSON.parse(readFileSync(new URL('./_e21_dump/8EXk5RkFW5cxnenL.json', import.meta.url), 'utf8'));
const textQuery = dump.nodes['Buscar chunks relevantes'].parameters.query;

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const uid = () => randomUUID();

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
function iff(name, position, expr) {
  return {
    id: uid(),
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
            leftValue: expr,
            rightValue: true,
            operator: { type: 'boolean', operation: 'true' },
          },
        ],
      },
      looseTypeValidation: true,
    },
  };
}

const nodes = [];
const add = (n) => {
  nodes.push(n);
  return n.name;
};

add({
  id: uid(),
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
});

add(
  code(
    'Preparar entrada',
    [220, 0],
    `const t=$input.first().json||{};
let classification={};
try{classification=typeof t.classificationJson==='string'?JSON.parse(t.classificationJson||'{}'):(t.classification||{});}catch(_){classification={};}
const question=String(t.question||classification.question||'').trim();
const normalizedQuestion=question.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim();
let h=0; for(const ch of normalizedQuestion){h=((h<<5)-h)+ch.charCodeAt(0);h|=0;}
const questionHash=Math.abs(h).toString(16);
const retrievalConfigVersionId=String(t.retrievalConfigVersionId||t.versionId||'').trim();
const modeOverrideAllowed=t.modeOverrideAllowed===true||t.modeOverrideAllowed==='true';
return [{json:{
  question, normalizedQuestion, questionHash, classification,
  categoryId:classification.categoryId||null,
  subcategoryId:classification.subcategoryId||null,
  categoryName:classification.categoryName||null,
  subcategoryName:classification.subcategoryName||null,
  searchTerms:Array.isArray(classification.searchTerms)?classification.searchTerms:[],
  retrievalConfigVersionId, modeOverrideAllowed,
  requestId:String(t.requestId||''), userId:String(t.userId||''), sessionId:String(t.sessionId||''),
  startedAtMs:Date.now(),
  versionId: modeOverrideAllowed ? retrievalConfigVersionId : '',
}}];`,
  ),
);

add(
  exec(
    'Auditar START',
    [440, -140],
    AUDIT,
    'AUDITORIA - REGISTRAR',
    {
      action: 'AI_RETRIEVAL_STARTED',
      resourceType: 'ai_retrieval',
      resourceId: '={{ $json.requestId || "" }}',
      success: '={{ true }}',
      requestId: '={{ $json.requestId || "" }}',
      userId: '={{ $json.userId || "" }}',
      sessionId: '={{ $json.sessionId || "" }}',
      metadata:
        '={{ { questionHash: $json.questionHash || null, modeOverrideAllowed: !!$json.modeOverrideAllowed } }}',
    },
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
);
add(code('Após audit start', [660, -140], `return [$('Preparar entrada').first()];`));

add(
  exec('Carregar retrieval config', [880, 0], LOAD_CFG, 'IA - CARREGAR RETRIEVAL CONFIG', {
    requestId: '={{ $json.requestId || "" }}',
    modeOverride: '',
    versionId: '={{ $json.versionId || "" }}',
  }),
);

add(
  code(
    'Aplicar modo',
    [1100, 0],
    `const prep=$('Preparar entrada').first().json||{};
const cfgNode=$input.first().json||{};
const cfg=cfgNode.configuration||{};
const mode=String(cfgNode.mode||cfg.mode||'HYBRID').toUpperCase();
const candidateLimit=Math.min(Math.max(Number(cfg.candidateLimit||30)||30,1),80);
const finalLimit=Math.min(Math.max(Number(cfg.finalLimit||12)||12,1),40);
const maxChunksPerDocument=Math.min(Math.max(Number(cfg.maxChunksPerDocument||4)||4,1),finalLimit);
const weights=cfg.weights||{semantic:0.65,lexical:0.35};
const needVector=mode==='VECTOR_ONLY'||mode==='HYBRID'||mode==='HYBRID_RERANK';
const needText=mode==='TEXT_ONLY'||mode==='HYBRID'||mode==='HYBRID_RERANK'||mode==='VECTOR_ONLY';
return [{json:{
  ...prep, mode, needVector, needText, candidateLimit, finalLimit, maxChunksPerDocument, weights,
  configuration:cfg, configurationJson:JSON.stringify({...cfg,mode}),
  versionLabel:cfgNode.versionLabel||null,
  versionId:cfgNode.versionId||cfgNode.id||null,
  configCode:cfgNode.code||'AI_QUERY_RETRIEVAL',
  modeOverrideUsed:!!cfgNode.modeOverrideUsed||!!prep.retrievalConfigVersionId,
  contentHash:cfgNode.contentHash||null,
  cfgLoadedAtMs:Date.now(),
  vectorHits:[], textRows:[], vectorLatencyMs:0, textLatencyMs:0, vectorOk:false,
}}];`,
  ),
);

add(iff('Precisa vetor?', [1320, 0], '={{ $json.needVector === true }}'));
add(
  code(
    'Preparar embedding',
    [1540, -120],
    `const cls=$input.first().json||{};const question=String(cls.question||'').trim();return [{json:{...cls,openaiBody:{model:'text-embedding-3-small',input:question||' '},embedStartedAtMs:Date.now()}}];`,
  ),
);
nodes.push({
  id: uid(),
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
});
add(
  code(
    'Extrair vetor',
    [1980, -120],
    `const cls=$('Preparar embedding').first().json||{};const resp=$input.first().json||{};const statusCode=Number(resp.statusCode??resp.status??0);let body=resp.body??resp.data??resp;if(typeof body==='string'){try{body=JSON.parse(body);}catch(_){body={};}}const emb=(body&&body.data&&body.data[0]&&body.data[0].embedding)||null;const ok=statusCode>=200&&statusCode<300&&Array.isArray(emb);return [{json:{...cls,queryVectorJson:JSON.stringify(emb||[]),vectorOk:ok,topK:Number(cls.candidateLimit||30)||30,categoryId:cls.categoryId||'',subcategoryId:cls.subcategoryId||''}}];`,
  ),
);
add(
  exec(
    'Busca vetorial Qdrant',
    [2200, -120],
    QDRANT,
    'QDRANT - BUSCAR',
    {
      queryVectorJson: '={{ $json.queryVectorJson }}',
      topK: '={{ Number($json.topK || 12) }}',
      categoryId: '={{ $json.categoryId || "" }}',
      subcategoryId: '={{ $json.subcategoryId || "" }}',
    },
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
);
add(
  code(
    'Guardar hits vetoriais',
    [2420, -120],
    `const base=$('Preparar embedding').first().json||{};const vec=$input.first().json||{};const vectorLatencyMs=Date.now()-Number(base.embedStartedAtMs||Date.now());return [{json:{...base,vectorHits:Array.isArray(vec.hits)?vec.hits:[],vectorOk:vec.ok===true,vectorLatencyMs}}];`,
  ),
);
add(
  code(
    'Pular vetor',
    [1540, 140],
    `const base=$input.first().json||{};return [{json:{...base,vectorHits:[],vectorOk:false,vectorLatencyMs:0}}];`,
  ),
);

add(iff('Precisa texto?', [2640, 0], '={{ $json.needText === true }}'));
add(
  code(
    'Preparar busca texto',
    [2860, -80],
    `const base=$input.first().json||{};return [{json:{...base,textStartedAtMs:Date.now(),question:base.question,categoryId:base.categoryId||'',subcategoryId:base.subcategoryId||'',categoryName:base.categoryName||'',subcategoryName:base.subcategoryName||'',searchTerms:base.searchTerms||[]}}];`,
  ),
);
nodes.push({
  id: uid(),
  name: 'Buscar chunks relevantes',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  position: [3080, -80],
  credentials: { postgres: PG_CRED },
  parameters: { operation: 'executeQuery', options: {}, query: textQuery },
  alwaysOutputData: true,
});
add(
  code(
    'Guardar rows texto',
    [3300, -80],
    `const base=$('Preparar busca texto').first().json||{};const textRows=$input.all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));const textLatencyMs=Date.now()-Number(base.textStartedAtMs||Date.now());return [{json:{...base,textRows,textLatencyMs}}];`,
  ),
);
add(
  code(
    'Pular texto',
    [2860, 140],
    `const base=$input.first().json||{};return [{json:{...base,textRows:[],textLatencyMs:0}}];`,
  ),
);

add(
  code(
    'Merge híbrido',
    [3520, 0],
    `const modeInfo=$input.first().json||{};
const t0=Date.now();
const vectorHits=Array.isArray(modeInfo.vectorHits)?modeInfo.vectorHits:[];
const textRows=Array.isArray(modeInfo.textRows)?modeInfo.textRows:[];
const wV=Number(modeInfo.weights?.semantic??0.65);
const wT=Number(modeInfo.weights?.lexical??0.35);
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
const candidates=merged.slice(0,candidatePool);
const mergeLatencyMs=Date.now()-t0;
const fallbackUsed=modeInfo.needVector&&!vectorHits.length&&textRows.length>0;
const pipelineMeta={
  mode:modeInfo.mode, configCode:modeInfo.configCode||'AI_QUERY_RETRIEVAL',
  configVersionId:modeInfo.versionId||null, configVersion:modeInfo.versionLabel||null,
  rankingVersion:modeInfo.versionLabel||null, candidateCount:candidates.length, deduplicatedCount:byKey.size,
  vectorLatencyMs:Number(modeInfo.vectorLatencyMs||0), textLatencyMs:Number(modeInfo.textLatencyMs||0), mergeLatencyMs,
  fallbackUsed, fallbackReason:fallbackUsed?'vector_empty_text_fallback':null,
  modeOverrideUsed:!!modeInfo.modeOverrideUsed, requestId:modeInfo.requestId||null,
};
return [{json:{...modeInfo, candidates, pipelineMeta, useRerank:String(modeInfo.mode).toUpperCase()==='HYBRID_RERANK', finalLimit:Number(modeInfo.finalLimit||12)||12}}];`,
  ),
);

add(
  code(
    'Preparar seleção',
    [3740, 0],
    `const j=$input.first().json||{};
const candidates=Array.isArray(j.candidates)?j.candidates:[];
return [{json:{
  mode:j.mode, useRerank:!!j.useRerank, finalLimit:Number(j.finalLimit||12)||12,
  versionLabel:j.versionLabel||'hybrid-v1', versionId:j.versionId||null,
  configurationJson:j.configurationJson||'{}',
  classificationJson:JSON.stringify({categoryId:j.categoryId||null,subcategoryId:j.subcategoryId||null,categoryName:j.categoryName||null,subcategoryName:j.subcategoryName||null,searchTerms:j.searchTerms||[]}),
  candidatesJson:JSON.stringify(candidates), candidates,
  question:j.question||'', requestId:j.requestId||'', userId:j.userId||'', sessionId:j.sessionId||'',
  pipelineMeta:j.pipelineMeta||{}, modeInfo:j, maxChunksPerDocument:Number(j.maxChunksPerDocument||4)||4,
  rerankStartedAtMs:Date.now(),
}}];`,
  ),
);

add(iff('Usar re-ranking?', [3960, 0], '={{ $json.useRerank === true }}'));
add(
  exec(
    'Chamar RE-RANQUEAR',
    [4180, -100],
    RERANK,
    'IA - RE-RANQUEAR CANDIDATOS',
    {
      question: '={{ $json.question }}',
      classificationJson: '={{ $json.classificationJson }}',
      candidatesJson: '={{ $json.candidatesJson }}',
      configurationJson: '={{ $json.configurationJson }}',
      requestId: '={{ $json.requestId }}',
      userId: '={{ $json.userId }}',
      sessionId: '={{ $json.sessionId }}',
    },
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
);
add(code('Corte hybrid padrão', [4180, 100], `return [$('Preparar seleção').first()];`));

add(
  code(
    'Resolver ranking final',
    [4400, 0],
    `const prep=$('Preparar seleção').first().json||{};
const mode=String(prep.mode||'HYBRID').toUpperCase();
const finalLimit=Number(prep.finalLimit||12)||12;
const hybridCandidates=Array.isArray(prep.candidates)?prep.candidates:[];
const maxPerDoc=Number(prep.maxChunksPerDocument||4)||4;
let ranked=[]; let fallbackUsed=!!(prep.pipelineMeta&&prep.pipelineMeta.fallbackUsed);
let rankingMetadata={mode,fallbackUsed:false,selectedCount:0,durationMs:0};
const rerankLatencyMs=mode==='HYBRID_RERANK'?(Date.now()-Number(prep.rerankStartedAtMs||Date.now())):0;
if(mode==='HYBRID_RERANK'){
  const rr=$input.first().json||{};
  if(rr.ok===true&&Array.isArray(rr.rankedCandidates)&&rr.rankedCandidates.length){
    ranked=rr.rankedCandidates; rankingMetadata=rr.rankingMetadata||rankingMetadata;
  } else {
    fallbackUsed=true;
    rankingMetadata={mode:'HYBRID_FALLBACK',fallbackUsed:true,selectedCount:0,durationMs:rerankLatencyMs,error:rr.error||'rerank_failed'};
    ranked=hybridCandidates.slice(0,finalLimit).map((c,i)=>({...c,rerankPosition:i+1,rerankScore:c.mergedScore||0,selectionReason:'hybrid_fallback',retrievalMode:'hybrid_fallback'}));
  }
} else {
  ranked=hybridCandidates.slice(0,finalLimit).map((c,i)=>({...c,rerankPosition:i+1,rerankScore:c.mergedScore||0,selectionReason:mode.toLowerCase(),retrievalMode:c.retrievalMode||mode.toLowerCase()}));
  rankingMetadata={mode,fallbackUsed:false,selectedCount:ranked.length,durationMs:0,versionLabel:prep.versionLabel||null};
}
const perDoc=new Map(); const diversified=[];
for(const c of ranked){ const id=String(c.documentId||''); const n=perDoc.get(id)||0; if(n>=maxPerDoc) continue; perDoc.set(id,n+1); diversified.push(c); if(diversified.length>=finalLimit) break; }
if(!diversified.length) diversified.push(...ranked.slice(0,finalLimit));
ranked=diversified;
rankingMetadata.fallbackUsed=fallbackUsed||!!rankingMetadata.fallbackUsed;
rankingMetadata.selectedCount=ranked.length;
rankingMetadata.versionLabel=prep.versionLabel||rankingMetadata.versionLabel||null;
rankingMetadata.candidateCount=hybridCandidates.length;
rankingMetadata.rerankLatencyMs=rerankLatencyMs;
rankingMetadata.pipelineMeta=prep.pipelineMeta||{};
return [{json:{ranked, rankingMetadata, retrievalConfigVersion:prep.versionLabel||null, fallbackUsed:rankingMetadata.fallbackUsed, prep}}];`,
  ),
);

add(
  code(
    'Montar contexto atual',
    [4620, 0],
    `const t0=Date.now();
const wrap=$input.first().json||{};
const ranked=Array.isArray(wrap.ranked)?wrap.ranked:[];
const prep=wrap.prep||{};
const modeInfo=prep.modeInfo||{};
const rankingMetadata=wrap.rankingMetadata||{};
const pipelineMeta=rankingMetadata.pipelineMeta||prep.pipelineMeta||{};
const question=String(modeInfo.question||prep.question||'');
const classification={categoryId:modeInfo.categoryId??null,categoryName:modeInfo.categoryName??null,categoryDescription:null,subcategoryId:modeInfo.subcategoryId??null,subcategoryName:modeInfo.subcategoryName??null,subcategoryDescription:null};
const contextChunks=ranked.map((row,index)=>({
  index:index+1, chunkId:row.chunkId||null, documentId:row.documentId, documentTitle:row.documentTitle,
  sectorId:row.sectorId??null, sectorName:row.sectorName??null, categoryId:row.categoryId??null, categoryName:row.categoryName??null,
  subcategoryId:row.subcategoryId??null, subcategoryName:row.subcategoryName??null, vigencyDate:row.vigencyDate??null,
  chunkOrder:row.chunkOrder, relevance:row.relevance??0, text:row.chunkText??row.text??'',
  vectorScore:row.vectorScore??null, textScore:row.textScore??null, hybridScore:row.hybridScore??row.mergedScore??null, rerankScore:row.rerankScore??null,
}));
const context=contextChunks.map(s=>\`[Fontes \${s.index}]\\n\\nDocumento: \${s.documentTitle||'Não informado'}\\nSetor: \${s.sectorName||'Não informado'}\\nCategoria: \${s.categoryName||'Não informada'}\\nSubcategoria: \${s.subcategoryName||'Não informada'}\\nData de vigência: \${s.vigencyDate||'Não informada'}\\nOrdem do trecho: \${s.chunkOrder}\\nRelevância calculada: \${s.relevance}\\n\\nTrecho documental:\\n\${s.text}\`.trim()).join('\\n\\n------------------------------\\n\\n');
const unique=new Map();
for(const s of contextChunks){
  if(!s.documentId) continue;
  const e=unique.get(s.documentId);
  if(!e) unique.set(s.documentId,{documentId:s.documentId,documentTitle:s.documentTitle,sectorId:s.sectorId,sectorName:s.sectorName,categoryId:s.categoryId,categoryName:s.categoryName,subcategoryId:s.subcategoryId,subcategoryName:s.subcategoryName,vigencyDate:s.vigencyDate,relevance:s.relevance});
  else if(Number(s.relevance)>Number(e.relevance)) e.relevance=s.relevance;
}
const sources=[...unique.values()].sort((a,b)=>Number(b.relevance)-Number(a.relevance)).map((s,i)=>({index:i+1,documentId:s.documentId,documentTitle:s.documentTitle,sectorId:s.sectorId,sectorName:s.sectorName,categoryId:s.categoryId,categoryName:s.categoryName,subcategoryId:s.subcategoryId,subcategoryName:s.subcategoryName,vigencyDate:s.vigencyDate}));
const rankedDocumentIds=contextChunks.map(c=>c.documentId).filter(Boolean);
const rankedChunkIds=contextChunks.map(c=>c.chunkId).filter(Boolean);
const sourceDocumentIds=sources.map(s=>s.documentId).filter(Boolean);
const contextBuildLatencyMs=Date.now()-t0;
const retrievalMeta={
  mode:rankingMetadata.mode||modeInfo.mode||'HYBRID',
  configCode:modeInfo.configCode||'AI_QUERY_RETRIEVAL',
  configVersionId:modeInfo.versionId||null,
  configVersion:modeInfo.versionLabel||null,
  rankingVersion:modeInfo.versionLabel||null,
  candidateCount:Number(rankingMetadata.candidateCount??pipelineMeta.candidateCount??0),
  deduplicatedCount:Number(pipelineMeta.deduplicatedCount??0),
  rerankedCount:String(modeInfo.mode||'').toUpperCase()==='HYBRID_RERANK'&&!rankingMetadata.fallbackUsed?contextChunks.length:0,
  selectedCount:contextChunks.length,
  retrievalLatencyMs:Date.now()-Number(modeInfo.startedAtMs||Date.now()),
  vectorLatencyMs:Number(pipelineMeta.vectorLatencyMs??0),
  textLatencyMs:Number(pipelineMeta.textLatencyMs??0),
  mergeLatencyMs:Number(pipelineMeta.mergeLatencyMs??0),
  rerankLatencyMs:Number(rankingMetadata.rerankLatencyMs??0),
  contextBuildLatencyMs,
  fallbackUsed:!!(rankingMetadata.fallbackUsed||pipelineMeta.fallbackUsed),
  fallbackReason:rankingMetadata.fallbackUsed?(rankingMetadata.error||'rerank_fallback'):(pipelineMeta.fallbackReason||null),
  rankedDocumentIds, rankedChunkIds, sourceDocumentIds,
  requestId:modeInfo.requestId||null,
  modeOverrideUsed:!!modeInfo.modeOverrideUsed,
  normalizedQuestion:modeInfo.normalizedQuestion||null,
  questionHash:modeInfo.questionHash||null,
};
const selectedChunks=contextChunks.map(c=>({chunkId:c.chunkId,documentId:c.documentId,content:c.text,chunkIndex:c.chunkOrder,vectorScore:c.vectorScore,textScore:c.textScore,hybridScore:c.hybridScore,rerankScore:c.rerankScore,documentTitle:c.documentTitle,sectorName:c.sectorName,categoryName:c.categoryName,subcategoryName:c.subcategoryName}));
return [{json:{context,sources,selectedChunks,retrievalMeta,question,classification,diagnostic:{totalChunks:contextChunks.length,totalDocuments:sources.length},requestId:modeInfo.requestId||'',userId:modeInfo.userId||'',sessionId:modeInfo.sessionId||''}}];`,
  ),
);

add(
  exec(
    'Auditar SUCCESS',
    [4840, 0],
    AUDIT,
    'AUDITORIA - REGISTRAR',
    {
      action: 'AI_RETRIEVAL_SUCCESS',
      resourceType: 'ai_retrieval',
      resourceId: '={{ $json.requestId || "" }}',
      success: '={{ true }}',
      requestId: '={{ $json.requestId || "" }}',
      userId: '={{ $json.userId || "" }}',
      sessionId: '={{ $json.sessionId || "" }}',
      metadata:
        '={{ { mode: $json.retrievalMeta && $json.retrievalMeta.mode, configVersion: $json.retrievalMeta && $json.retrievalMeta.configVersion, selectedCount: $json.retrievalMeta && $json.retrievalMeta.selectedCount, candidateCount: $json.retrievalMeta && $json.retrievalMeta.candidateCount, fallbackUsed: !!( $json.retrievalMeta && $json.retrievalMeta.fallbackUsed ), retrievalLatencyMs: $json.retrievalMeta && $json.retrievalMeta.retrievalLatencyMs } }}',
    },
    { onError: 'continueRegularOutput', alwaysOutputData: true },
  ),
);
add(code('Retorno', [5060, 0], `return [$('Montar contexto atual').first()];`));

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Auditar START', type: 'main', index: 0 }]] },
  'Auditar START': { main: [[{ node: 'Após audit start', type: 'main', index: 0 }]] },
  'Após audit start': { main: [[{ node: 'Carregar retrieval config', type: 'main', index: 0 }]] },
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
  'Busca vetorial Qdrant': { main: [[{ node: 'Guardar hits vetoriais', type: 'main', index: 0 }]] },
  'Guardar hits vetoriais': { main: [[{ node: 'Precisa texto?', type: 'main', index: 0 }]] },
  'Pular vetor': { main: [[{ node: 'Precisa texto?', type: 'main', index: 0 }]] },
  'Precisa texto?': {
    main: [
      [{ node: 'Preparar busca texto', type: 'main', index: 0 }],
      [{ node: 'Pular texto', type: 'main', index: 0 }],
    ],
  },
  'Preparar busca texto': { main: [[{ node: 'Buscar chunks relevantes', type: 'main', index: 0 }]] },
  'Buscar chunks relevantes': { main: [[{ node: 'Guardar rows texto', type: 'main', index: 0 }]] },
  'Guardar rows texto': { main: [[{ node: 'Merge híbrido', type: 'main', index: 0 }]] },
  'Pular texto': { main: [[{ node: 'Merge híbrido', type: 'main', index: 0 }]] },
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

const existing = await client.query(
  `SELECT id, "activeVersionId" FROM workflow_entity WHERE name='IA - RECUPERAR CONTEXTO' LIMIT 1`,
);
let recuperarId = existing.rows[0]?.id;
const versionId = uid();
if (!recuperarId) {
  recuperarId = randomUUID().replace(/-/g, '').slice(0, 16);
  await client.query(
    `INSERT INTO workflow_entity (
      id, name, active, nodes, connections, settings, "staticData", "pinData",
      "versionId", "triggerCount", meta, "parentFolderId", "createdAt", "updatedAt",
      "isArchived", "activeVersionId"
    ) VALUES ($1,'IA - RECUPERAR CONTEXTO',true,$2::json,$3::json,$4::json,NULL,NULL,$5,0,$6::json,NULL,NOW(),NOW(),false,NULL)`,
    [
      recuperarId,
      JSON.stringify(nodes),
      JSON.stringify(connections),
      JSON.stringify({ executionOrder: 'v1', availableInMCP: true }),
      versionId,
      JSON.stringify({ aiBuilderAssisted: true, builderVariant: 'etapa21-recuperar-contexto' }),
    ],
  );
  try {
    await client.query(
      `INSERT INTO shared_workflow ("workflowId","projectId",role,"createdAt","updatedAt")
       VALUES ($1,$2,'workflow:owner',NOW(),NOW()) ON CONFLICT DO NOTHING`,
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
  new URL('./workflow-recuperar-id.json', import.meta.url),
  JSON.stringify({ recuperarId, nodeCount: nodes.length, names: nodes.map((n) => n.name) }, null, 2),
);
console.log('RECUPERAR', recuperarId, 'nodes', nodes.length);

// --- Refactor Consulta IA ---
const { rows: cRows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [CONSULTA],
);
let cNodes = typeof cRows[0].nodes === 'string' ? JSON.parse(cRows[0].nodes) : structuredClone(cRows[0].nodes);
let cConn =
  typeof cRows[0].connections === 'string'
    ? JSON.parse(cRows[0].connections)
    : structuredClone(cRows[0].connections);

const removeNames = new Set([
  'Preparar embedding pergunta',
  'Embed pergunta',
  'Extrair vetor pergunta',
  'Busca vetorial Qdrant',
  'Restaurar classificação p/ texto',
  'Buscar chunks relevantes',
  'Aguardar recuperações',
  'Merge híbrido',
  'Carregar retrieval config',
  'Preparar seleção retrieval',
  'Usar re-ranking?',
  'Chamar RE-RANQUEAR',
  'Resolver ranking final',
  'Corte hybrid padrão',
  'Montar contexto',
]);

cNodes = cNodes.filter((n) => !removeNames.has(n.name));
for (const name of removeNames) delete cConn[name];
for (const [src, conn] of Object.entries(cConn)) {
  if (!conn.main) continue;
  conn.main = conn.main.map((branch) =>
    (branch || []).filter((link) => !removeNames.has(link.node)),
  );
}

const callRecuperar = {
  id: uid(),
  name: 'IA - RECUPERAR CONTEXTO',
  type: 'n8n-nodes-base.executeWorkflow',
  typeVersion: 1.3,
  position: [1600, 0],
  parameters: {
    mode: 'once',
    source: 'database',
    workflowId: {
      __rl: true,
      mode: 'id',
      value: recuperarId,
      cachedResultName: 'IA - RECUPERAR CONTEXTO',
    },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        question: "={{ $('Classificar pergunta').first().json.question || '' }}",
        classificationJson: "={{ JSON.stringify($('Classificar pergunta').first().json || {}) }}",
        retrievalConfigVersionId:
          "={{ (() => { const b=$('Normalizar request').first().json.body||{}; const q=$('Normalizar request').first().json.query||{}; return String(b.retrievalConfigVersionId||q.retrievalConfigVersionId||'').trim(); })() }}",
        modeOverrideAllowed: `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  const flag=b.modeOverrideAllowed===true||b.modeOverrideAllowed==='true'||q.modeOverrideAllowed===true||q.modeOverrideAllowed==='true';
  if(!flag) return 'false';
  let allowed=false;
  try {
    const auth=$('Validar auth').first().json||{};
    const user=auth.user||{};
    const perms=[...(Array.isArray(auth.permissions)?auth.permissions:[]),...(Array.isArray(user.permissions)?user.permissions:[])].map(p=>String(p).toLowerCase());
    allowed=auth.isMaster===true||user.isMaster===true||perms.includes('editar_configuracoes')||perms.some(p=>p.includes('ai_retrieval')||p.includes('admin'));
  } catch(_) {}
  return allowed ? 'true' : 'false';
})() }}`,
        requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
        userId: "={{ $('Validar auth').first().json.userId || '' }}",
        sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
      },
    },
    options: { waitForSubWorkflow: true },
  },
};

const aplicarCtx = {
  id: uid(),
  name: 'Aplicar contexto recuperado',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1820, 0],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const ret=$input.first().json||{};
return [{json:{
  question: ret.question || $('Classificar pergunta').first().json.question || '',
  classification: ret.classification || {
    categoryId: $('Classificar pergunta').first().json.categoryId || null,
    categoryName: $('Classificar pergunta').first().json.categoryName || null,
    subcategoryId: $('Classificar pergunta').first().json.subcategoryId || null,
    subcategoryName: $('Classificar pergunta').first().json.subcategoryName || null,
  },
  context: ret.context || '',
  sources: Array.isArray(ret.sources) ? ret.sources : [],
  retrievalMeta: ret.retrievalMeta || null,
  diagnostic: ret.diagnostic || null,
}}];`,
  },
};

cNodes.push(callRecuperar, aplicarCtx);

// Classificar → RECUPERAR (instead of Preparar embedding)
cConn['Classificar pergunta'] = {
  main: [[{ node: 'IA - RECUPERAR CONTEXTO', type: 'main', index: 0 }]],
};
cConn['IA - RECUPERAR CONTEXTO'] = {
  main: [[{ node: 'Aplicar contexto recuperado', type: 'main', index: 0 }]],
};
cConn['Aplicar contexto recuperado'] = {
  main: [[{ node: 'Carregar prompt ativo', type: 'main', index: 0 }]],
};

// Montar resposta: use Aplicar contexto recuperado instead of Montar contexto / Resolver / Carregar config
const montarResp = cNodes.find((n) => n.name === 'Montar resposta');
if (montarResp) {
  montarResp.parameters.jsCode = `const ctx = $('Aplicar contexto recuperado').first().json;
const prompt = $('Aplicar prompt carregado').first().json || {};
const answer = $json.output?.[0]?.content?.[0]?.text ?? '';
const sources = (ctx.sources || []).map((s) => ({
  ...s,
  expirationDate: s.expirationDate ?? s.vigencyDate ?? null,
}));
const requestId = $('Normalizar request').first().json.requestId;
const retrievalMeta = ctx.retrievalMeta || null;
return [{
  json: {
    data: {
      question: ctx.question,
      answer,
      sources,
      classification: ctx.classification,
      retrievalMeta,
    },
    statusCode: 200,
    requestId,
    promptMeta: {
      promptVersionId: prompt.promptVersionId || null,
      promptCode: prompt.promptCode || null,
      versionNumber: prompt.versionNumber != null ? prompt.versionNumber : null,
      contentHash: prompt.contentHash || null,
      modelName: prompt.modelName || null,
    },
  },
}];`;
}

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(cNodes), JSON.stringify(cConn), CONSULTA],
);
if (cRows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
     WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(cNodes), JSON.stringify(cConn), CONSULTA, cRows[0].activeVersionId],
  );
}

writeFileSync(
  new URL('./_e21-consulta-refactored.json', import.meta.url),
  JSON.stringify(
    {
      recuperarId,
      consultaNodes: cNodes.map((n) => n.name),
      removed: [...removeNames],
    },
    null,
    2,
  ),
);
console.log('Consulta IA refactored, nodes=', cNodes.length);
await client.end();
