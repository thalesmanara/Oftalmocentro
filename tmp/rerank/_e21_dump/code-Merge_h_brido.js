const cls=$('Extrair vetor pergunta').first().json||{};
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
const candidatePool=30;
const top=merged.slice(0,candidatePool);
if(!top.length) return textRows.slice(0,12).map(r=>({json:{...r,retrievalMode:'text_fallback'}}));
return top.map((r,i)=>({json:{...r, hybridRank:i+1, candidatePool}}));