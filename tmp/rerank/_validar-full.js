const t=$input.first().json||{};
function parseJson(v,fb){if(v==null||v==='')return fb; if(typeof v==='object')return v; try{return JSON.parse(String(v));}catch(_){return fb;}}
const body=parseJson(t.configurationJson, t.configuration||{});
const modeRaw=String(t.mode||body.mode||'').trim().toUpperCase();
const versionLabel=t.versionLabel!=null?String(t.versionLabel): (body.versionLabel!=null?String(body.versionLabel):null);
const errors=[]; const warnings=[];
function err(field,message,code){errors.push({field,message,code:code||'INVALID'});}
const MODES=['TEXT_ONLY','VECTOR_ONLY','HYBRID','HYBRID_RERANK'];
if(!MODES.includes(modeRaw)) err('mode','mode deve ser TEXT_ONLY|VECTOR_ONLY|HYBRID|HYBRID_RERANK','INVALID_MODE');
if(body==null || typeof body!=='object' || Array.isArray(body)) err('configuration','configuration deve ser objeto JSON','INVALID_CONFIG');
const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes']);
const FORBIDDEN=new Set(['id','publishedAt','validationScore','validationRunId','contentHash','createdBy','sql','workflowId','secrets','expression','code','eval']);
if(body && typeof body==='object'){
  for(const k of Object.keys(body)){
    if(FORBIDDEN.has(k) || /sql|secret|workflow|eval|function/i.test(k)) err(k,'campo proibido','FORBIDDEN_FIELD');
    else if(!ALLOWED_ROOT.has(k)) err(k,'campo desconhecido','UNKNOWN_FIELD');
  }
}
function num(v,field){
  if(v===undefined||v===null||v==='') return null;
  if(typeof v==='string' && v.trim()!=='' && !/^-?\d+(\.\d+)?$/.test(v.trim())){ err(field,'deve ser número','TYPE'); return NaN; }
  const n=Number(v);
  if(!Number.isFinite(n)) { err(field,'número inválido (NaN/Infinity)','TYPE'); return NaN; }
  return n;
}
function int(v,field){
  const n=num(v,field); if(n==null||Number.isNaN(n)) return null;
  if(!Number.isInteger(n)) err(field,'deve ser inteiro','TYPE');
  return n;
}
function bool(v,field){
  if(v===undefined||v===null||v==='') return false;
  if(typeof v==='boolean') return v;
  err(field,'deve ser boolean real (não string)','TYPE');
  return false;
}
const candidateLimit=int(body.candidateLimit,'candidateLimit');
const finalLimit=int(body.finalLimit,'finalLimit');
const maxChunks=int(body.maxChunksPerDocument,'maxChunksPerDocument');
if(candidateLimit!=null){ if(candidateLimit<1||candidateLimit>50) err('candidateLimit','faixa 1..50','RANGE'); }
else err('candidateLimit','obrigatório','REQUIRED');
if(finalLimit!=null){ if(finalLimit<1||finalLimit>20) err('finalLimit','faixa 1..20','RANGE'); }
else err('finalLimit','obrigatório','REQUIRED');
if(candidateLimit!=null && finalLimit!=null && finalLimit>candidateLimit) err('finalLimit','finalLimit não pode ser maior que candidateLimit','COHERENCE');
if(maxChunks!=null){
  if(maxChunks<1||maxChunks>8) err('maxChunksPerDocument','faixa 1..8','RANGE');
  if(finalLimit!=null && maxChunks>finalLimit) err('maxChunksPerDocument','não pode ser maior que finalLimit','COHERENCE');
} else err('maxChunksPerDocument','obrigatório','REQUIRED');
const enableNeighbors=bool(body.enableNeighbors,'enableNeighbors');
const weights=body.weights&&typeof body.weights==='object'?body.weights:{};
const ALLOWED_W=new Set(['semantic','lexical','hybridPrior']);
for(const k of Object.keys(weights||{})){ if(!ALLOWED_W.has(k)) err('weights.'+k,'peso desconhecido','UNKNOWN_FIELD'); }
const semantic=num(weights.semantic,'weights.semantic');
const lexical=num(weights.lexical,'weights.lexical');
const hybridPrior=num(weights.hybridPrior??0,'weights.hybridPrior');
for(const [f,v] of [['weights.semantic',semantic],['weights.lexical',lexical],['weights.hybridPrior',hybridPrior]]){
  if(v!=null && !Number.isNaN(v) && (v<0 || v>1)) err(f,'peso deve estar em 0..1','RANGE');
}
if([semantic,lexical,hybridPrior].every(v=>v==null||Number.isNaN(v))) err('weights','ao menos um peso é obrigatório','REQUIRED');
const wsum=(Number.isFinite(semantic)?semantic:0)+(Number.isFinite(lexical)?lexical:0)+(Number.isFinite(hybridPrior)?hybridPrior:0);
if(wsum<=0 || wsum>1.5) err('weights','soma dos pesos deve estar em (0, 1.5]','COHERENCE');
const ALLOWED_BOOST=new Set(['subcategoryMatch','categoryMatch','titleMatch','exactIdentifier','tabularStructure','ocrGood','isCurrent','recentVigency','exactPhrase']);
const ALLOWED_PEN=new Set(['redundancyPerExtraChunk','staleDocument','lowUsefulLength']);
const boosts=body.boosts&&typeof body.boosts==='object'?body.boosts:{};
const penalties=body.penalties&&typeof body.penalties==='object'?body.penalties:{};
for(const k of Object.keys(boosts)){ if(!ALLOWED_BOOST.has(k)) err('boosts.'+k,'boost desconhecido','UNKNOWN_FIELD'); const v=num(boosts[k],'boosts.'+k); if(v!=null&&!Number.isNaN(v)&&(v<0||v>1)) err('boosts.'+k,'faixa 0..1','RANGE'); }
for(const k of Object.keys(penalties)){ if(!ALLOWED_PEN.has(k)) err('penalties.'+k,'penalty desconhecida','UNKNOWN_FIELD'); const v=num(penalties[k],'penalties.'+k); if(v!=null&&!Number.isNaN(v)&&(v<0||v>1)) err('penalties.'+k,'faixa 0..1','RANGE'); }
if(versionLabel!=null){
  const vl=versionLabel.trim();
  if(!/^[a-z0-9][a-z0-9._-]{1,63}$/i.test(vl)) err('versionLabel','formato inválido (2-64 chars: letras, números, ._- )','FORMAT');
}
if(Object.keys(body).length===0) err('configuration','configuration vazia','EMPTY');
const normalized={
  mode: modeRaw||'HYBRID',
  candidateLimit: candidateLimit??30,
  finalLimit: finalLimit??12,
  maxChunksPerDocument: maxChunks??2,
  enableNeighbors: !!enableNeighbors,
  weights:{
    semantic: Number.isFinite(semantic)?semantic:0.65,
    lexical: Number.isFinite(lexical)?lexical:0.35,
    hybridPrior: Number.isFinite(hybridPrior)?hybridPrior:0,
  },
  boosts: Object.fromEntries(Object.entries(boosts).map(([k,v])=>[k,Number(v)])),
  penalties: Object.fromEntries(Object.entries(penalties).map(([k,v])=>[k,Number(v)])),
  normalization: (body.normalization&&typeof body.normalization==='object')?body.normalization:{vector:'clip01',text:'batchMax',hybrid:'passthrough'},
  notes: typeof body.notes==='string'?body.notes.slice(0,500):'',
};
const crypto=require('crypto');
const contentHash=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
const ok=errors.length===0;
return [{json:{ok, errors, warnings, normalized, contentHash, mode:normalized.mode, versionLabel: versionLabel?versionLabel.trim():null, configurationJson: JSON.stringify(normalized), fields: errors}}];