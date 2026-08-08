import { writeFileSync } from 'fs';

const current = `const t=$input.first().json||{};
function parseJson(v,fb){if(v==null||v==='')return fb; if(typeof v==='object')return v; try{return JSON.parse(String(v));}catch(_){return fb;}}
const body=parseJson(t.configurationJson, t.configuration||{});
const modeRaw=String(t.mode||body.mode||'').trim().toUpperCase();
const versionLabelRaw=t.versionLabel!=null?String(t.versionLabel): (body.versionLabel!=null?String(body.versionLabel):null);
const versionLabel=(versionLabelRaw==null||!String(versionLabelRaw).trim())?null:String(versionLabelRaw).trim();
const errors=[]; const warnings=[];
function err(field,message,code){errors.push({field,message,code:code||'INVALID'});}
const MODES=['TEXT_ONLY','VECTOR_ONLY','HYBRID','HYBRID_RERANK'];
if(!MODES.includes(modeRaw)) err('mode','mode deve ser TEXT_ONLY|VECTOR_ONLY|HYBRID|HYBRID_RERANK','INVALID_MODE');
if(body==null || typeof body!=='object' || Array.isArray(body)) err('configuration','configuration deve ser objeto JSON','INVALID_CONFIG');
const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes','lexicalExpansion']);
const FORBIDDEN=new Set(['id','publishedAt','validationScore','validationRunId','contentHash','createdBy','sql','workflowId','secrets','expression','code','eval']);
if(body && typeof body==='object'){
  for(const k of Object.keys(body)){
    if(FORBIDDEN.has(k) || /sql|secret|workflow|eval|function/i.test(k)) err(k,'campo proibido','FORBIDDEN_FIELD');
    else if(!ALLOWED_ROOT.has(k)) err(k,'campo desconhecido','UNKNOWN_FIELD');
  }
}
function num(v,field){
  if(v===undefined||v===null||v==='') return null;
  if(typeof v==='string' && v.trim()!=='' && !/^-?\\d+(\\.\\d+)?$/.test(v.trim())){ err(field,'deve ser número','TYPE'); return NaN; }
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
let lexicalExpansion=null;
if(body.lexicalExpansion!==undefined && body.lexicalExpansion!==null && body.lexicalExpansion!==''){
  const lx=body.lexicalExpansion;
  if(typeof lx!=='object' || Array.isArray(lx)){ err('lexicalExpansion','deve ser objeto JSON','TYPE'); }
  else{
    const ALLOWED_LX=new Set(['enabled','maxSynonymsPerTerm','dictionary']);
    for(const k of Object.keys(lx)){ if(!ALLOWED_LX.has(k)) err('lexicalExpansion.'+k,'campo desconhecido','UNKNOWN_FIELD'); }
    const lxEnabled=bool(lx.enabled,'lexicalExpansion.enabled');
    let maxSyn=int(lx.maxSynonymsPerTerm,'lexicalExpansion.maxSynonymsPerTerm');
    if(maxSyn!=null && (maxSyn<1||maxSyn>10)) err('lexicalExpansion.maxSynonymsPerTerm','faixa 1..10','RANGE');
    if(maxSyn==null||Number.isNaN(maxSyn)) maxSyn=4;
    const dictRaw=lx.dictionary;
    const dict={};
    if(dictRaw!==undefined && dictRaw!==null){
      if(typeof dictRaw!=='object' || Array.isArray(dictRaw)) err('lexicalExpansion.dictionary','deve ser objeto termo->sinônimos','TYPE');
      else{
        const entries=Object.entries(dictRaw);
        if(entries.length>500) err('lexicalExpansion.dictionary','máximo 500 termos','RANGE');
        for(const [term,syns] of entries){
          const t=String(term).trim().toLowerCase();
          if(!t || t.length>64){ err('lexicalExpansion.dictionary.'+term,'termo inválido (1..64 chars)','FORMAT'); continue; }
          if(!Array.isArray(syns)){ err('lexicalExpansion.dictionary.'+term,'sinônimos devem ser array de strings','TYPE'); continue; }
          const list=[];
          for(const s of syns){
            if(typeof s!=='string' || !s.trim() || s.length>64){ err('lexicalExpansion.dictionary.'+term,'sinônimo inválido (string 1..64 chars)','FORMAT'); continue; }
            list.push(s.trim());
          }
          if(list.length>maxSyn) warnings.push({field:'lexicalExpansion.dictionary.'+t,message:'mais sinônimos que maxSynonymsPerTerm; excedentes serão ignorados na expansão',code:'TRUNCATED'});
          dict[t]=list;
        }
      }
    }
    if(lxEnabled && Object.keys(dict).length===0) err('lexicalExpansion.dictionary','obrigatório quando enabled=true','REQUIRED');
    lexicalExpansion={enabled:lxEnabled, maxSynonymsPerTerm:maxSyn, dictionary:dict};
  }
}
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
if(lexicalExpansion!==null) normalized.lexicalExpansion=lexicalExpansion;
const crypto=require('crypto');
const contentHash=crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
const ok=errors.length===0;
return [{json:{ok, errors, warnings, normalized, contentHash, mode:normalized.mode, versionLabel: versionLabel?versionLabel.trim():null, configurationJson: JSON.stringify(normalized), fields: errors}}];`;

let updated = current.replace(
  "const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes','lexicalExpansion']);",
  "const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes','lexicalExpansion','merge','semanticOrphans']);",
);

const mergeBlock = `let merge=null;
if(body.merge!==undefined && body.merge!==null && body.merge!==''){
  const mg=body.merge;
  if(typeof mg!=='object' || Array.isArray(mg)){ err('merge','deve ser objeto JSON','TYPE'); }
  else{
    const ALLOWED_MG=new Set(['includeVectorOnly','hydrateVectorChunks']);
    for(const k of Object.keys(mg)){ if(!ALLOWED_MG.has(k)) err('merge.'+k,'campo desconhecido','UNKNOWN_FIELD'); }
    const mgInclude=bool(mg.includeVectorOnly,'merge.includeVectorOnly');
    if(mg.hydrateVectorChunks!==undefined && mg.hydrateVectorChunks!==null && mg.hydrateVectorChunks!=='') bool(mg.hydrateVectorChunks,'merge.hydrateVectorChunks');
    merge={includeVectorOnly:!!mgInclude};
  }
}
let semanticOrphans=null;
if(body.semanticOrphans!==undefined && body.semanticOrphans!==null && body.semanticOrphans!==''){
  const so=body.semanticOrphans;
  if(typeof so!=='object' || Array.isArray(so)){ err('semanticOrphans','deve ser objeto JSON','TYPE'); }
  else{
    const ALLOWED_SO=new Set(['enabled']);
    for(const k of Object.keys(so)){ if(!ALLOWED_SO.has(k)) err('semanticOrphans.'+k,'campo desconhecido','UNKNOWN_FIELD'); }
    const soEnabled=bool(so.enabled,'semanticOrphans.enabled');
    semanticOrphans={enabled:!!soEnabled};
  }
}
`;

updated = updated.replace(
  'if(versionLabel!=null){',
  mergeBlock + 'if(versionLabel!=null){',
);

updated = updated.replace(
  'if(lexicalExpansion!==null) normalized.lexicalExpansion=lexicalExpansion;',
  'if(lexicalExpansion!==null) normalized.lexicalExpansion=lexicalExpansion;\nif(merge!==null) normalized.merge=merge;\nif(semanticOrphans!==null) normalized.semanticOrphans=semanticOrphans;',
);

const payload = {
  workflowId: 'NhWUkmzGhlttJC9S',
  operations: [
    {
      type: 'setNodeParameter',
      nodeName: 'Validar',
      path: '/jsCode',
      value: updated,
    },
  ],
};

writeFileSync('tmp/post-go-live/28-2-validator-update-payload.json', JSON.stringify(payload));
console.log('ALLOWED_ROOT includes merge:', updated.includes("'merge'"));
console.log('jsCode length:', updated.length);
