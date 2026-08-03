const t=$input.first().json||{};
let classification={}; try{classification=typeof t.classificationJson==='string'?JSON.parse(t.classificationJson||'{}'):(t.classification||{});}catch(_){classification={};}
let selectedChunks=[]; try{selectedChunks=typeof t.selectedChunksJson==='string'?JSON.parse(t.selectedChunksJson||'[]'):(t.selectedChunks||[]);}catch(_){selectedChunks=[];}
let retrievalMeta={}; try{retrievalMeta=typeof t.retrievalMetaJson==='string'?JSON.parse(t.retrievalMetaJson||'{}'):(t.retrievalMeta||{});}catch(_){retrievalMeta={};}
let promptConfiguration={}; try{promptConfiguration=typeof t.promptConfigurationJson==='string'?JSON.parse(t.promptConfigurationJson||'{}'):(t.promptConfiguration||{});}catch(_){promptConfiguration={};}
let sources=[]; try{sources=typeof t.sourcesJson==='string'?JSON.parse(t.sourcesJson||'[]'):(t.sources||[]);}catch(_){sources=[];}
return [{ json: { forceContextFailureForTest: !!(t.forceContextFailureForTest===true||t.forceContextFailureForTest==='true'), 
  question:String(t.question||'').trim(),
  classification,
  selectedChunks,
  selectedChunksJson:JSON.stringify(selectedChunks),
  retrievalMeta,
  retrievalMetaJson:JSON.stringify(retrievalMeta),
  promptConfiguration,
  promptConfigurationJson:JSON.stringify(promptConfiguration),
  legacyContext:String(t.legacyContext||t.context||''),
  sources,
  sourcesJson:JSON.stringify(sources),
  contextConfigVersionId:String(t.contextConfigVersionId||'').trim(),
  contextConfigOverrideAllowed:String(t.contextConfigOverrideAllowed||'false'),
  requestId:t.requestId||'',
  userId:t.userId||'',
  sessionId:t.sessionId||'',
  startedAtMs:Date.now(),
}}];