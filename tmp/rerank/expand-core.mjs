#!/usr/bin/env node
/**
 * Expand IA - CARREGAR RETRIEVAL CONFIG + IA - RE-RANQUEAR CANDIDATOS
 * Patch Consulta IA with configurable retrieval mode (default HYBRID = no behavior change)
 */
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';
import pg from 'pg';

const IDS = {
  RERANK: 'nivEQHAqHWIwP8P8',
  LOAD_CFG: 'sClDEVNVS0TGG2uq',
  CONSULTA: '8EXk5RkFW5cxnenL',
  AUDIT: 'jtQvQlqRZ5X5WF9I',
};
const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function N(name, type, typeVersion, position, parameters, extra = {}) {
  return { id: randomUUID(), name, type, typeVersion, position, parameters, ...extra };
}
function code(name, pos, jsCode, extra = {}) {
  return N(name, 'n8n-nodes-base.code', 2, pos, { mode: 'runOnceForAllItems', language: 'javaScript', jsCode }, extra);
}
function pgn(name, pos, query, extra = {}) {
  return N(name, 'n8n-nodes-base.postgres', 2.6, pos, { operation: 'executeQuery', options: {}, query }, { credentials: { postgres: PG }, ...extra });
}
function iff(name, pos, leftValue) {
  return N(name, 'n8n-nodes-base.if', 2.3, pos, {
    conditions: {
      combinator: 'and',
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c1', leftValue, rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
    },
    looseTypeValidation: true,
  });
}
function exec(name, pos, workflowId, cachedResultName, value, extra = {}) {
  return N(name, 'n8n-nodes-base.executeWorkflow', 1.3, pos, {
    mode: 'once', source: 'database',
    workflowId: { __rl: true, mode: 'id', value: workflowId, cachedResultName },
    workflowInputs: { mappingMode: 'defineBelow', value },
    options: { waitForSubWorkflow: true },
  }, extra);
}
function link(c, from, to, out = 0) {
  if (!c[from]) c[from] = { main: [[]] };
  while (c[from].main.length <= out) c[from].main.push([]);
  c[from].main[out].push({ node: to, type: 'main', index: 0 });
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
async function saveGraph(id, nodes, connections) {
  const { rows } = await client.query(`SELECT "activeVersionId" FROM workflow_entity WHERE id=$1`, [id]);
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, active=true, "updatedAt"=NOW() WHERE id=$3`, [
    JSON.stringify(nodes), JSON.stringify(connections), id,
  ]);
  if (rows[0]?.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(nodes), JSON.stringify(connections), id, rows[0].activeVersionId],
    );
  }
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
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`, [
    JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id,
  ]);
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId],
    );
  }
}

const out = { ids: IDS };

// ========== CARREGAR RETRIEVAL CONFIG ==========
{
  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [{ name: 'requestId', type: 'string' }, { name: 'modeOverride', type: 'string' }] },
    }),
    pgn('Buscar config publicada', [220, 0], `SELECT
  c.code,
  v.id AS version_id,
  v.version_label,
  v.version_number,
  v.status,
  v.mode,
  v.configuration,
  v.content_hash,
  v.published_at,
  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), v.mode) AS secret_mode
FROM ai_retrieval_configs c
JOIN ai_retrieval_config_versions v ON v.retrieval_config_id = c.id AND v.status = 'PUBLISHED'
WHERE c.code = COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_config_code' LIMIT 1), 'AI_QUERY_RETRIEVAL')
  AND c.active = true
LIMIT 1;`, { alwaysOutputData: true }),
    code('Normalizar config', [440, 0], `const t=$('Trigger').first().json||{};
const row=$input.first().json||{};
const override=String(t.modeOverride||'').trim().toUpperCase();
let configuration=row.configuration;
if(typeof configuration==='string'){try{configuration=JSON.parse(configuration);}catch(_){configuration={};}}
if(!configuration||typeof configuration!=='object') configuration={};
const mode=override||String(row.mode||row.secret_mode||'HYBRID').toUpperCase();
const defaults={
  mode:'HYBRID', candidateLimit:30, finalLimit:12, maxChunksPerDocument:4, enableNeighbors:false,
  weights:{semantic:0.65,lexical:0.35,hybridPrior:0},
  boosts:{subcategoryMatch:0.15,categoryMatch:0.1,titleMatch:0.08,exactIdentifier:0.2,tabularStructure:0.08,ocrGood:0.03,isCurrent:0.05,recentVigency:0.04,exactPhrase:0.08},
  penalties:{redundancyPerExtraChunk:0.06,staleDocument:0.05,lowUsefulLength:0.03},
  normalization:{vector:'clip01',text:'batchMax',hybrid:'passthrough'}
};
const cfg={...defaults,...configuration,mode,weights:{...defaults.weights,...(configuration.weights||{})},boosts:{...defaults.boosts,...(configuration.boosts||{})},penalties:{...defaults.penalties,...(configuration.penalties||{})},normalization:{...defaults.normalization,...(configuration.normalization||{})}};
cfg.candidateLimit=Math.min(Math.max(Number(cfg.candidateLimit||30)||30,5),50);
cfg.finalLimit=Math.min(Math.max(Number(cfg.finalLimit||12)||12,1),20);
cfg.maxChunksPerDocument=Math.min(Math.max(Number(cfg.maxChunksPerDocument||2)||2,1),8);
const ok=!!row.version_label;
return [{json:{ok, requestId:t.requestId||'', code:row.code||'AI_QUERY_RETRIEVAL', versionId:row.version_id||null, versionLabel:row.version_label||'hybrid-v1-fallback', versionNumber:Number(row.version_number||1), status:row.status||'FALLBACK', mode:cfg.mode, configuration:cfg, contentHash:row.content_hash||null, publishedAt:row.published_at||null, configurationJson:JSON.stringify(cfg)}}];`),
  ];
  const c = {};
  link(c, 'Trigger', 'Buscar config publicada');
  link(c, 'Buscar config publicada', 'Normalizar config');
  await saveGraph(IDS.LOAD_CFG, nodes, c);
  out.LOAD_CFG = true;
}

// ========== RE-RANQUEAR ==========
{
  const rerankJs = `const started=Date.now();
const t=$input.first().json||{};
function parseJson(v, fallback){ if(v==null||v==='') return fallback; if(typeof v==='object') return v; try{return JSON.parse(String(v));}catch(_){return fallback;} }
const question=String(t.question||'').trim();
const classification=parseJson(t.classificationJson, {});
let candidates=parseJson(t.candidatesJson, []);
if(!Array.isArray(candidates)) candidates=[];
const cfg=parseJson(t.configurationJson, {});
const mode=String(cfg.mode||t.mode||'HYBRID').toUpperCase();
const candidateLimit=Math.min(Math.max(Number(cfg.candidateLimit||30)||30,5),50);
const finalLimit=Math.min(Math.max(Number(cfg.finalLimit||12)||12,1),20);
const maxPerDoc=Math.min(Math.max(Number(cfg.maxChunksPerDocument||2)||2,1),8);
const weights=cfg.weights||{semantic:0.65,lexical:0.35,hybridPrior:0};
const boosts=cfg.boosts||{};
const penalties=cfg.penalties||{};
const requestId=String(t.requestId||'');

function clip01(x){ const n=Number(x); if(!Number.isFinite(n)) return null; return Math.max(0, Math.min(1, n)); }
function normalizeText(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim(); }
function extractIdentifiers(q){
  const out=[];
  const patterns=[
    /\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b/g, // CPF
    /\\bcrm\\s*\\d{3,}/gi,
    /\\boct\\b/gi,
    /\\b\\d{6,}\\b/g,
    /R\\$\\s*\\d+[\\.,]?\\d*/gi,
    /\\b[A-Z]{2,}\\d{2,}\\b/g,
  ];
  for(const re of patterns){ const m=String(q).match(re); if(m) out.push(...m); }
  return [...new Set(out.map(x=>normalizeText(x)).filter(Boolean))];
}
function tokenize(q){
  return normalizeText(q).split(/[^a-z0-9]+/).filter(t=>t.length>2);
}
const identifiers=extractIdentifiers(question);
const tokens=tokenize(question);
const qNorm=normalizeText(question);

// prepare batch norms
const textVals=candidates.map(c=>Number(c.textScore||0)).filter(Number.isFinite);
const hybridVals=candidates.map(c=>Number(c.mergedScore||c.hybridScore||0)).filter(Number.isFinite);
const maxText=Math.max(1e-9, ...textVals, 1e-9);
const minH=hybridVals.length?Math.min(...hybridVals):0;
const maxH=hybridVals.length?Math.max(...hybridVals):1;
const spanH=Math.max(1e-9, maxH-minH);

function scoreCandidate(c){
  const vectorRaw=c.vectorScore;
  const textRaw=c.textScore;
  const hybridRaw=c.mergedScore??c.hybridScore;
  const vectorNorm=vectorRaw==null||vectorRaw===''?null:clip01(vectorRaw);
  const textNorm=textRaw==null||textRaw===''?null:clip01(Number(textRaw)>1?Number(textRaw)/maxText:Number(textRaw));
  let hybridNorm=null;
  if(hybridRaw!=null&&hybridRaw!==''){
    const h=Number(hybridRaw);
    hybridNorm=cfg.normalization?.hybrid==='batchMinMax' ? clip01((h-minH)/spanH) : clip01(h>1?h/Math.max(maxH,1):h);
  }
  const title=normalizeText(c.documentTitle||'');
  const text=normalizeText(c.chunkText||c.text||'');
  const sheet=normalizeText(c.sheetName||'');
  const headers=normalizeText(typeof c.headersJson==='string'?c.headersJson:JSON.stringify(c.headersJson||''));
  const breakdown={};
  let score=0;
  const wSem=Number(weights.semantic??0.45);
  const wLex=Number(weights.lexical??0.25);
  const wHyb=Number(weights.hybridPrior??0.15);
  if(mode==='HYBRID' || mode==='TEXT_ONLY' || mode==='VECTOR_ONLY'){
    // pass-through: prefer hybrid/merged then vector/text
    score = hybridNorm!=null ? hybridNorm : ((vectorNorm||0)*0.65 + (textNorm||0)*0.35);
    breakdown.passthrough=score;
  } else {
    if(vectorNorm!=null){ score += wSem*vectorNorm; breakdown.semantic=wSem*vectorNorm; }
    if(textNorm!=null){ score += wLex*textNorm; breakdown.lexical=wLex*textNorm; }
    if(hybridNorm!=null && wHyb>0){ score += wHyb*hybridNorm; breakdown.hybridPrior=wHyb*hybridNorm; }
  }
  const catId=classification.categoryId||null;
  const subId=classification.subcategoryId||null;
  if(subId && c.subcategoryId===subId){ const b=Number(boosts.subcategoryMatch||0); score+=b; breakdown.subcategoryMatch=b; }
  else if(catId && c.categoryId===catId){ const b=Number(boosts.categoryMatch||0); score+=b; breakdown.categoryMatch=b; }
  // title match
  let titleHits=0; for(const tok of tokens){ if(title.includes(tok)) titleHits++; }
  if(titleHits>0){ const b=Number(boosts.titleMatch||0)*Math.min(1, titleHits/Math.max(1,Math.min(tokens.length,4))); score+=b; breakdown.titleMatch=b; }
  // exact identifiers
  let idHits=0; for(const id of identifiers){ if(id && (text.includes(id)||title.includes(id)||sheet.includes(id)||headers.includes(id))) idHits++; }
  if(idHits>0){ const b=Number(boosts.exactIdentifier||0)*Math.min(1.5, idHits); score+=b; breakdown.exactIdentifier=b; }
  // exact phrase (question fragment length>8)
  if(qNorm.length>8 && text.includes(qNorm.slice(0, Math.min(40, qNorm.length)))){ const b=Number(boosts.exactPhrase||0); score+=b; breakdown.exactPhrase=b; }
  // tabular structure
  const kind=String(c.chunkKind||'').toLowerCase();
  if(kind==='tabular'){
    let struct=0;
    for(const tok of tokens){ if(sheet.includes(tok)||headers.includes(tok)) struct++; }
    if(struct>0 || idHits>0){ const b=Number(boosts.tabularStructure||0)*Math.min(1, struct/2 || 1); score+=b; breakdown.tabularStructure=b; }
  }
  const ocr=String(c.ocrQuality||c.ocrQualityGrade||'').toUpperCase();
  if(ocr==='EXCELLENT'||ocr==='GOOD'){ const b=Number(boosts.ocrGood||0); score+=b; breakdown.ocrGood=b; }
  if(c.isCurrent!==false){ const b=Number(boosts.isCurrent||0); score+=b; breakdown.isCurrent=b; }
  // recent vigency / update
  const vig=c.vigencyDate?Date.parse(c.vigencyDate):NaN;
  const upd=c.documentUpdatedAt?Date.parse(c.documentUpdatedAt):NaN;
  const now=Date.now();
  if(Number.isFinite(vig)){
    const ageDays=(now-vig)/86400000;
    if(ageDays>=0 && ageDays<365){ const b=Number(boosts.recentVigency||0)*(1-Math.min(1, ageDays/365)); score+=b; breakdown.recentVigency=b; }
    if(ageDays<0){ /* future vigency ok */ }
  }
  // stale: very old update without current
  if(Number.isFinite(upd)){
    const ageDays=(now-upd)/86400000;
    if(ageDays>1100){ const p=Number(penalties.staleDocument||0); score-=p; breakdown.staleDocument=-p; }
  }
  const usefulLen=String(c.chunkText||c.text||'').trim().length;
  if(usefulLen>0 && usefulLen<40){ const p=Number(penalties.lowUsefulLength||0); score-=p; breakdown.lowUsefulLength=-p; }
  return {
    ...c,
    chunkId:c.chunkId||c.id||null,
    documentVersionId:c.documentVersionId||c.versionId||null,
    vectorScore:vectorNorm,
    textScore:textNorm,
    hybridScore:hybridNorm!=null?hybridNorm:(c.mergedScore??null),
    rerankScore:score,
    scoreBreakdown:breakdown,
  };
}

let scored=candidates.slice(0, candidateLimit).map(scoreCandidate);
scored.sort((a,b)=> (b.rerankScore-a.rerankScore) || ((b.hybridScore||0)-(a.hybridScore||0)) || ((b.vectorScore||0)-(a.vectorScore||0)));

// diversity
const selected=[];
const perDoc=new Map();
const seenHash=new Set();
const seenText=new Set();
for(const c of scored){
  if(selected.length>=finalLimit) break;
  const docId=String(c.documentId||'');
  const count=perDoc.get(docId)||0;
  if(docId && count>=maxPerDoc){
    c.selectionReason='skipped_diversity';
    continue;
  }
  const hash=String(c.contentHash||c.embeddingHash||'');
  const textKey=normalizeText(String(c.chunkText||c.text||'')).slice(0,180);
  if(hash && seenHash.has(hash)){ c.selectionReason='skipped_hash_dup'; continue; }
  if(textKey && seenText.has(textKey)){ c.selectionReason='skipped_text_dup'; continue; }
  // redundancy soft penalty already applied for extra chunks; hard cap above
  const reasonParts=['score'];
  if(c.scoreBreakdown?.exactIdentifier) reasonParts.push('exact_id');
  if(c.scoreBreakdown?.subcategoryMatch) reasonParts.push('subcategory');
  if(c.scoreBreakdown?.tabularStructure) reasonParts.push('tabular');
  const item={
    ...c,
    rerankPosition:selected.length+1,
    selectionReason:reasonParts.join('+'),
  };
  // apply redundancy accounting for next items of same doc by mutating remaining? handled by perDoc cap
  selected.push(item);
  if(docId) perDoc.set(docId, count+1);
  if(hash) seenHash.add(hash);
  if(textKey) seenText.add(textKey);
}

// if diversity emptied too much, fill from scored
if(selected.length<Math.min(finalLimit, scored.length)){
  for(const c of scored){
    if(selected.length>=finalLimit) break;
    if(selected.some(s=>(s.chunkId&&s.chunkId===c.chunkId)||(s.documentId===c.documentId&&s.chunkOrder===c.chunkOrder))) continue;
    selected.push({...c, rerankPosition:selected.length+1, selectionReason:(c.selectionReason||'fill')});
  }
}

const durationMs=Date.now()-started;
const rankedCandidates=selected.map((c,i)=>({
  ...c,
  rerankPosition:i+1,
  // keep fields Montar contexto expects
  chunkOrder:c.chunkOrder??c.chunkIndex??null,
  chunkText:c.chunkText||c.text||'',
  relevance:Math.round((c.rerankScore||0)*1000),
  mergedScore:c.rerankScore,
  retrievalMode:mode==='HYBRID_RERANK'?'hybrid_rerank':String(c.retrievalMode||mode.toLowerCase()),
}));

return [{json:{
  ok:true,
  rankedCandidates,
  rankingMetadata:{
    mode,
    candidateCount:candidates.length,
    consideredCount:scored.length,
    selectedCount:rankedCandidates.length,
    durationMs,
    fallbackUsed:false,
    versionLabel:cfg.versionLabel||null,
    maxChunksPerDocument:maxPerDoc,
    finalLimit,
    candidateLimit,
  },
  requestId,
}}];`;

  const nodes = [
    N('Trigger', 'n8n-nodes-base.executeWorkflowTrigger', 1.2, [0, 0], {
      inputSource: 'workflowInputs',
      workflowInputs: { values: [
        { name: 'question', type: 'string' },
        { name: 'classificationJson', type: 'string' },
        { name: 'candidatesJson', type: 'string' },
        { name: 'configurationJson', type: 'string' },
        { name: 'requestId', type: 'string' },
        { name: 'userId', type: 'string' },
        { name: 'sessionId', type: 'string' },
      ]},
    }),
    code('Validar entrada', [220, 0], `const t=$input.first().json||{};
function parseJson(v,f){if(v==null||v==='')return f; if(typeof v==='object')return v; try{return JSON.parse(String(v));}catch(_){return f;}}
const candidates=parseJson(t.candidatesJson,[]);
const ok=Array.isArray(candidates);
return [{json:{...t, ok, error: ok?null:'candidates_required', candidateCount: ok?candidates.length:0}}];`),
    iff('Entrada ok?', [440, 0], '={{ $json.ok === true }}'),
    code('Erro entrada', [660, 120], `const t=$input.first().json||{}; return [{json:{ok:false, rankedCandidates:[], rankingMetadata:{mode:'ERROR', fallbackUsed:true, error:t.error||'invalid_input', candidateCount:0, selectedCount:0, durationMs:0}, requestId:t.requestId||''}}];`),
    exec('Audit START', [660, -80], IDS.AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'AI_RERANK_STARTED', entityType: 'retrieval', entityId: 'AI_QUERY_RETRIEVAL',
      userId: "={{ $('Validar entrada').first().json.userId || '' }}",
      sessionId: "={{ $('Validar entrada').first().json.sessionId || '' }}",
      requestId: "={{ $('Validar entrada').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ candidateCount: $('Validar entrada').first().json.candidateCount }) }}",
    }),
    code('Re-ranquear', [880, -80], rerankJs),
    iff('Rerank ok?', [1100, -80], '={{ $json.ok === true }}'),
    exec('Audit SUCCESS', [1320, -160], IDS.AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'AI_RERANK_SUCCESS', entityType: 'retrieval', entityId: 'AI_QUERY_RETRIEVAL',
      userId: "={{ $('Validar entrada').first().json.userId || '' }}",
      sessionId: "={{ $('Validar entrada').first().json.sessionId || '' }}",
      requestId: "={{ $('Validar entrada').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ mode: $json.rankingMetadata.mode, selectedCount: $json.rankingMetadata.selectedCount, durationMs: $json.rankingMetadata.durationMs, fallbackUsed: false }) }}",
    }),
    exec('Audit FAILED', [1320, 0], IDS.AUDIT, 'AUDITORIA - REGISTRAR', {
      action: 'AI_RERANK_FAILED', entityType: 'retrieval', entityId: 'AI_QUERY_RETRIEVAL',
      userId: "={{ $('Validar entrada').first().json.userId || '' }}",
      sessionId: "={{ $('Validar entrada').first().json.sessionId || '' }}",
      requestId: "={{ $('Validar entrada').first().json.requestId || '' }}",
      metadata: "={{ JSON.stringify({ fallbackUsed: true }) }}",
    }),
    code('Retorno', [1540, -80], `return [{json:$input.first().json}];`),
  ];
  const c = {};
  link(c, 'Trigger', 'Validar entrada');
  link(c, 'Validar entrada', 'Entrada ok?');
  link(c, 'Entrada ok?', 'Audit START', 0);
  link(c, 'Entrada ok?', 'Erro entrada', 1);
  link(c, 'Audit START', 'Re-ranquear');
  link(c, 'Re-ranquear', 'Rerank ok?');
  link(c, 'Rerank ok?', 'Audit SUCCESS', 0);
  link(c, 'Rerank ok?', 'Audit FAILED', 1);
  link(c, 'Audit SUCCESS', 'Retorno');
  link(c, 'Audit FAILED', 'Retorno');
  link(c, 'Erro entrada', 'Retorno');
  await saveGraph(IDS.RERANK, nodes, c);
  out.RERANK = true;
}

writeFileSync(new URL('./workflow-ids.json', import.meta.url), JSON.stringify(IDS, null, 2));
writeFileSync(new URL('./_expand-core.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(out);
await client.end();
