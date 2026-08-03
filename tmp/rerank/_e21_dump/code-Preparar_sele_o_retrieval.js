const cfgNode=$('Carregar retrieval config').first().json||{};
const cfg=cfgNode.configuration||{};
const mode=String(cfgNode.mode||cfg.mode||'HYBRID').toUpperCase();
const finalLimit=Math.min(Math.max(Number(cfg.finalLimit||12)||12,1),20);
const candidates=$('Merge híbrido').all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));
const classification=$('Classificar pergunta').first().json||{};
const question=String(classification.question||'');
const useRerank=mode==='HYBRID_RERANK';
return [{json:{
  mode, useRerank, finalLimit,
  versionLabel: cfgNode.versionLabel||'hybrid-v1',
  configurationJson: JSON.stringify({...cfg, mode, versionLabel: cfgNode.versionLabel||null}),
  classificationJson: JSON.stringify({
    categoryId: classification.categoryId||null,
    subcategoryId: classification.subcategoryId||null,
    categoryName: classification.categoryName||null,
    subcategoryName: classification.subcategoryName||null,
    searchTerms: classification.searchTerms||[],
  }),
  candidatesJson: JSON.stringify(candidates),
  candidates,
  question,
  requestId: $('Normalizar request').first().json.requestId||'',
  userId: $('Validar auth').first().json.userId||'',
  sessionId: $('Validar auth').first().json.sessionId||'',
}}];