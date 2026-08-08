const modeInfo=$input.first().json||{};
const t0=Date.now();
const vectorHits=Array.isArray(modeInfo.vectorHits)?modeInfo.vectorHits:[];
const textRows=Array.isArray(modeInfo.textRows)?modeInfo.textRows:[];
const cfg=modeInfo.configuration||{};
const includeVectorOnly=cfg.merge?.includeVectorOnly===true||cfg.semanticOrphans?.enabled===true;
const expiredPenalty=Number(cfg.penalties?.expired ?? 0.12);
const wV=Number(modeInfo.weights?.semantic??0.65);
const wT=Number(modeInfo.weights?.lexical??0.35);
const maxText=Math.max(1,...textRows.map(r=>Number(r.relevance||0)));
const byKey=new Map();
function keyOf(docId,order){return String(docId)+':'+String(order);}
function isExpiredDate(v){
  if(v===true) return true;
  if(!v) return false;
  const d=new Date(v); if(Number.isNaN(d.getTime())) return false;
  const today=new Date(); today.setHours(0,0,0,0);
  return d < today;
}
for(const h of vectorHits){
  const k=keyOf(h.documentId,h.chunkIndex);
  byKey.set(k,{chunkId:h.chunkId||null,documentId:h.documentId,documentTitle:h.documentTitle,sectorId:h.sectorId,sectorName:h.sectorName,categoryId:h.categoryId,categoryName:h.categoryName,categoryDescription:h.categoryDescription,subcategoryId:h.subcategoryId,subcategoryName:h.subcategoryName,subcategoryDescription:h.subcategoryDescription,chunkIndex:h.chunkIndex,chunkKind:h.chunkKind,sheetName:h.sheetName,ocrQuality:h.ocrQuality,vectorScore:Number(h.vectorScore||0),textScore:0,chunkText:h.chunkText||null,versionId:h.versionId||h.documentVersionId,versionNumber:h.versionNumber,vigencyDate:h.vigencyDate,documentUpdatedAt:h.documentUpdatedAt,isCurrent:h.isCurrent!==false,isExpired:h.isExpired===true||isExpiredDate(h.vigencyDate)});
}
for(const r of textRows){
  const k=keyOf(r.documentId,r.chunkOrder);
  const textScore=Number(r.relevance||0)/maxText;
  const row=byKey.get(k)||{chunkId:r.chunkId||null,documentId:r.documentId,documentTitle:r.documentTitle,sectorId:r.sectorId,categoryId:r.categoryId,subcategoryId:r.subcategoryId,chunkIndex:r.chunkOrder,chunkKind:r.chunkKind,sheetName:r.sheetName,ocrQuality:null,vectorScore:0,textScore:0,chunkText:null,versionId:r.versionId,isCurrent:true,isExpired:false};
  row.textScore=Math.max(row.textScore||0,textScore);
  row.chunkText=r.chunkText||row.chunkText;
  row.chunkId=row.chunkId||r.chunkId||null;
  row.documentTitle=r.documentTitle||row.documentTitle;
  row.sectorName=r.sectorName; row.categoryName=r.categoryName; row.subcategoryName=r.subcategoryName;
  row.categoryDescription=r.categoryDescription; row.subcategoryDescription=r.subcategoryDescription;
  row.vigencyDate=r.vigencyDate; row.documentUpdatedAt=r.documentUpdatedAt; row.versionNumber=r.versionNumber; row.versionId=r.versionId||row.versionId;
  row.isExpired=row.isExpired||isExpiredDate(r.vigencyDate);
  byKey.set(k,row);
}
const catId=modeInfo.categoryId||null, subId=modeInfo.subcategoryId||null;
const merged=[];
let droppedNoText=0;
for(const row of byKey.values()){
  if(!row.chunkText){ droppedNoText++; continue; }
  let boost=0;
  if(subId&&row.subcategoryId===subId) boost+=0.15; else if(catId&&row.categoryId===catId) boost+=0.10;
  const ocr=String(row.ocrQuality||'').toUpperCase();
  if(ocr==='EXCELLENT'||ocr==='GOOD') boost+=0.05;
  if(String(row.chunkKind||'').toLowerCase()==='tabular') boost+=0.05;
  if(row.isCurrent!==false) boost+=0.05;
  if(row.isExpired) boost-=Math.abs(expiredPenalty);
  const vectorNorm=Math.max(0,Math.min(1,Number(row.vectorScore||0)));
  const textNorm=Math.max(0,Math.min(1,Number(row.textScore||0)));
  // When includeVectorOnly, pure vector hits keep semantic weight even with textScore 0
  const mergedScore=wV*vectorNorm+wT*textNorm+boost;
  merged.push({chunkId:row.chunkId,documentId:row.documentId,documentTitle:row.documentTitle,sectorId:row.sectorId,sectorName:row.sectorName,categoryId:row.categoryId,categoryName:row.categoryName,categoryDescription:row.categoryDescription,subcategoryId:row.subcategoryId,subcategoryName:row.subcategoryName,subcategoryDescription:row.subcategoryDescription,vigencyDate:row.vigencyDate,documentUpdatedAt:row.documentUpdatedAt,versionNumber:row.versionNumber,versionId:row.versionId,chunkOrder:row.chunkIndex,chunkText:row.chunkText,chunkKind:row.chunkKind,sheetName:row.sheetName,relevance:Math.round(mergedScore*1000),vectorScore:vectorNorm,textScore:textNorm,mergedScore,hybridScore:mergedScore,isExpired:!!row.isExpired,retrievalMode:vectorHits.length?'hybrid':(textRows.length?'text_only':'empty')});
}
merged.sort((a,b)=>b.mergedScore-a.mergedScore);
const candidatePool=Number(modeInfo.candidateLimit||30);
const candidates=merged.slice(0,candidatePool);
const mergeLatencyMs=Date.now()-t0;
const fallbackUsed=modeInfo.needVector&&!vectorHits.length&&textRows.length>0;
const pipelineMeta={
  mode:modeInfo.mode, configCode:modeInfo.configCode||'AI_QUERY_RETRIEVAL',
  configVersionId:modeInfo.versionId||null, configVersion:modeInfo.versionLabel||null,
  rankingVersion:modeInfo.versionLabel||null, candidateCount:candidates.length, deduplicatedCount:byKey.size,
  vectorLatencyMs:Number(modeInfo.vectorLatencyMs||0), textLatencyMs:Number(modeInfo.textLatencyMs||0), mergeLatencyMs,
  fallbackUsed, fallbackReason:fallbackUsed?'vector_empty_text_fallback':null,
  modeOverrideUsed:!!modeInfo.modeOverrideUsed, requestId:modeInfo.requestId||null,
  includeVectorOnly, hydratedVectorChunks:Number(modeInfo.hydratedVectorChunks||0),
  droppedNoText, lexicalExpansionUsed:!!modeInfo.lexicalExpansionUsed,
  expiredCandidateCount:candidates.filter(c=>c.isExpired).length,
};
return [{json:{...modeInfo, candidates, pipelineMeta, useRerank:String(modeInfo.mode).toUpperCase()==='HYBRID_RERANK', finalLimit:Number(modeInfo.finalLimit||12)||12}}];