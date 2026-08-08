/**
 * Etapa 28.2 — patch core retrieval:
 * 1) remove expired exclusion (policy B)
 * 2) hydrate vector-only hits when merge.includeVectorOnly
 * 3) lexical expansion complementary in Preparar busca texto
 * 4) expired penalty in merge
 */
import { writeFileSync, readFileSync } from 'fs';

const dump = JSON.parse(
  readFileSync(
    'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/15fd851e-555a-4437-97b1-0ad91a04425e.txt',
    'utf8',
  ),
);
let nodes = dump.workflow.nodes;
let connections = structuredClone(dump.workflow.connections);

const byName = Object.fromEntries(nodes.map((n) => [n.name, n]));

// --- 1) Remove expiration filter from SQL; keep is_active ---
const sqlNode = byName['Buscar chunks relevantes'];
let q = sqlNode.parameters.query;
const before = q;
q = q.replace(
  /\n\s*AND \(\s*\n\s*COALESCE\(dv\.expiration_date, d\.expiration_date\) IS NULL\s*\n\s*OR COALESCE\(dv\.expiration_date, d\.expiration_date\) >= CURRENT_DATE\s*\n\s*\)/m,
  '',
);
if (q === before) {
  // try compacted form
  q = q.replace(
    /AND \(\s*COALESCE\(dv\.expiration_date, d\.expiration_date\) IS NULL\s*OR COALESCE\(dv\.expiration_date, d\.expiration_date\) >= CURRENT_DATE\s*\)\s*/m,
    '',
  );
}
if (q === before) {
  console.error('FAILED to strip expiration filter');
  console.log(q.slice(q.indexOf('WHERE'), q.indexOf('WHERE') + 500));
  process.exit(1);
}
sqlNode.parameters.query = q;
console.log('SQL: expiration filter removed, is_active kept');

// --- 2) Preparar busca texto: lexical expansion ---
byName['Preparar busca texto'].parameters.jsCode = `const base=$input.first().json||{};
const cfg=base.configuration||{};
const lex=cfg.lexicalExpansion||{};
const maxSyn=Math.min(Math.max(Number(lex.maxSynonymsPerTerm||4)||4,1),5);
const dict=lex.dictionary&&typeof lex.dictionary==='object'?lex.dictionary:{};
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').trim();}
function isIdentifier(t){return /^(cpf|cnpj|crm|coren)$/i.test(t)||/^[\\d.\\-/]+$/.test(t)||/^[A-Z0-9]{4,}$/.test(t);}
const original=Array.isArray(base.searchTerms)?base.searchTerms.map(String).filter(Boolean):[];
let expanded=[...original];
if(lex.enabled===true){
  const seen=new Set(original.map(norm));
  for(const term of original){
    if(isIdentifier(term)) continue;
    const syns=dict[norm(term)]||dict[term]||dict[String(term).toLowerCase()]||[];
    let added=0;
    for(const s of syns){
      if(added>=maxSyn) break;
      const n=norm(s);
      if(!n||seen.has(n)||isIdentifier(s)) continue;
      seen.add(n); expanded.push(String(s)); added++;
    }
  }
}
expanded=expanded.slice(0,12);
return [{json:{...base,textStartedAtMs:Date.now(),question:base.question,categoryId:base.categoryId||'',subcategoryId:base.subcategoryId||'',categoryName:base.categoryName||'',subcategoryName:base.subcategoryName||'',searchTerms:expanded,searchTermsOriginal:original,lexicalExpansionUsed:expanded.length>original.length}}];`;
console.log('Preparar busca texto: lexical expansion wired');

// Extend term0..term7 to term0..term11 in SQL if only 8 - keep 8 for safety of SQL size; expansion fills first 8
// Better: extend to 12 terms in SQL
{
  let sq = sqlNode.parameters.query;
  if (!sq.includes('term8')) {
    sq = sq.replace(
      `'{{ ($json.searchTerms[7] || "").replace(/'/g, "''") }}'::text AS term7`,
      `'{{ ($json.searchTerms[7] || "").replace(/'/g, "''") }}'::text AS term7,
    '{{ ($json.searchTerms[8] || "").replace(/'/g, "''") }}'::text AS term8,
    '{{ ($json.searchTerms[9] || "").replace(/'/g, "''") }}'::text AS term9,
    '{{ ($json.searchTerms[10] || "").replace(/'/g, "''") }}'::text AS term10,
    '{{ ($json.searchTerms[11] || "").replace(/'/g, "''") }}'::text AS term11`,
    );
    // Add scoring for term8-11 — find term7 scoring pattern
    const term7Score = `CASE WHEN (SELECT term7 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term7 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term7 FROM params) || '%' OR COALESCE(d.semantic_description,'') ILIKE '%' || (SELECT term7 FROM params) || '%') THEN 15 ELSE 0 END`;
    if (sq.includes(term7Score)) {
      sq = sq.replace(
        term7Score,
        term7Score +
          `
      + CASE WHEN (SELECT term8 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term8 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term8 FROM params) || '%') THEN 10 ELSE 0 END
      + CASE WHEN (SELECT term9 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term9 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term9 FROM params) || '%') THEN 10 ELSE 0 END
      + CASE WHEN (SELECT term10 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term10 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term10 FROM params) || '%') THEN 10 ELSE 0 END
      + CASE WHEN (SELECT term11 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term11 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term11 FROM params) || '%') THEN 10 ELSE 0 END`,
      );
    } else {
      console.warn('term7 score pattern not exact; terms 8-11 params added but scoring may be partial');
    }
    sqlNode.parameters.query = sq;
    console.log('SQL: term8-11 added');
  }
}

// --- 3) New nodes: Preparar hidratação + SQL + Aplicar hidratação ---
const prepHydrate = {
  id: 'c282prepHydrate01',
  name: 'Preparar hidratação vetorial',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1400, 200],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const base=$input.first().json||{};
const cfg=base.configuration||{};
const include=cfg.merge?.includeVectorOnly===true||cfg.semanticOrphans?.enabled===true;
const textKeys=new Set((Array.isArray(base.textRows)?base.textRows:[]).map(r=>String(r.documentId)+':'+String(r.chunkOrder)));
const orphans=(Array.isArray(base.vectorHits)?base.vectorHits:[])
  .filter(h=>h&&h.chunkId&&!textKeys.has(String(h.documentId)+':'+String(h.chunkIndex)));
function esc(s){return String(s??'').replace(/'/g,\"''\");}
let hydrateSql=\"SELECT NULL::uuid AS \\\"chunkId\\\" WHERE FALSE\";
if(include&&orphans.length){
  const ids=[...new Set(orphans.map(h=>String(h.chunkId)))].slice(0,40);
  hydrateSql=\`SELECT dc.id AS \"chunkId\", dc.document_id AS \"documentId\", COALESCE(dv.title_snapshot,d.title) AS \"documentTitle\",
  d.sector_id AS \"sectorId\", s.name AS \"sectorName\", d.category_id AS \"categoryId\", c.name AS \"categoryName\",
  c.description AS \"categoryDescription\", d.subcategory_id AS \"subcategoryId\", sc.name AS \"subcategoryName\",
  sc.description AS \"subcategoryDescription\", COALESCE(dv.expiration_date,d.expiration_date) AS \"vigencyDate\",
  d.updated_at AS \"documentUpdatedAt\", dv.version_number AS \"versionNumber\", dv.id AS \"versionId\",
  dc.chunk_order AS \"chunkOrder\", dc.chunk_text AS \"chunkText\", dc.chunk_kind AS \"chunkKind\", dc.sheet_name AS \"sheetName\",
  COALESCE(d.is_active,TRUE) AS \"isActive\",
  (COALESCE(dv.expiration_date,d.expiration_date) IS NOT NULL AND COALESCE(dv.expiration_date,d.expiration_date) < CURRENT_DATE) AS \"isExpired\"
FROM document_chunks dc
JOIN documents d ON d.id=dc.document_id
JOIN document_versions dv ON dv.id=dc.document_version_id
LEFT JOIN sectors s ON s.id=d.sector_id
LEFT JOIN categories c ON c.id=d.category_id
LEFT JOIN subcategories sc ON sc.id=d.subcategory_id
WHERE d.deleted_at IS NULL AND COALESCE(d.is_active,TRUE)=TRUE
  AND dc.id IN (\${ids.map(i=>\"'\"+esc(i)+\"'::uuid\").join(',')})\`;
}
return [{json:{...base,hydrateEnabled:include,hydrateNeeded:include&&orphans.length>0,hydrateSql,orphanCount:orphans.length}}];`,
  },
};

const sqlHydrate = {
  id: 'c282sqlHydrate01',
  name: 'Hidratar chunks vetoriais',
  type: 'n8n-nodes-base.postgres',
  typeVersion: 2.6,
  position: [1620, 200],
  parameters: {
    operation: 'executeQuery',
    options: {},
    query: '={{ $json.hydrateSql }}',
  },
  credentials: sqlNode.credentials || {
    postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' },
  },
  alwaysOutputData: true,
};

const applyHydrate = {
  id: 'c282applyHydrate01',
  name: 'Aplicar hidratação vetorial',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [1840, 200],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const prep=$('Preparar hidratação vetorial').first().json||{};
const rows=$input.all().map(i=>i.json).filter(r=>r&&r.chunkId&&r.chunkText);
const byId=new Map(rows.map(r=>[String(r.chunkId),r]));
const vectorHits=(Array.isArray(prep.vectorHits)?prep.vectorHits:[]).map(h=>{
  const row=byId.get(String(h.chunkId));
  if(!row) return h;
  return {
    ...h,
    chunkText:row.chunkText,
    documentTitle:row.documentTitle||h.documentTitle,
    sectorId:row.sectorId||h.sectorId,
    sectorName:row.sectorName,
    categoryId:row.categoryId||h.categoryId,
    categoryName:row.categoryName,
    categoryDescription:row.categoryDescription,
    subcategoryId:row.subcategoryId||h.subcategoryId,
    subcategoryName:row.subcategoryName,
    subcategoryDescription:row.subcategoryDescription,
    vigencyDate:row.vigencyDate,
    documentUpdatedAt:row.documentUpdatedAt,
    versionNumber:row.versionNumber,
    versionId:row.versionId||h.documentVersionId,
    chunkKind:row.chunkKind||h.chunkKind,
    sheetName:row.sheetName||h.sheetName,
    isActive:row.isActive!==false,
    isExpired:row.isExpired===true,
  };
});
return [{json:{...prep,vectorHits,hydratedVectorChunks:rows.length,lexicalExpansionUsed:!!prep.lexicalExpansionUsed}}];`,
  },
};

// Remove old nodes if re-run
nodes = nodes.filter(
  (n) =>
    !['Preparar hidratação vetorial', 'Hidratar chunks vetoriais', 'Aplicar hidratação vetorial'].includes(
      n.name,
    ),
);
nodes.push(prepHydrate, sqlHydrate, applyHydrate);

// --- 4) Rewrite Merge híbrido ---
byName['Merge híbrido'].parameters.jsCode = `const modeInfo=$input.first().json||{};
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
return [{json:{...modeInfo, candidates, pipelineMeta, useRerank:String(modeInfo.mode).toUpperCase()==='HYBRID_RERANK', finalLimit:Number(modeInfo.finalLimit||12)||12}}];`;
console.log('Merge híbrido updated');

// Rewire connections
connections['Guardar rows texto'] = { main: [[{ node: 'Preparar hidratação vetorial', type: 'main', index: 0 }]] };
connections['Pular texto'] = { main: [[{ node: 'Preparar hidratação vetorial', type: 'main', index: 0 }]] };
connections['Preparar hidratação vetorial'] = { main: [[{ node: 'Hidratar chunks vetoriais', type: 'main', index: 0 }]] };
connections['Hidratar chunks vetoriais'] = { main: [[{ node: 'Aplicar hidratação vetorial', type: 'main', index: 0 }]] };
connections['Aplicar hidratação vetorial'] = { main: [[{ node: 'Merge híbrido', type: 'main', index: 0 }]] };

// Rebuild nodes array with updated byName refs
const nameOrder = nodes.map((n) => n.name);
const rebuilt = nameOrder.map((name) => byName[name] || nodes.find((n) => n.name === name)).filter(Boolean);
// ensure new nodes present
for (const n of [prepHydrate, sqlHydrate, applyHydrate]) {
  if (!rebuilt.find((x) => x.name === n.name)) rebuilt.push(n);
}

writeFileSync(
  'tmp/post-go-live/28-2-retrieval-patch.json',
  JSON.stringify({ nodes: rebuilt, connections }, null, 2),
);
console.log('Wrote patch json, nodes=', rebuilt.length);
console.log('Done preparing. Apply via n8n MCP update next.');
