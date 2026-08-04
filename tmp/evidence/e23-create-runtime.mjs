#!/usr/bin/env node
/**
 * Etapa 23 — create IA - CONSTRUIR EVIDÊNCIAS + wire into Consulta IA (before CWM).
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const PG_CRED = 'XJtGZ5rpCR7BpN0X';
const PROJECT = 'WbvMM1wAedTR9qrk';
const EVIDENCE_ID = 'c23EvidenceRuntime01';
const CONSULTA = '8EXk5RkFW5cxnenL';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function upsertWorkflow({ id, name, nodes, connections, active = true, description = 'Etapa 23' }) {
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
     VALUES ($1::varchar,$2,'etapa23',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
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

const buildCode = `const crypto=require('crypto');
const sha256=(s)=>crypto.createHash('sha256').update(String(s),'utf8').digest('hex');
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const gradeFromScore=(s)=>{s=Number(s)||0;if(s>=85)return'EXCELLENT';if(s>=70)return'GOOD';if(s>=55)return'ACCEPTABLE';if(s>=40)return'LOW';return'POOR';};
const confidenceFromScore=(s)=>{s=Number(s)||0;if(s>=80)return'HIGH';if(s>=55)return'MEDIUM';return'LOW';};
const numScore=(v)=>{const n=Number(v);if(!Number.isFinite(n))return null;return n>1.5?clamp(n,0,100):clamp(n*100,0,100);};
const detectSourceType=(c)=>{const kind=String(c.chunkKind||c.chunk_kind||'').toLowerCase();const sheet=c.sheetName||c.sheet_name;if(sheet||kind.includes('table')||kind.includes('row')||kind.includes('tabular'))return'tabular';const ocr=String(c.ocrQualityGrade||c.ocrQuality||c.ocr_quality_grade||'').toUpperCase();const method=String(c.extractionMethod||c.extraction_method||'').toLowerCase();if(ocr||method.includes('ocr'))return'OCR';return'texto';};
const classifyEvidence=(c,text)=>{const labels=[];const t=String(text||'');const src=detectSourceType(c);const cat=String(c.categoryName||c.category_name||'').toLowerCase();const sub=String(c.subcategoryName||c.subcategory_name||'').toLowerCase();const title=String(c.documentTitle||c.document_title||'').toLowerCase();const blob=(cat+' '+sub+' '+title+' '+t).toLowerCase();if(src==='tabular')labels.push('Evidência tabular');if(src==='OCR')labels.push('Evidência OCR');if(/n[aã]o (consta|encontr|localiz|h[aá])|sem registro|inexistente|negativ/i.test(t))labels.push('Evidência negativa');else labels.push('Evidência positiva');if(/norma|resolu[cç][aã]o|portaria|regulament|procedimento operacional|pop\\b|protocolo/i.test(blob))labels.push('Evidência normativa');if(/opera[cç][aã]o|plant[aã]o|escala|agenda|atendimento|fluxo|processo/i.test(blob))labels.push('Evidência operacional');if(/financeiro|or[cç]amento|fatur|pagamento|sal[aá]rio|remunera|r\\$|custos?/i.test(blob))labels.push('Evidência financeira');if(/cl[ií]nic|paciente|prontu[aá]rio|oftalm|cirurg|anamnese|diagn[oó]st/i.test(blob))labels.push('Evidência clínica');return[...new Set(labels)];};
const computeScore=(c)=>{const retrieval=numScore(c.hybridScore??c.hybrid_score??c.vectorScore??c.vector_score??c.textScore)??50;const rerank=numScore(c.rerankScore??c.rerank_score??c.relevance);const ocrGrade=String(c.ocrQualityGrade||c.ocrQuality||'').toUpperCase();const src=detectSourceType(c);const text=String(c.text||c.content||'');const expired=(c.expirationDate||c.vigencyDate)?(new Date(c.expirationDate||c.vigencyDate).getTime()<Date.now()):false;const isCurrent=c.isCurrent!==false&&c.currentVersion!==false;let score=0;score+=retrieval*0.35;score+=(rerank!=null?rerank:retrieval)*0.25;if(src==='OCR'){if(ocrGrade==='A'||ocrGrade==='EXCELLENT')score+=12;else if(ocrGrade==='B'||ocrGrade==='GOOD')score+=8;else if(ocrGrade==='C'||ocrGrade==='ACCEPTABLE')score+=4;else if(ocrGrade==='POOR'||ocrGrade==='FAILED'||ocrGrade==='MANUAL_REVIEW')score-=15;else score+=2;}else score+=8;if(src==='tabular')score+=6;if(isCurrent)score+=8;else score-=10;if(expired)score-=25;else score+=5;if(String(c.categoryName||''))score+=3;if(text.trim().length<40)score-=10;if(text.trim().length>200)score+=3;score=clamp(Math.round(score),0,100);return{evidenceScore:score,evidenceGrade:gradeFromScore(score),confidence:confidenceFromScore(score),sourceType:src};};
const overlapRatio=(a,b)=>{const ta=String(a||'').toLowerCase().split(/\\s+/).filter(Boolean);const tb=String(b||'').toLowerCase().split(/\\s+/).filter(Boolean);if(!ta.length||!tb.length)return 0;const sb=new Set(tb);let inter=0;for(const w of ta)if(sb.has(w))inter++;return inter/Math.max(ta.length,tb.length);};

const t0=Date.now();
const prep=$('Preparar entrada').first().json||{};
const cfgRow=$('Load config').first().json||{};
let configuration={};try{configuration=typeof cfgRow.configuration==='string'?JSON.parse(cfgRow.configuration):(cfgRow.configuration||{});}catch(_){configuration={};}
const mode=String(configuration.mode||cfgRow.mode||'STRUCTURED').toUpperCase();
const versionLabel=cfgRow.version_label||'evidence-v1';
const versionId=cfgRow.id||null;
const chunks=Array.isArray(prep.selectedChunks)?prep.selectedChunks:[];
const auditAction='AI_EVIDENCE_STARTED';

if(mode==='DISABLED'||!chunks.length){
  const evidenceMeta={evidenceCount:0,averageEvidenceScore:0,highestEvidenceScore:0,conflictCount:0,conflictDetected:false,conflictType:'NO_CONFLICT',redundancyCount:0,deduplicatedEvidenceCount:0,ocrDistribution:{},tabularDistribution:{},confidenceDistribution:{},selectedEvidenceIds:[],excludedEvidenceIds:[],labelDiversity:0,durationMs:Date.now()-t0,schemaVersion:'evidence-schema-v1',mode,configVersion:versionLabel,configVersionId:versionId};
  return [{json:{
    question:prep.question,classification:prep.classification,retrievalMeta:prep.retrievalMeta,
    selectedChunks:chunks,sources:prep.sources||[],evidences:[],excludedEvidences:[],
    contextInput:{evidences:[],conflicts:{conflictDetected:false},statistics:evidenceMeta,sources:prep.sources||[],evidenceMeta},
    evidenceMeta,conflict:{conflictDetected:false,conflictType:'NO_CONFLICT'},
    auditAction:chunks.length?'AI_EVIDENCE_COMPLETED':'AI_EVIDENCE_COMPLETED',
    requestId:prep.requestId
  }}];
}

const thr=Number(configuration.redundancyThreshold||0.92)||0.92;
const minScore=Number(configuration.minEvidenceScore||0)||0;
const dropLow=configuration.dropBelowMinScore===true && mode==='STRUCTURED_STRICT';
const enableScore=configuration.enableEvidenceScore!==false;
const enableClass=configuration.enableClassification!==false;
const enableConflict=configuration.enableConflictConsolidation!==false;
const enableRedundancy=configuration.enableRedundancyDetection!==false;
const enableRich=configuration.enableRichSources!==false;

let evidences=chunks.map((c,i)=>{
  const text=String(c.text||c.content||'');
  const scored=enableScore?computeScore(c):{evidenceScore:50,evidenceGrade:'ACCEPTABLE',confidence:'MEDIUM',sourceType:detectSourceType(c)};
  const labels=enableClass?classifyEvidence(c,text):['Evidência positiva'];
  const evidenceId=sha256(String(c.documentId||'')+':'+(c.documentVersionId||c.versionId||'')+':'+(c.chunkId||i)+':'+text.slice(0,80)).slice(0,24);
  return{
    evidenceId,documentId:c.documentId||c.document_id||null,versionId:c.documentVersionId||c.versionId||c.document_version_id||null,
    chunkId:c.chunkId||c.chunk_id||null,documentTitle:c.documentTitle||c.document_title||null,
    setor:c.sectorName||c.sector_name||null,sectorId:c.sectorId||null,
    categoria:c.categoryName||c.category_name||null,categoryId:c.categoryId||null,
    subcategoria:c.subcategoryName||c.subcategory_name||null,subcategoryId:c.subcategoryId||null,
    sourceType:scored.sourceType,ocrGrade:c.ocrQualityGrade||c.ocrQuality||null,
    retrievalScore:numScore(c.hybridScore??c.vectorScore??c.textScore),
    rerankScore:numScore(c.rerankScore??c.relevance),
    evidenceScore:scored.evidenceScore,evidenceGrade:scored.evidenceGrade,
    currentVersion:c.isCurrent!==false,expiration:c.expirationDate||c.vigencyDate||null,
    conflictFlags:[],confidence:scored.confidence,chunkText:text,labels,
    chunkOrder:c.chunkOrder??c.chunkIndex??i,chunkKind:c.chunkKind||null,sheetName:c.sheetName||null,
    rowStart:c.rowStart??null,rowEnd:c.rowEnd??null,
    sourceMetadata:{sectorName:c.sectorName||null,categoryName:c.categoryName||null,subcategoryName:c.subcategoryName||null,vigencyDate:c.vigencyDate||c.expirationDate||null,sheetName:c.sheetName||null}
  };
});

let excluded=[];
if(dropLow){
  excluded=evidences.filter(e=>e.evidenceScore<minScore);
  evidences=evidences.filter(e=>e.evidenceScore>=minScore);
}

let redundancyCount=0, dedupCount=evidences.length;
if(enableRedundancy){
  const kept=[];const seen=new Set();
  for(const e of evidences){
    const cid=String(e.chunkId||'');
    if(cid&&seen.has(cid)){redundancyCount++;e.redundant=true;excluded.push(e);continue;}
    let dup=false;
    for(const p of kept){
      const ratio=overlapRatio(e.chunkText,p.chunkText);
      if(ratio>=thr){dup=true;e.redundancyScore=ratio;break;}
    }
    if(dup){redundancyCount++;e.redundant=true;excluded.push(e);continue;}
    if(cid)seen.add(cid);
    e.redundant=false;e.redundancyScore=0;kept.push(e);
  }
  evidences=kept;dedupCount=kept.length;
}

let conflict={conflictDetected:false,conflictType:'NO_CONFLICT',conflictReasonCode:null,preferredEvidenceId:null,preferredDocumentId:null,conflictingDocuments:[],reasonCode:null};
if(enableConflict&&evidences.length>=2){
  const docs=new Map();
  for(const e of evidences){
    const id=String(e.documentId||'');if(!id)continue;
    if(!docs.has(id))docs.set(id,{documentId:id,title:e.documentTitle||'',vigency:e.expiration||null,maxScore:e.evidenceScore||0,texts:[]});
    const d=docs.get(id);d.maxScore=Math.max(d.maxScore,e.evidenceScore||0);d.texts.push(String(e.chunkText||'').slice(0,500));if(e.expiration)d.vigency=e.expiration;
  }
  const list=[...docs.values()];
  const moneyRe=/R\\$\\s*[\\d.]+,?\\d*/gi;const idRe=/\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b|\\bCRM[-\\s]?\\w*\\s*\\d+/gi;
  outer:for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];const ta=a.texts.join(' '),tb=b.texts.join(' ');
      const idsA=ta.match(idRe)||[],idsB=tb.match(idRe)||[];const monA=ta.match(moneyRe)||[],monB=tb.match(moneyRe)||[];
      const sharedId=idsA.some(x=>idsB.map(y=>y.toLowerCase()).includes(x.toLowerCase()));
      if(sharedId&&monA.length&&monB.length){
        const norm=xs=>[...new Set(xs.map(x=>x.replace(/\\s/g,'').toLowerCase()))];
        const sa=norm(monA),sb=norm(monB);
        if(sa.some(x=>!sb.includes(x))||sb.some(x=>!sa.includes(x))){
          conflict={conflictDetected:true,conflictType:'CONFIRMED_CONFLICT',conflictReasonCode:'DIVERGENT_MONETARY_VALUES',conflictingDocuments:[a.documentId,b.documentId],reasonCode:'DIVERGENT_MONETARY_VALUES'};
          break outer;
        }
      }
      const titleTokens=t=>String(t||'').toLowerCase().split(/\\s+/).filter(w=>w.length>3);
      const sharedTitle=titleTokens(a.title).filter(t=>titleTokens(b.title).includes(t)).length;
      if(sharedTitle>=2&&a.vigency&&b.vigency&&String(a.vigency)!==String(b.vigency)){
        conflict={conflictDetected:true,conflictType:'POTENTIAL_CONFLICT',conflictReasonCode:'DIVERGENT_VIGENCY',conflictingDocuments:[a.documentId,b.documentId],reasonCode:'DIVERGENT_VIGENCY'};
      }
    }
  }
  if(conflict.conflictDetected){
    const preferred=[...list].filter(d=>conflict.conflictingDocuments.includes(d.documentId)).sort((a,b)=>{
      const vr=(Date.parse(b.vigency||0)||0)-(Date.parse(a.vigency||0)||0);if(vr)return vr;return(b.maxScore||0)-(a.maxScore||0);
    })[0];
    const pe=preferred?evidences.filter(e=>e.documentId===preferred.documentId).sort((a,b)=>(b.evidenceScore||0)-(a.evidenceScore||0))[0]:null;
    conflict.preferredDocumentId=preferred?.documentId||null;
    conflict.preferredEvidenceId=pe?.evidenceId||null;
    for(const e of evidences){
      if(conflict.conflictingDocuments.includes(e.documentId)) e.conflictFlags.push(conflict.conflictType);
    }
  }
}

const selectedChunks=evidences.map((e,i)=>({
  chunkId:e.chunkId,documentId:e.documentId,documentVersionId:e.versionId,documentTitle:e.documentTitle,
  sectorId:e.sectorId,sectorName:e.setor,categoryId:e.categoryId,categoryName:e.categoria,
  subcategoryId:e.subcategoryId,subcategoryName:e.subcategoria,vigencyDate:e.expiration,expirationDate:e.expiration,
  chunkOrder:e.chunkOrder??i,chunkKind:e.chunkKind,sheetName:e.sheetName,rowStart:e.rowStart,rowEnd:e.rowEnd,
  text:e.chunkText,content:e.chunkText,
  hybridScore:e.retrievalScore!=null?e.retrievalScore/100:null,
  rerankScore:e.rerankScore!=null?e.rerankScore/100:null,
  relevance:e.evidenceScore/100,ocrQualityGrade:e.ocrGrade,evidenceId:e.evidenceId,evidenceScore:e.evidenceScore,evidenceGrade:e.evidenceGrade,isCurrent:e.currentVersion
}));

let sources=prep.sources||[];
if(enableRich){
  const byDoc=new Map();
  for(const e of evidences){
    const id=String(e.documentId||'');if(!id)continue;
    if(!byDoc.has(id))byDoc.set(id,{documentId:id,documentTitle:e.documentTitle,setor:e.setor,categoria:e.categoria,subcategoria:e.subcategoria,ocrGrade:e.ocrGrade,sourceType:e.sourceType,vigente:!e.expiration||new Date(e.expiration).getTime()>=Date.now(),evidenceScore:e.evidenceScore,expiration:e.expiration});
    else{const s=byDoc.get(id);s.evidenceScore=Math.max(s.evidenceScore||0,e.evidenceScore||0);if(e.sourceType==='tabular')s.sourceType='tabular';}
  }
  sources=[...byDoc.values()].sort((a,b)=>(b.evidenceScore||0)-(a.evidenceScore||0)).map((s,index)=>({
    index:index+1,documentId:s.documentId,documentTitle:s.documentTitle,sectorName:s.setor,categoryName:s.categoria,subcategoryName:s.subcategoria,
    ocrGrade:s.ocrGrade,sourceType:s.sourceType,vigente:s.vigente,evidenceScore:s.evidenceScore,expirationDate:s.expiration||null
  }));
}

const scores=evidences.map(e=>e.evidenceScore||0);
const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
const ocrDist={},tabDist={tabular:0,texto:0,OCR:0},confDist={HIGH:0,MEDIUM:0,LOW:0};
for(const e of evidences){const g=e.ocrGrade||'N/A';ocrDist[g]=(ocrDist[g]||0)+1;tabDist[e.sourceType]=(tabDist[e.sourceType]||0)+1;confDist[e.confidence]=(confDist[e.confidence]||0)+1;}
const evidenceMeta={
  evidenceCount:evidences.length,averageEvidenceScore:Math.round(avg*10)/10,highestEvidenceScore:scores.length?Math.max(...scores):0,
  conflictCount:conflict.conflictDetected?conflict.conflictingDocuments.length:0,conflictDetected:!!conflict.conflictDetected,conflictType:conflict.conflictType||'NO_CONFLICT',
  redundancyCount,deduplicatedEvidenceCount:dedupCount,ocrDistribution:ocrDist,tabularDistribution:tabDist,confidenceDistribution:confDist,
  selectedEvidenceIds:evidences.map(e=>e.evidenceId),excludedEvidenceIds:excluded.map(e=>e.evidenceId),
  labelDiversity:new Set(evidences.flatMap(e=>e.labels||[])).size,durationMs:Date.now()-t0,schemaVersion:'evidence-schema-v1',
  mode,configVersion:versionLabel,configVersionId:versionId
};
const contextInput={evidences,conflicts:conflict,statistics:evidenceMeta,sources,evidenceMeta};
let finalAudit='AI_EVIDENCE_COMPLETED';
if(conflict.conflictDetected) finalAudit='AI_EVIDENCE_CONFLICT';
else if(evidences.some(e=>e.confidence==='LOW')) finalAudit='AI_EVIDENCE_LOW_CONFIDENCE';

return [{json:{
  question:prep.question,classification:prep.classification,retrievalMeta:prep.retrievalMeta,
  selectedChunks,sources,evidences,excludedEvidences:excluded,contextInput,evidenceMeta,conflict,
  auditAction:finalAudit,requestId:prep.requestId,legacyContext:prep.legacyContext||''
}}];`;

const prepareCode = `const t=$input.first().json||{};
const parse=(s,fb)=>{try{return typeof s==='string'&&s?JSON.parse(s):(s??fb);}catch(_){return fb;}};
return [{json:{
  question:String(t.question||''),
  classification:parse(t.classificationJson,{}),
  selectedChunks:parse(t.selectedChunksJson,[]),
  sources:parse(t.sourcesJson,[]),
  retrievalMeta:parse(t.retrievalMetaJson,{}),
  legacyContext:String(t.legacyContext||''),
  evidenceConfigVersionId:t.evidenceConfigVersionId||null,
  requestId:String(t.requestId||''),
}}];`;

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
          'question','classificationJson','selectedChunksJson','sourcesJson','retrievalMetaJson',
          'legacyContext','evidenceConfigVersionId','requestId',
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
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    credentials: { postgres: { id: PG_CRED, name: 'Postgres' } },
    parameters: {
      operation: 'executeQuery',
      query: `={{ (() => {
  const id = String($json.evidenceConfigVersionId || '').trim();
  if (id && /^[0-9a-f-]{36}$/i.test(id)) {
    return "SELECT id, version_label, mode, status, configuration FROM ai_evidence_config_versions WHERE id='" + id + "' LIMIT 1";
  }
  return "SELECT id, version_label, mode, status, configuration FROM ai_evidence_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1";
})() }}`,
      options: {},
    },
  },
  {
    id: randomUUID(),
    name: 'Construir evidências',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [660, 0],
    parameters: { jsCode: buildCode },
  },
];

const connections = {
  Trigger: { main: [[{ node: 'Preparar entrada', type: 'main', index: 0 }]] },
  'Preparar entrada': { main: [[{ node: 'Load config', type: 'main', index: 0 }]] },
  'Load config': { main: [[{ node: 'Construir evidências', type: 'main', index: 0 }]] },
};

const runtimeVid = await upsertWorkflow({
  id: EVIDENCE_ID,
  name: 'IA - CONSTRUIR EVIDÊNCIAS',
  nodes,
  connections,
  active: true,
  description: 'Etapa 23 Evidence Layer',
});

// ---- Wire Consulta ----
{
  const { rows } = await client.query(`SELECT nodes, connections, name FROM workflow_entity WHERE id=$1`, [CONSULTA]);
  let nodesC = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let connC =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

  const skip = new Set(['IA - CONSTRUIR EVIDÊNCIAS', 'Aplicar evidências']);
  nodesC = nodesC.filter((n) => !skip.has(n.name));
  for (const k of Object.keys(connC)) {
    if (!connC[k]?.main) continue;
    connC[k].main = connC[k].main.map((branch) =>
      (branch || []).filter((c) => !skip.has(c.node)),
    );
  }
  delete connC['IA - CONSTRUIR EVIDÊNCIAS'];
  delete connC['Aplicar evidências'];

  nodesC.push({
    id: randomUUID(),
    name: 'IA - CONSTRUIR EVIDÊNCIAS',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.2,
    position: [1180, 400],
    onError: 'continueRegularOutput',
    parameters: {
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: EVIDENCE_ID },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          question: "={{ $('Aplicar contexto recuperado').first().json.question || '' }}",
          classificationJson:
            "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.classification || {}) }}",
          selectedChunksJson:
            "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.selectedChunks || []) }}",
          sourcesJson: "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.sources || []) }}",
          retrievalMetaJson:
            "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.retrievalMeta || {}) }}",
          legacyContext: "={{ String($('Aplicar contexto recuperado').first().json.context || '') }}",
          evidenceConfigVersionId: `={{ (() => { const b=$('Normalizar request').first().json.body||{}; return String(b.evidenceConfigVersionId||''); })() }}`,
          requestId: "={{ $('Aplicar contexto recuperado').first().json.requestId || '' }}",
        },
      },
      options: {},
    },
  });

  nodesC.push({
    id: randomUUID(),
    name: 'Aplicar evidências',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1400, 400],
    parameters: {
      jsCode: `const base=$('Aplicar contexto recuperado').first().json||{};
const ev=$input.first().json||{};
return [{json:{
  ...base,
  selectedChunks: Array.isArray(ev.selectedChunks) ? ev.selectedChunks : (base.selectedChunks||[]),
  sources: Array.isArray(ev.sources) && ev.sources.length ? ev.sources : (base.sources||[]),
  evidences: ev.evidences || [],
  evidenceMeta: ev.evidenceMeta || null,
  contextInput: ev.contextInput || null,
  evidenceConflict: ev.conflict || null,
}}];`,
    },
  });

  // Insert between Aplicar contexto recuperado and Carregar prompt ativo
  connC['Aplicar contexto recuperado'] = {
    main: [[{ node: 'IA - CONSTRUIR EVIDÊNCIAS', type: 'main', index: 0 }]],
  };
  connC['IA - CONSTRUIR EVIDÊNCIAS'] = {
    main: [[{ node: 'Aplicar evidências', type: 'main', index: 0 }]],
  };
  connC['Aplicar evidências'] = {
    main: [[{ node: 'Carregar prompt ativo', type: 'main', index: 0 }]],
  };

  // Patch CWM call to use Aplicar evidências for selectedChunks
  const cwm = nodesC.find((n) => n.name === 'IA - GERENCIAR JANELA DE CONTEXTO');
  if (cwm?.parameters?.workflowInputs?.value) {
    const v = cwm.parameters.workflowInputs.value;
    if (v.selectedChunksJson) {
      v.selectedChunksJson =
        "={{ JSON.stringify($('Aplicar evidências').first().json.selectedChunks || []) }}";
    }
    if (v.sourcesJson) {
      v.sourcesJson = "={{ JSON.stringify($('Aplicar evidências').first().json.sources || []) }}";
    }
    if (v.legacyContext !== undefined) {
      v.legacyContext = "={{ String($('Aplicar evidências').first().json.context || '') }}";
    }
  }

  // Patch Aplicar janela to forward evidenceMeta
  const aplicarJanela = nodesC.find((n) => n.name === 'Aplicar janela de contexto');
  if (aplicarJanela?.parameters?.jsCode && !aplicarJanela.parameters.jsCode.includes('evidenceMeta')) {
    aplicarJanela.parameters.jsCode = aplicarJanela.parameters.jsCode.replace(
      'return [{json:{',
      `const evidenceMeta=(()=>{try{return $('Aplicar evidências').first().json.evidenceMeta||null;}catch(_){return null;}})();
return [{json:{
      evidenceMeta: evidenceMeta,`,
    );
  }

  // Patch Aplicar cache save / Montar resposta paths to include evidenceMeta in data if present
  const aplicarSave = nodesC.find((n) => n.name === 'Aplicar cache save');
  if (aplicarSave?.parameters?.jsCode && !aplicarSave.parameters.jsCode.includes('evidenceMeta')) {
    aplicarSave.parameters.jsCode = aplicarSave.parameters.jsCode.replace(
      'cacheMeta,promptVersion:',
      'cacheMeta,evidenceMeta:(lookup.evidenceMeta||null),promptVersion:',
    );
    // ensure lookup carries evidenceMeta
    if (!aplicarSave.parameters.jsCode.includes('lookup.evidenceMeta')) {
      aplicarSave.parameters.jsCode = aplicarSave.parameters.jsCode.replace(
        'const lookup=$(\'Aplicar cache lookup\').first().json||{};',
        `const lookup=$('Aplicar cache lookup').first().json||{};
const evidenceMeta=(()=>{try{return $('Aplicar evidências').first().json.evidenceMeta||lookup.evidenceMeta||null;}catch(_){return null;}})();`,
      );
      aplicarSave.parameters.jsCode = aplicarSave.parameters.jsCode.replace(
        'evidenceMeta:(lookup.evidenceMeta||null)',
        'evidenceMeta',
      );
    }
  }

  const aplicarLookup = nodesC.find((n) => n.name === 'Aplicar cache lookup');
  if (aplicarLookup?.parameters?.jsCode && !aplicarLookup.parameters.jsCode.includes('evidenceMeta')) {
    aplicarLookup.parameters.jsCode = aplicarLookup.parameters.jsCode.replace(
      'return [{json:{...ctx,',
      `const evidenceMeta=(()=>{try{return $('Aplicar evidências').first().json.evidenceMeta||null;}catch(_){return null;}})();
return [{json:{...ctx, evidenceMeta,`,
    );
  }

  const consultaVid = await upsertWorkflow({
    id: CONSULTA,
    name: rows[0].name,
    nodes: nodesC,
    connections: connC,
    active: true,
    description: 'Etapa 23 wire Evidence Layer',
  });

  writeFileSync(
    new URL('./_e23-runtime.json', import.meta.url),
    JSON.stringify({ EVIDENCE_ID, runtimeVid, consultaVid }, null, 2),
  );
}

await client.end();
console.log('done');
