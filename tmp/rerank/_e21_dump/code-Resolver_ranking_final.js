const prep=$('Preparar seleção retrieval').first().json||{};
const mode=String(prep.mode||'HYBRID').toUpperCase();
const finalLimit=Number(prep.finalLimit||12)||12;
const hybridCandidates=Array.isArray(prep.candidates)?prep.candidates:[];
let ranked=[];
let fallbackUsed=false;
let rankingMetadata={mode, fallbackUsed:false, selectedCount:0, durationMs:0};
if(mode==='HYBRID_RERANK'){
  const rr=$input.first().json||{};
  if(rr.ok===true && Array.isArray(rr.rankedCandidates) && rr.rankedCandidates.length){
    ranked=rr.rankedCandidates;
    rankingMetadata=rr.rankingMetadata||rankingMetadata;
  } else {
    fallbackUsed=true;
    rankingMetadata={mode:'HYBRID_FALLBACK', fallbackUsed:true, selectedCount:0, durationMs:0, error:rr.error||'rerank_failed'};
    ranked=hybridCandidates.slice(0, finalLimit).map((c,i)=>({...c, rerankPosition:i+1, rerankScore:c.mergedScore||0, selectionReason:'hybrid_fallback', retrievalMode:'hybrid_fallback'}));
    try {
      // audit fallback is best-effort via metadata on response; dedicated audit optional
    } catch(_){}
  }
} else {
  ranked=hybridCandidates.slice(0, finalLimit).map((c,i)=>({...c, rerankPosition:i+1, rerankScore:c.mergedScore||0, selectionReason:'hybrid', retrievalMode:c.retrievalMode||'hybrid'}));
  rankingMetadata={mode, fallbackUsed:false, selectedCount:ranked.length, durationMs:0, versionLabel:prep.versionLabel||null};
}
rankingMetadata.fallbackUsed=fallbackUsed||!!rankingMetadata.fallbackUsed;
rankingMetadata.selectedCount=ranked.length;
rankingMetadata.versionLabel=prep.versionLabel||rankingMetadata.versionLabel||null;
return ranked.map((r,i)=>({json:{...r, rankingMetadata, retrievalConfigVersion:prep.versionLabel||null, fallbackUsed:rankingMetadata.fallbackUsed}}));