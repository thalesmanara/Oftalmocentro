const t0=Date.now();
function estTokens(text){
  const s=String(text||'');
  if(!s) return 0;
  // Estimativa conservadora (PT/UTF-8): ~3 chars/token + 8% margem embutida via ceil
  return Math.ceil(s.length / 3);
}
function normText(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
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
let __forceSrc = inp;
try { const pe = $('Preparar entrada').first().json || {}; if (pe && Object.keys(pe).length) __forceSrc = { ...inp, ...pe }; } catch(_) {}
const forceContextFailureForTest = __forceSrc.forceContextFailureForTest === true || __forceSrc.forceContextFailureForTest === 'true' || __forceSrc.labForceContextFailure === true || inp.labForceContextFailure === true;
if (forceContextFailureForTest) {
  const err = new Error('TEST_INJECTED_CONTEXT_FAILURE');
  err.code = 'TEST_INJECTED_CONTEXT_FAILURE';
  throw err;
}

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
      `[FONTE ${index} — TABELA]`,
      `Documento: ${c.documentTitle||'Não informado'}`,
      `Setor: ${c.sectorName||'Não informado'}`,
      `Categoria: ${c.categoryName||'Não informada'}`,
      `Subcategoria: ${c.subcategoryName||'Não informada'}`,
      `Vigência: ${c.vigencyDate||'Não informada'}`,
      `Aba: ${c.sheetName||'Não informada'}`,
      (c.rowStart!=null||c.rowEnd!=null) ? `Linhas: ${c.rowStart??'?'}–${c.rowEnd??'?'}` : null,
      'Dados:',
      c.text,
    ].filter(Boolean).join('\n');
  }
  return [
    `[FONTE ${index}]`,
    `Documento: ${c.documentTitle||'Não informado'}`,
    `Setor: ${c.sectorName||'Não informado'}`,
    `Categoria: ${c.categoryName||'Não informada'}`,
    `Subcategoria: ${c.subcategoryName||'Não informada'}`,
    `Vigência: ${c.vigencyDate||'Não informada'}`,
    'Conteúdo:',
    c.text,
  ].join('\n');
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

// Conflict detection — deterministic, not "multiple sources"
let conflictType='NO_CONFLICT';
let conflictDocumentIds=[];
let preferredDocumentId=null;
let conflictReasonCode=null;
function extractSignals(text){
  const t=String(text||'');
  const money=[...t.matchAll(/R\$\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2}|[0-9]+)/g)].map(m=>m[1]);
  const cpf=[...t.matchAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g)].map(m=>m[0].replace(/\D/g,''));
  const crm=[...t.matchAll(/\bCRM\s*[:#-]?\s*([0-9]{3,7})\b/gi)].map(m=>m[1]);
  const codes=[...t.matchAll(/\b([A-Z]{2,5}-?\d{2,6})\b/g)].map(m=>m[1]);
  const bools=[];
  if(/\b(sim|ativo|vigente|aprovado)\b/i.test(t)) bools.push('POS');
  if(/\b(não|nao|inativo|vencido|reprovado|suspenso)\b/i.test(t)) bools.push('NEG');
  return {money,cpf,crm,codes,bools};
}
if(enableConflict && included.length>=2){
  const byDoc=new Map();
  for(const c of included){
    const k=String(c.documentId);
    if(!byDoc.has(k)) byDoc.set(k,{id:k,title:c.documentTitle||'',vigency:c.vigencyDate||null,updated:c.documentUpdatedAt||null,text:c.text||'',relevance:c.relevance||0});
    else byDoc.get(k).text += '\n' + (c.text||'');
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
  // Confirmed money conflict only when SAME entity key (CPF/CRM/code) maps to DIFFERENT money values
  for (const entityMap of [keyMaps.cpf, keyMaps.crm, keyMaps.code]) {
    for (const [entity, docSet] of entityMap.entries()) {
      if (docSet.size < 2) continue;
      const moneys = new Set();
      for (const id of docSet) {
        const d = byDoc.get(id);
        if (!d) continue;
        for (const m of extractSignals(d.text).money) moneys.add(m);
      }
      if (moneys.size >= 2) {
        conflictType = 'CONFIRMED_CONFLICT';
        conflictReasonCode = 'DIVERGENT_MONETARY_VALUES';
        conflictDocumentIds = [...docSet];
        break;
      }
    }
    if (conflictType !== 'NO_CONFLICT') break;
  }
  // Potential: same strong title fingerprint + divergent vigency (ignore generic tokens)
  if (conflictType === 'NO_CONFLICT') {
    const stop = new Set(['certidao','certidão','regularidade','documento','arquivo','word','excel','coren','crm','anexo','oftalmo','oftalmocentro']);
    const vigDocs = docs.filter((d) => d.vigency);
    for (let i = 0; i < vigDocs.length; i++) {
      for (let j = i + 1; j < vigDocs.length; j++) {
        const a = vigDocs[i], b = vigDocs[j];
        if (String(a.vigency).slice(0, 10) === String(b.vigency).slice(0, 10)) continue;
        const ta = String(a.title || '').toLowerCase().split(/[^a-z0-9à-ü]+/).filter((x) => x.length > 4 && !stop.has(x));
        const tb = String(b.title || '').toLowerCase().split(/[^a-z0-9à-ü]+/).filter((x) => x.length > 4 && !stop.has(x));
        const shared = ta.filter((t) => tb.includes(t));
        if (shared.length >= 2) {
          conflictType = 'POTENTIAL_CONFLICT';
          conflictReasonCode = 'DIVERGENT_VIGENCY';
          conflictDocumentIds = [a.id, b.id];
        }
      }
    }
  }
  // Potential opposing status ONLY when same entity key appears in both POS and NEG docs
  if (conflictType === 'NO_CONFLICT') {
    const docSignals = docs.map((d) => ({ id: d.id, ...extractSignals(d.text) }));
    const pos = docSignals.filter((d) => d.bools.includes('POS'));
    const neg = docSignals.filter((d) => d.bools.includes('NEG'));
    if (pos.length && neg.length) {
      let hit = null;
      for (const p of pos) {
        for (const n of neg) {
          if (p.id === n.id) continue;
          const sharedEntity =
            p.cpf.some((x) => n.cpf.includes(x)) ||
            p.crm.some((x) => n.crm.includes(x)) ||
            p.codes.some((x) => n.codes.includes(x));
          if (sharedEntity) {
            hit = [p.id, n.id];
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        conflictType = 'POTENTIAL_CONFLICT';
        conflictReasonCode = 'OPPOSING_STATUS';
        conflictDocumentIds = hit;
      }
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
}

const insufficientContext=included.length===0;
let context='';
if(insufficientContext){
  context='[SEM EVIDÊNCIA DOCUMENTAL]\nNão há trechos documentais suficientes para responder com base na base disponível. Abstenha-se.';
} else {
  const blocks=included.map((c,i)=>formatBlock(c,i+1));
  if(conflictDetected){
    blocks.unshift('[AVISO INTERNO]\nConflito documental '+conflictType+' ('+(conflictReasonCode||'n/d')+'). Priorize o documento vigente mais recente e preserve evidências divergentes sem inventar reconciliação.');
  }
  context=blocks.join('\n\n------------------------------\n\n');
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
const includedChunkIds=included.map(c=>c.chunkId||`${c.documentId}:${c.chunkOrder}`).filter(Boolean);
const excludedChunkIds=excluded.map(c=>c.chunkId||`${c.documentId}:${c.chunkOrder}`).filter(Boolean);
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
  conflictType,
  conflictDocumentIds,
  preferredDocumentId,
  conflictReasonCode,
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
      fallbackReason:(String(err&&err.code||err&&err.message||'')==='TEST_INJECTED_CONTEXT_FAILURE'?'TEST_INJECTED_CONTEXT_FAILURE':'CONTEXT_BUILD_ERROR'),
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
}