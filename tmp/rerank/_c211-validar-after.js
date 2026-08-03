function buildConfigArtifacts(configuration){
  const cfg = configuration && typeof configuration === 'object' ? configuration : {};
  const configurationJson = JSON.stringify(cfg);
  let h = 0;
  for (let i = 0; i < configurationJson.length; i++) {
    h = ((h << 5) - h) + configurationJson.charCodeAt(i);
    h |= 0;
  }
  const contentHash = 'shaish-' + Math.abs(h).toString(16) + '-' + configurationJson.length;
  return { configuration: cfg, configurationJson, contentHash };
}
const t=$input.first().json||{};
const fields={};
function err(field,message){fields[field]=message;}
const allowedModes=new Set(['LEGACY','BUDGETED','BUDGETED_WITH_NEIGHBORS']);
const allowedModels=new Set(['gpt-4.1-mini','gpt-4.1','gpt-4o-mini','gpt-4o']);
const allowedKeys=new Set([
  'mode','modelName','contextLimitTokens','maxInputTokens','reservedResponseTokens','reservedSystemTokens',
  'safetyMarginTokens','maxChunks','maxChunksPerDocument','minChunkScore','enableNeighbors','maxNeighborsPerChunk',
  'enableRedundancyRemoval','redundancyThreshold','enableConflictPreservation','tokenizer','notes'
]);
const serverControlled=new Set([
  'id','status','publishedAt','publishedBy','validationRunId','validationScore','contentHash','createdBy',
  'createdAt','secrets','sql','workflowId','activeVersionId'
]);
const mode=String(t.mode||'').toUpperCase();
if(!allowedModes.has(mode)) err('mode','Modo inválido. Use LEGACY, BUDGETED ou BUDGETED_WITH_NEIGHBORS.');
let cfg={};
const rawCfg=t.configurationJson!=null?t.configurationJson:t.configuration;
if(rawCfg==null || rawCfg==='' || (typeof rawCfg==='object' && !Array.isArray(rawCfg) && Object.keys(rawCfg).length===0 && !t.mode)){
  // empty config only invalid if nothing useful provided; still require numeric essentials below via defaults check
}
try{
  if(typeof rawCfg==='string'){
    if(!String(rawCfg).trim()) err('configuration','JSON vazio.');
    else cfg=JSON.parse(rawCfg);
  } else if(rawCfg && typeof rawCfg==='object' && !Array.isArray(rawCfg)){
    cfg={...rawCfg};
  } else if(rawCfg!=null){
    err('configuration','JSON inválido.');
  }
}catch(_){ err('configuration','JSON inválido.'); }

if(cfg && typeof cfg==='object'){
  for(const k of Object.keys(cfg)){
    if(serverControlled.has(k)) err(k,'Campo controlado pelo servidor.');
    else if(!allowedKeys.has(k)) err(k,'Campo desconhecido.');
  }
}
function requireBool(field){
  if(cfg[field]===undefined) return;
  if(typeof cfg[field]!=='boolean') err(field,'Deve ser boolean real (não string).');
}
function requireNumber(field,{min=null,max=null,integer=false,allowZero=true}={}){
  if(cfg[field]===undefined) return null;
  if(typeof cfg[field]==='string') { err(field,'Deve ser número (não string).'); return null; }
  if(typeof cfg[field]!=='number' || Number.isNaN(cfg[field])) { err(field,'Deve ser número.'); return null; }
  if(integer && !Number.isInteger(cfg[field])) err(field,'Deve ser inteiro.');
  if(!allowZero && cfg[field]===0) err(field,'Deve ser positivo.');
  if(min!=null && cfg[field]<min) err(field,'Abaixo do mínimo permitido ('+min+').');
  if(max!=null && cfg[field]>max) err(field,'Acima do máximo permitido ('+max+').');
  return cfg[field];
}
requireBool('enableNeighbors');
requireBool('enableRedundancyRemoval');
requireBool('enableConflictPreservation');
const limit=requireNumber('contextLimitTokens',{min:1024,max:128000,integer:true,allowZero:false});
const reservedResp=requireNumber('reservedResponseTokens',{min:1,max:32000,integer:true,allowZero:false});
const reservedSys=requireNumber('reservedSystemTokens',{min:0,max:32000,integer:true,allowZero:true});
const safety=requireNumber('safetyMarginTokens',{min:0,max:8000,integer:true,allowZero:true});
const maxChunks=requireNumber('maxChunks',{min:1,max:50,integer:true,allowZero:false});
const maxPerDoc=requireNumber('maxChunksPerDocument',{min:1,max:50,integer:true,allowZero:false});
requireNumber('minChunkScore',{min:0,max:1});
requireNumber('redundancyThreshold',{min:0.5,max:1});
const maxNeighbors=requireNumber('maxNeighborsPerChunk',{min:0,max:5,integer:true,allowZero:true});
if(limit!=null && reservedResp!=null && reservedSys!=null && safety!=null){
  if(reservedResp+reservedSys+safety >= limit) err('reservedResponseTokens','Soma das reservas deve ser menor que contextLimitTokens.');
}
if(maxChunks!=null && maxPerDoc!=null && maxPerDoc>maxChunks) err('maxChunksPerDocument','Não pode ser maior que maxChunks.');
if(cfg.enableNeighbors===true && (maxNeighbors==null || maxNeighbors<1) && mode==='BUDGETED_WITH_NEIGHBORS'){
  err('maxNeighborsPerChunk','Obrigatório >=1 quando vizinhos estão ativos.');
}
if(cfg.enableNeighbors===true && mode==='LEGACY'){
  err('enableNeighbors','Vizinhos não são permitidos em LEGACY.');
}
const model=String(t.modelName||cfg.modelName||'').trim();
if(model && !allowedModels.has(model)) err('modelName','Modelo não permitido.');
const label=String(t.versionLabel||'').trim();
if(label.length>80) err('versionLabel','Rótulo muito longo.');
const ok=Object.keys(fields).length===0;
return [{json:{
  ok,
  valid:ok,
  errors: Object.entries(fields).map(([field,message])=>({field,message})),
  fields,
  code: ok? 'OK':'VALIDATION_ERROR',
  mode,
  configuration:cfg,
  modelName:model||null,
  versionLabel:label||null,
}}];