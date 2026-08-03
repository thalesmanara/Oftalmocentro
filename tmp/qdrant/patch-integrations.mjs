#!/usr/bin/env node
/** Patch Processar, Consulta IA hybrid, Health, Backup, Dataset + create schedule/webhook */
import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync } from 'fs';
import pg from 'pg';

const IDS = JSON.parse(readFileSync(new URL('./workflow-ids.json', import.meta.url), 'utf8'));
const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const OAI = { id: 'g6QTP6n02dss9A0d', name: 'OpenAI account' };
const AUDIT = 'jtQvQlqRZ5X5WF9I';
const NORMALIZE = 'N3zLpj7Dij4n5p5p';
const AUTH = 'P5E43ZXSJiI9wFYD';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows: helperRows } = await client.query(
  `SELECT id, name FROM workflow_entity WHERE name IN ('AUTH - VALIDAR PERMISSÃO','SYSTEM - PREPARAR SUCESSO','SYSTEM - PREPARAR ERRO')`
);
const helpers = Object.fromEntries(helperRows.map((r) => [r.name, r.id]));

function N(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
function setTargets(c, src, idx, targets) {
  if (!c[src]) c[src] = { main: [[]] };
  if (!c[src].main) c[src].main = [[]];
  while (c[src].main.length <= idx) c[src].main.push([]);
  c[src].main[idx] = targets.map((n) => ({ node: n, type: 'main', index: 0 }));
}
function upsertNode(nodes, node) {
  const i = nodes.findIndex((n) => n.name === node.name);
  if (i >= 0) nodes[i] = { ...nodes[i], ...node, id: nodes[i].id };
  else nodes.push({ id: randomUUID(), ...node });
}
async function load(id) {
  const { rows } = await client.query(`SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`, [id]);
  if (!rows[0]) throw new Error('missing ' + id);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections: typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections,
  };
}
async function save(wf) {
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`, [
    JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id,
  ]);
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId]
    );
  }
}

const out = {};

// ---- Processar: Embedding ok? → QDRANT ORQUESTRAR → Qdrant ok? → Promover ----
{
  const wf = await load('vNDpCzOdR7ATnHDP');
  upsertNode(wf.nodes, {
    name: 'Chamar QDRANT - ORQUESTRAR',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.3,
    position: [2840, 200],
    parameters: {
      mode: 'once', source: 'database',
      workflowId: { __rl: true, mode: 'id', value: IDS.ORQUESTRAR, cachedResultName: 'QDRANT - ORQUESTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          versionId: "={{ $('Buscar documento no PostgreSQL').first().json.versionId }}",
          documentId: "={{ $('Buscar documento no PostgreSQL').first().json.id }}",
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          force: false,
        },
      },
      options: { waitForSubWorkflow: true },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  });
  upsertNode(wf.nodes, {
    name: 'Qdrant ok?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [3060, 200],
    parameters: {
      conditions: {
        options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'loose' },
        combinator: 'and',
        conditions: [{
          id: 'q1',
          operator: { type: 'boolean', operation: 'true' },
          leftValue: '={{ $json.ok }}',
          rightValue: true,
        }],
      },
      looseTypeValidation: true,
    },
  });
  upsertNode(wf.nodes, {
    name: 'Marcar falha qdrant',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [3280, 360],
    credentials: { postgres: PG },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query:
        "UPDATE document_versions SET status='FAILED', processing_status='failed', qdrant_sync_status='FAILED'\n" +
        "WHERE id = '{{ $('Buscar documento no PostgreSQL').first().json.versionId }}'::uuid;\n" +
        "UPDATE documents SET processing_status='error', updated_at=NOW()\n" +
        "WHERE id = '{{ $('Buscar documento no PostgreSQL').first().json.id }}'::uuid;\n" +
        "SELECT false AS ok, 'QDRANT_SYNC_FAILED' AS errorCode;",
    },
  });
  setTargets(wf.connections, 'Embedding ok?', 0, ['Chamar QDRANT - ORQUESTRAR']);
  setTargets(wf.connections, 'Chamar QDRANT - ORQUESTRAR', 0, ['Qdrant ok?']);
  setTargets(wf.connections, 'Qdrant ok?', 0, ['Promover versão']);
  setTargets(wf.connections, 'Qdrant ok?', 1, ['Marcar falha qdrant']);
  setTargets(wf.connections, 'Marcar falha qdrant', 0, ['Tratar erro processamento']);
  await save(wf);
  out.processar = true;
}

// ---- Consulta IA hybrid ----
{
  const wf = await load('8EXk5RkFW5cxnenL');
  upsertNode(wf.nodes, {
    name: 'Preparar embedding pergunta',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1400, 100],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const cls=$input.first().json||{};const question=String(cls.question||'').trim();return [{json:{...cls,openaiBody:{model:'text-embedding-3-small',input:question||' '},hasQuestion:!!question}}];`,
    },
  });
  upsertNode(wf.nodes, {
    name: 'Embed pergunta',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.4,
    position: [1620, 100],
    credentials: { openAiApi: OAI },
    alwaysOutputData: true,
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/embeddings',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: "={{ $('Preparar embedding pergunta').first().json.openaiBody }}",
      options: { timeout: 30000, response: { response: { fullResponse: true, neverError: true } } },
    },
  });
  upsertNode(wf.nodes, {
    name: 'Extrair vetor pergunta',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1840, 100],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const cls=$('Preparar embedding pergunta').first().json||{};const resp=$input.first().json||{};const statusCode=Number(resp.statusCode??resp.status??0);let body=resp.body??resp.data??resp;if(typeof body==='string'){try{body=JSON.parse(body);}catch(_){body={};}}const emb=(body&&body.data&&body.data[0]&&body.data[0].embedding)||null;const ok=statusCode>=200&&statusCode<300&&Array.isArray(emb);return [{json:{...cls,queryVector:emb||[],queryVectorJson:JSON.stringify(emb||[]),vectorOk:ok}}];`,
    },
  });
  upsertNode(wf.nodes, {
    name: 'Busca vetorial Qdrant',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.3,
    position: [2060, 40],
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      mode: 'once', source: 'database',
      workflowId: { __rl: true, mode: 'id', value: IDS.BUSCAR, cachedResultName: 'QDRANT - BUSCAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          queryVectorJson: "={{ $json.queryVectorJson }}",
          topK: "={{ Number($json.topK || 12) }}",
          categoryId: "={{ $json.categoryId || '' }}",
          subcategoryId: "={{ $json.subcategoryId || '' }}",
        },
      },
      options: { waitForSubWorkflow: true },
    },
  });
  // Keep textual search - but need classification fields. Wire: Extrair vetor → both Buscar chunks (needs classif) and Busca vetorial
  // Actually Buscar chunks relevantes uses Classificar pergunta fields via $json. So we need to pass classification into textual search.
  // Current: Classificar → Buscar chunks. New: Classificar → Preparar embed → Embed → Extrair → (Busca vetorial + need textual)
  // Textual SQL uses $json from Classificar. So before Buscar chunks we need classification on $json.
  upsertNode(wf.nodes, {
    name: 'Restaurar classificação p/ texto',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2060, 200],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const cls=$('Extrair vetor pergunta').first().json||{};return [{json:cls}];`,
    },
  });
  upsertNode(wf.nodes, {
    name: 'Merge híbrido',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2500, 100],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const cls=$('Extrair vetor pergunta').first().json||{};
let vectorHits=[];
try{vectorHits=($('Busca vetorial Qdrant').first().json.hits)||[];}catch(_){vectorHits=[];}
const textRows=$input.all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));
const wV=0.65,wT=0.35;
const maxText=Math.max(1,...textRows.map(r=>Number(r.relevance||0)));
const byId=new Map();
for(const h of vectorHits){
  const id=String(h.chunkId||'');
  if(!id)continue;
  byId.set(id,{chunkId:id,documentId:h.documentId,documentTitle:h.documentTitle,sectorId:h.sectorId,categoryId:h.categoryId,subcategoryId:h.subcategoryId,chunkIndex:h.chunkIndex,chunkKind:h.chunkKind,sheetName:h.sheetName,ocrQuality:h.ocrQuality,vectorScore:Number(h.vectorScore||0),textScore:0,chunkText:null,versionId:h.documentVersionId,isCurrent:h.isCurrent===true});
}
for(const r of textRows){
  // hydrate by matching documentId+chunkOrder if no chunk id in text rows
  const key=String(r.chunkId||r.id||(r.documentId+':'+r.chunkOrder)||'');
  const textScore=Number(r.relevance||0)/maxText;
  let row=null;
  for(const [id,v] of byId){ if(v.documentId===r.documentId && (v.chunkIndex==r.chunkOrder || v.chunkText===r.chunkText)){row=v;break;} }
  if(!row){
    // try find by text identity later; create synthetic key from doc+order
    const synth=String(r.documentId)+':'+String(r.chunkOrder);
    row=byId.get(synth)||{
      chunkId:synth,documentId:r.documentId,documentTitle:r.documentTitle,sectorId:r.sectorId,categoryId:r.categoryId,subcategoryId:r.subcategoryId,
      chunkIndex:r.chunkOrder,chunkKind:r.chunkKind,sheetName:r.sheetName,ocrQuality:null,vectorScore:0,textScore:0,chunkText:r.chunkText,versionId:r.versionId,isCurrent:true,
      vigencyDate:r.vigencyDate,documentUpdatedAt:r.documentUpdatedAt,versionNumber:r.versionNumber,sectorName:r.sectorName,categoryName:r.categoryName,subcategoryName:r.subcategoryName,categoryDescription:r.categoryDescription,subcategoryDescription:r.subcategoryDescription
    };
    byId.set(synth,row);
  }
  row.textScore=Math.max(row.textScore||0,textScore);
  row.chunkText=r.chunkText||row.chunkText;
  row.documentTitle=r.documentTitle||row.documentTitle;
  row.sectorName=r.sectorName||row.sectorName;
  row.categoryName=r.categoryName||row.categoryName;
  row.subcategoryName=r.subcategoryName||row.subcategoryName;
  row.categoryDescription=r.categoryDescription||row.categoryDescription;
  row.subcategoryDescription=r.subcategoryDescription||row.subcategoryDescription;
  row.vigencyDate=r.vigencyDate||row.vigencyDate;
  row.documentUpdatedAt=r.documentUpdatedAt||row.documentUpdatedAt;
  row.versionNumber=r.versionNumber||row.versionNumber;
  row.versionId=r.versionId||row.versionId;
  row.chunkKind=r.chunkKind||row.chunkKind;
  row.sheetName=r.sheetName||row.sheetName;
}
// hydrate missing chunkText from text rows by documentId
for(const row of byId.values()){
  if(row.chunkText)continue;
  const match=textRows.find(t=>t.documentId===row.documentId && Number(t.chunkOrder)===Number(row.chunkIndex));
  if(match) row.chunkText=match.chunkText;
}
const catId=cls.categoryId||null; const subId=cls.subcategoryId||null;
const merged=[];
for(const row of byId.values()){
  if(!row.chunkText)continue;
  let boost=0;
  if(subId&&row.subcategoryId===subId)boost+=0.15;
  else if(catId&&row.categoryId===catId)boost+=0.10;
  const ocr=String(row.ocrQuality||'').toUpperCase();
  if(ocr==='EXCELLENT'||ocr==='GOOD')boost+=0.05;
  if(String(row.chunkKind||'').toLowerCase()==='tabular')boost+=0.05;
  if(row.isCurrent!==false)boost+=0.05;
  const vectorNorm=Math.max(0,Math.min(1,Number(row.vectorScore||0)));
  const textNorm=Math.max(0,Math.min(1,Number(row.textScore||0)));
  const mergedScore=wV*vectorNorm+wT*textNorm+boost;
  merged.push({
    documentId:row.documentId,documentTitle:row.documentTitle,sectorId:row.sectorId,sectorName:row.sectorName,
    categoryId:row.categoryId,categoryName:row.categoryName,categoryDescription:row.categoryDescription,
    subcategoryId:row.subcategoryId,subcategoryName:row.subcategoryName,subcategoryDescription:row.subcategoryDescription,
    vigencyDate:row.vigencyDate,documentUpdatedAt:row.documentUpdatedAt,versionNumber:row.versionNumber,versionId:row.versionId,
    chunkOrder:row.chunkIndex,chunkText:row.chunkText,chunkKind:row.chunkKind,sheetName:row.sheetName,
    relevance:Math.round(mergedScore*1000),vectorScore:vectorNorm,textScore:textNorm,mergedScore,retrievalMode:'hybrid'
  });
}
merged.sort((a,b)=>b.mergedScore-a.mergedScore || b.relevance-a.relevance);
const top=merged.slice(0,12);
if(!top.length&&textRows.length){
  return textRows.slice(0,12).map(r=>({json:{...r,retrievalMode:'text_fallback',vectorScore:0,textScore:Number(r.relevance||0),mergedScore:Number(r.relevance||0)}}));
}
return top.map(r=>({json:r}));`,
    },
  });

  // Rewire
  setTargets(wf.connections, 'Classificar pergunta', 0, ['Preparar embedding pergunta']);
  setTargets(wf.connections, 'Preparar embedding pergunta', 0, ['Embed pergunta']);
  setTargets(wf.connections, 'Embed pergunta', 0, ['Extrair vetor pergunta']);
  // Fan-out: Extrair → Busca vetorial AND Restaurar classificação → Buscar chunks
  setTargets(wf.connections, 'Extrair vetor pergunta', 0, ['Busca vetorial Qdrant', 'Restaurar classificação p/ texto']);
  setTargets(wf.connections, 'Restaurar classificação p/ texto', 0, ['Buscar chunks relevantes']);
  // Merge needs both - use Buscar chunks as trigger for Merge, reading vector from Busca vetorial via $()
  setTargets(wf.connections, 'Buscar chunks relevantes', 0, ['Merge híbrido']);
  // Busca vetorial should not block - Merge runs after text. To wait for both, connect Busca vetorial also to Merge via merge node would be better.
  // Simple approach: Merge only after text, and uses $('Busca vetorial Qdrant') - but race if vector slower.
  // Add wait: connect both to Merge using connections from both - n8n will wait for both if Merge node, but Code node from one input only.
  // Use: Busca vetorial → noop that stores, and Buscar chunks → Merge. The $() lookup works if Busca vetorial already finished in same execution branch... Actually in n8n fan-out, sibling branches are separate. $('Busca vetorial Qdrant') from Merge on text branch may fail if not connected.
  // Fix: connect Busca vetorial → Merge híbrido as well - but Code with two inputs needs Merge node.
  // Better: put Merge after a Merge node append of both.

  upsertNode(wf.nodes, {
    name: 'Aguardar recuperações',
    type: 'n8n-nodes-base.merge',
    typeVersion: 3.2,
    position: [2300, 100],
    parameters: { mode: 'combine', combineBy: 'combineByPosition', options: {} },
  });
  // Actually combineByPosition is wrong for different shapes. Use mode append then code.
  wf.nodes.find((n) => n.name === 'Aguardar recuperações').parameters = { mode: 'append', options: {} };

  setTargets(wf.connections, 'Busca vetorial Qdrant', 0, ['Aguardar recuperações']);
  setTargets(wf.connections, 'Buscar chunks relevantes', 0, ['Aguardar recuperações']);
  setTargets(wf.connections, 'Aguardar recuperações', 0, ['Merge híbrido']);
  setTargets(wf.connections, 'Merge híbrido', 0, ['Montar contexto']);

  // Fix Merge híbrido to read from append items
  const mergeNode = wf.nodes.find((n) => n.name === 'Merge híbrido');
  mergeNode.parameters.jsCode = `const cls=$('Extrair vetor pergunta').first().json||{};
const items=$input.all().map(i=>i.json);
let vectorHits=[];
const textRows=[];
for(const it of items){
  if(Array.isArray(it.hits)) vectorHits=it.hits;
  else if(it.chunkText||it.documentId) textRows.push(it);
}
try{ if(!vectorHits.length) vectorHits=($('Busca vetorial Qdrant').first().json.hits)||[]; }catch(_){}
const wV=0.65,wT=0.35;
const maxText=Math.max(1,...textRows.map(r=>Number(r.relevance||0)));
const byKey=new Map();
function keyOf(docId,order){return String(docId)+':'+String(order);}
for(const h of vectorHits){
  const k=keyOf(h.documentId,h.chunkIndex);
  byKey.set(k,{documentId:h.documentId,documentTitle:h.documentTitle,sectorId:h.sectorId,categoryId:h.categoryId,subcategoryId:h.subcategoryId,chunkIndex:h.chunkIndex,chunkKind:h.chunkKind,sheetName:h.sheetName,ocrQuality:h.ocrQuality,vectorScore:Number(h.vectorScore||0),textScore:0,chunkText:null,versionId:h.documentVersionId,isCurrent:h.isCurrent!==false});
}
for(const r of textRows){
  const k=keyOf(r.documentId,r.chunkOrder);
  const textScore=Number(r.relevance||0)/maxText;
  const row=byKey.get(k)||{documentId:r.documentId,documentTitle:r.documentTitle,sectorId:r.sectorId,categoryId:r.categoryId,subcategoryId:r.subcategoryId,chunkIndex:r.chunkOrder,chunkKind:r.chunkKind,sheetName:r.sheetName,ocrQuality:null,vectorScore:0,textScore:0,chunkText:null,versionId:r.versionId,isCurrent:true};
  row.textScore=Math.max(row.textScore||0,textScore);
  row.chunkText=r.chunkText||row.chunkText;
  row.documentTitle=r.documentTitle||row.documentTitle;
  row.sectorName=r.sectorName; row.categoryName=r.categoryName; row.subcategoryName=r.subcategoryName;
  row.categoryDescription=r.categoryDescription; row.subcategoryDescription=r.subcategoryDescription;
  row.vigencyDate=r.vigencyDate; row.documentUpdatedAt=r.documentUpdatedAt; row.versionNumber=r.versionNumber; row.versionId=r.versionId||row.versionId;
  byKey.set(k,row);
}
const catId=cls.categoryId||null, subId=cls.subcategoryId||null;
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
  merged.push({documentId:row.documentId,documentTitle:row.documentTitle,sectorId:row.sectorId,sectorName:row.sectorName,categoryId:row.categoryId,categoryName:row.categoryName,categoryDescription:row.categoryDescription,subcategoryId:row.subcategoryId,subcategoryName:row.subcategoryName,subcategoryDescription:row.subcategoryDescription,vigencyDate:row.vigencyDate,documentUpdatedAt:row.documentUpdatedAt,versionNumber:row.versionNumber,versionId:row.versionId,chunkOrder:row.chunkIndex,chunkText:row.chunkText,chunkKind:row.chunkKind,sheetName:row.sheetName,relevance:Math.round(mergedScore*1000),vectorScore:vectorNorm,textScore:textNorm,mergedScore,retrievalMode:vectorHits.length?'hybrid':'text_fallback'});
}
merged.sort((a,b)=>b.mergedScore-a.mergedScore);
const top=merged.slice(0,12);
if(!top.length) return textRows.slice(0,12).map(r=>({json:{...r,retrievalMode:'text_fallback'}}));
return top.map(r=>({json:r}));`;

  await save(wf);
  out.consultaIa = true;
}

// ---- Health qdrant component ----
{
  const wf = await load('qAyYc9DrHIqe4L9i');
  const probe = wf.nodes.find((x) => x.name === 'Probe database');
  const prep = wf.nodes.find((x) => x.name === 'Prepare checks');
  const agg = wf.nodes.find((x) => x.name === 'Aggregate health');
  if (probe && !probe.parameters.query.includes('qdrant_sync_stats')) {
    probe.parameters.query = probe.parameters.query
      .replace(
        'embedding_stats AS (',
        `qdrant_sync_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND embedding_sync_status='SYNCED')::int AS qdrant_synced,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND (embedding_sync_status IS NULL OR embedding_sync_status IN ('PENDING','INVALID')))::int AS qdrant_pending,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND embedding_sync_status='FAILED')::int AS qdrant_failed,
    ROUND(AVG(embedding_sync_ms) FILTER (WHERE embedding_sync_ms IS NOT NULL))::int AS qdrant_avg_ms,
    MAX(embedding_synced_at) AS qdrant_last_sync
  FROM document_chunks
),
embedding_stats AS (`
      )
      .replace(
        'embedding_stats.embedding_avg_ms,',
        `embedding_stats.embedding_avg_ms,
  qdrant_sync_stats.qdrant_synced,
  qdrant_sync_stats.qdrant_pending,
  qdrant_sync_stats.qdrant_failed,
  qdrant_sync_stats.qdrant_avg_ms,
  qdrant_sync_stats.qdrant_last_sync,`
      )
      .replace(
        'CROSS JOIN embedding_stats',
        'CROSS JOIN embedding_stats\nCROSS JOIN qdrant_sync_stats'
      );
  }
  if (prep && !prep.parameters.jsCode.includes('qdrantDb')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'const embeddingsDb = dbFailed',
      `const qdrantDb = dbFailed
  ? { synced: 0, pending: 0, failed: 0, avgMs: null, lastSync: null }
  : {
      synced: Number(dbItem.qdrant_synced ?? 0) || 0,
      pending: Number(dbItem.qdrant_pending ?? 0) || 0,
      failed: Number(dbItem.qdrant_failed ?? 0) || 0,
      avgMs: dbItem.qdrant_avg_ms != null ? Number(dbItem.qdrant_avg_ms) : null,
      lastSync: dbItem.qdrant_last_sync || null,
    };
const embeddingsDb = dbFailed`
    );
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'embeddingsDb,\n    },',
      'embeddingsDb,\n      qdrantDb,\n    },'
    );
  }
  // Add HTTP probe node if missing
  if (!wf.nodes.find((n) => n.name === 'Probe Qdrant')) {
    upsertNode(wf.nodes, {
      name: 'Probe Qdrant',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.4,
      position: [900, 520],
      alwaysOutputData: true,
      onError: 'continueRegularOutput',
      parameters: {
        method: 'GET',
        url: 'http://qdrant:6333/collections/oftalmocentro_chunks',
        options: { timeout: 5000, response: { response: { fullResponse: true, neverError: true } } },
      },
    });
    // wire from Prepare checks sibling - find Probe OCR connection pattern
    const prepName = 'Prepare checks';
    if (wf.connections[prepName]?.main?.[0]) {
      wf.connections[prepName].main[0].push({ node: 'Probe Qdrant', type: 'main', index: 0 });
    }
  }
  if (agg && !agg.parameters.jsCode.includes('qdrant:')) {
    agg.parameters.jsCode = agg.parameters.jsCode.replace(
      'embeddings: (() => {',
      `qdrant: (() => {
    const q = partial.qdrantDb || { synced: 0, pending: 0, failed: 0, avgMs: null, lastSync: null };
    let online = false; let points = 0; let collection = 'oftalmocentro_chunks';
    try {
      const pr = $('Probe Qdrant').first().json || {};
      const code = Number(pr.statusCode ?? pr.status ?? 0);
      let body = pr.body ?? pr;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      online = code >= 200 && code < 300 && body.status === 'ok';
      points = Number(body.result && body.result.points_count) || 0;
    } catch (_) {}
    const degraded = !online || q.failed > 0 || q.pending > 0;
    return {
      status: !online ? 'down' : (degraded ? 'degraded' : 'ok'),
      online, collection, total: points, pending: q.pending, failures: q.failed,
      avgDurationMs: q.avgMs, lastRunAt: q.lastSync, model: 'text-embedding-3-small',
    };
  })(),
  embeddings: (() => {`
    );
  }
  await save(wf);
  out.health = true;
}

// GET System Health allowlist
{
  const wf = await load('2UPHcxASp2PboC9M');
  for (const n of wf.nodes) {
    const code = n.parameters?.jsCode || '';
    if (code.includes('embeddings') && !code.includes("'qdrant'") && !code.includes('"qdrant"')) {
      n.parameters.jsCode = code.replace(/embeddings/g, (m, offset, s) => {
        // crude: add qdrant near embeddings in allowlists
        return m;
      });
      if (code.includes('aiPrompts')) {
        n.parameters.jsCode = code.replace('aiPrompts', "aiPrompts','qdrant").replace("aiPrompts\",", 'aiPrompts","qdrant",');
      }
      if (!n.parameters.jsCode.includes('qdrant')) {
        n.parameters.jsCode = code.replace(
          /\[([^\]]*embeddings[^\]]*)\]/,
          (m) => m.replace(']', ", 'qdrant']").replace(']', ',"qdrant"]')
        );
      }
    }
  }
  // safer patch
  const allow = wf.nodes.find((n) => (n.parameters?.jsCode || '').includes('components'));
  if (allow && !(allow.parameters.jsCode || '').includes('qdrant')) {
    allow.parameters.jsCode = allow.parameters.jsCode.replace(
      "'embeddings'",
      "'embeddings', 'qdrant'"
    ).replace('"embeddings"', '"embeddings", "qdrant"');
  }
  await save(wf);
  out.getHealth = true;
}

// Backup metadata note in BANCO export - add qdrant_meta without vectors
{
  const wf = await load('A16PhhWFr0Za9X3B');
  const n = wf.nodes.find((x) => x.name === 'Exportar tabelas app');
  if (n && !n.parameters.query.includes('qdrant_meta')) {
    n.parameters.query = n.parameters.query.replace(
      "'document_chunks'",
      `'qdrant_meta', (SELECT json_build_object('collection','oftalmocentro_chunks','distance','Cosine','dimensions',1536,'model','text-embedding-3-small','synced', (SELECT COUNT(*) FROM document_chunks WHERE embedding_sync_status='SYNCED'), 'pending', (SELECT COUNT(*) FROM document_chunks WHERE embedding_sync_status='PENDING'))),
  'document_chunks'`
    );
  }
  await save(wf);
  out.backup = true;
}

// Dataset retrieval_mode
{
  const wf = await load('12t0Ol6zWQJgAKPC');
  const n = wf.nodes.find((x) => x.name === 'Inserir run');
  if (n && !n.parameters.query.includes('retrieval_mode')) {
    let q = n.parameters.query;
    if (q.includes('embedding_version)')) {
      q = q.replace('embedding_version)', 'embedding_version, retrieval_mode)');
      q = q.replace(
        /embedding_engine_version' LIMIT 1\), 'unknown'\)/,
        "embedding_engine_version' LIMIT 1), 'unknown'),\n  'hybrid'"
      );
      // fallback patterns
      if (!q.includes("'hybrid'")) {
        q = q.replace(
          "embedding_version)\nSELECT",
          "embedding_version, retrieval_mode)\nSELECT"
        );
      }
    }
    n.parameters.query = q;
  }
  await save(wf);
  out.dataset = !!(n && n.parameters.query.includes('retrieval_mode'));
}

writeFileSync(new URL('./_patch-integrations.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(out);
await client.end();
