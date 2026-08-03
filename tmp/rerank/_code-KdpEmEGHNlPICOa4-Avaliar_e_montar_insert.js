function normalizeText(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function includesWord(haystack,word){const h=normalizeText(haystack);const w=normalizeText(word);if(!w)return true;return h.includes(w)}
function scoreCase(input){const{answer='',sources=[],classification={},durationMs=null,caseDef,refusalPhrase='Não encontrei essa informação na base documental disponível.',maxLatencyMs=30000,isInternalError=false}=input;const requiredWords=Array.isArray(caseDef.required_words||caseDef.requiredWords)?caseDef.required_words||caseDef.requiredWords:[];const forbiddenWords=Array.isArray(caseDef.forbidden_words||caseDef.forbiddenWords)?caseDef.forbidden_words||caseDef.forbiddenWords:[];const minScore=Number(caseDef.min_score??caseDef.minScore??70);const expectNoAnswer=!!(caseDef.expect_no_answer??caseDef.expectNoAnswer);const expectedDocId=caseDef.expected_document_id||caseDef.expectedDocumentId||null;const requiredSourceId=caseDef.required_source_document_id||caseDef.requiredSourceDocumentId||expectedDocId;const expectedCategory=caseDef.category_name||caseDef.categoryName||null;const expectedSubcategory=caseDef.subcategory_name||caseDef.subcategoryName||null;const isEmpty=!String(answer||'').trim();const refused=includesWord(answer,refusalPhrase)||normalizeText(answer)===normalizeText(refusalPhrase);let requiredHit=0;for(const w of requiredWords){if(includesWord(answer,w))requiredHit+=1}let forbiddenHit=0;for(const w of forbiddenWords){if(includesWord(answer,w))forbiddenHit+=1}const sourceIds=(sources||[]).map(s=>String(s.documentId||s.document_id||'')).filter(Boolean);const hasRequiredSource=requiredSourceId?sourceIds.includes(String(requiredSourceId)):sourceIds.length>0||expectNoAnswer;const hasExpectedDoc=expectedDocId?sourceIds.includes(String(expectedDocId)):true;const matchedCategory=expectedCategory?normalizeText(classification.categoryName||classification.category_name)===normalizeText(expectedCategory):null;const matchedSubcategory=expectedSubcategory?normalizeText(classification.subcategoryName||classification.subcategory_name)===normalizeText(expectedSubcategory):null;let answerQuality=0;if(expectNoAnswer){answerQuality=refused?40:isEmpty?20:0}else if(requiredWords.length){answerQuality=(requiredHit/requiredWords.length)*40}else if(!isEmpty&&!refused){answerQuality=28}else if(!isEmpty){answerQuality=10}if(forbiddenWords.length&&forbiddenHit>0){answerQuality=Math.max(0,answerQuality-(forbiddenHit/forbiddenWords.length)*40)}let sourcesScore=0;if(expectNoAnswer)sourcesScore=refused?30:0;else if(requiredSourceId)sourcesScore=hasRequiredSource?30:0;else sourcesScore=sourceIds.length>0?25:10;let documentScore=0;if(expectNoAnswer)documentScore=refused?20:0;else if(expectedDocId)documentScore=hasExpectedDoc?20:0;else documentScore=15;let latencyScore=0;const d=Number(durationMs);if(Number.isFinite(d)){if(d<=15000)latencyScore=10;else if(d<=maxLatencyMs)latencyScore=5;else latencyScore=0}let score=Math.round(Math.max(0,Math.min(100,answerQuality+sourcesScore+documentScore+latencyScore)));const isHallucination=!expectNoAnswer&&!isEmpty&&!refused&&!!requiredSourceId&&!hasRequiredSource&&requiredWords.length>0&&requiredHit===0;if(isHallucination)score=Math.min(score,25);const verdict=isInternalError?'ERROR':score>=minScore&&!isHallucination?'PASS':'FAIL';return{score,verdict,scoreBreakdown:{answerQuality:Math.round(answerQuality*100)/100,sources:sourcesScore,document:documentScore,latency:latencyScore,weights:{answerQuality:40,sources:30,document:20,latency:10},formula:'score = answerQuality(0-40) + sources(0-30) + document(0-20) + latency(0-10); PASS if score>=minScore && !hallucination'},requiredWordsHit:requiredHit,requiredWordsTotal:requiredWords.length,forbiddenWordsHit:forbiddenHit,sourcesCorrect:!!hasRequiredSource,sourcesIncorrect:!!(requiredSourceId&&!hasRequiredSource&&sourceIds.length>0),matchedDocument:hasExpectedDoc,matchedCategory,matchedSubcategory,isHallucination,isEmptyAnswer:isEmpty,isInternalError}}
const caso = $('Carregar caso').first().json;
const http = $input.first().json || {};
const started = Date.now();
let body = http.body;
if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
body = body || {};
const data = body.data && typeof body.data === 'object' ? body.data : body;
const statusCode = Number(http.statusCode || 0);
const isInternalError = !(statusCode >= 200 && statusCode < 300);
const answer = data.answer != null ? String(data.answer) : '';
const sources = Array.isArray(data.sources) ? data.sources : [];
const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};
const durationMs = Number(http.durationMs || http.requestDuration || 0) || null;
const scored = scoreCase({
  answer, sources, classification, durationMs,
  caseDef: caso,
  refusalPhrase: caso.refusal_phrase,
  maxLatencyMs: Number(caso.max_latency_ms || 30000),
  isInternalError,
});
if (isInternalError) { scored.verdict = 'ERROR'; scored.isInternalError = true; }
const chunkRefs = sources.map((s, i) => ({
  documentId: s.documentId || s.document_id || null,
  chunkOrder: s.chunkOrder != null ? Number(s.chunkOrder) : (s.chunk_order != null ? Number(s.chunk_order) : null),
  index: s.index != null ? Number(s.index) : i + 1,
})).filter((r) => r.documentId);
const sourcesSafe = sources.map((s) => ({
  index: s.index,
  documentId: s.documentId || s.document_id || null,
  documentTitle: s.documentTitle || s.document_title || null,
  categoryName: s.categoryName || s.category_name || null,
  subcategoryName: s.subcategoryName || s.subcategory_name || null,
  chunkOrder: s.chunkOrder != null ? s.chunkOrder : s.chunk_order,
}));
function esc(s){ return String(s ?? '').replace(/'/g, "''"); }
function j(v){ return esc(JSON.stringify(v ?? null)); }
const ocrUsed = String(caso.ocr_status || '').toUpperCase() === 'SUCCESS' || String(caso.extraction_method || '') === 'ocr';
const promptVersionIdSql = caso.prompt_version_id ? "'" + esc(caso.prompt_version_id) + "'::uuid" : 'NULL';
const sql = "INSERT INTO ai_test_results (\n" +
  "  run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs, classification,\n" +
  "  matched_document, matched_category, matched_subcategory, required_words_hit, required_words_total,\n" +
  "  forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination, is_empty_answer,\n" +
  "  is_internal_error, score, verdict, score_breakdown, extraction_method, ocr_quality_grade,\n" +
  "  ocr_used, sheet_name, headers_json, prompt_version, model_name, prompt_version_id\n" +
  ") VALUES (\n" +
  "  '" + esc(caso.run_id) + "'::uuid,\n" +
  "  '" + esc(caso.id) + "'::uuid,\n" +
  "  '" + esc(caso.code) + "',\n" +
  "  '" + esc(caso.question) + "',\n" +
  "  '" + esc(answer) + "',\n" +
  "  " + (durationMs == null ? 'NULL' : String(Math.round(durationMs))) + ",\n" +
  "  '" + j(sourcesSafe) + "'::jsonb,\n" +
  "  '" + j(chunkRefs) + "'::jsonb,\n" +
  "  '" + j(classification) + "'::jsonb,\n" +
  "  " + (scored.matchedDocument === true ? 'true' : scored.matchedDocument === false ? 'false' : 'NULL') + ",\n" +
  "  " + (scored.matchedCategory === true ? 'true' : scored.matchedCategory === false ? 'false' : 'NULL') + ",\n" +
  "  " + (scored.matchedSubcategory === true ? 'true' : scored.matchedSubcategory === false ? 'false' : 'NULL') + ",\n" +
  "  " + scored.requiredWordsHit + ", " + scored.requiredWordsTotal + ", " + scored.forbiddenWordsHit + ",\n" +
  "  " + (scored.sourcesCorrect ? 'true' : 'false') + ", " + (scored.sourcesIncorrect ? 'true' : 'false') + ",\n" +
  "  " + (scored.isHallucination ? 'true' : 'false') + ", " + (scored.isEmptyAnswer ? 'true' : 'false') + ",\n" +
  "  " + (scored.isInternalError ? 'true' : 'false') + ",\n" +
  "  " + scored.score + ", '" + esc(scored.verdict) + "',\n" +
  "  '" + j(scored.scoreBreakdown) + "'::jsonb,\n" +
  "  " + (caso.extraction_method ? "'" + esc(caso.extraction_method) + "'" : 'NULL') + ",\n" +
  "  " + (caso.ocr_quality_grade ? "'" + esc(caso.ocr_quality_grade) + "'" : 'NULL') + ",\n" +
  "  " + (ocrUsed ? 'true' : 'false') + ",\n" +
  "  " + (caso.sheet_name ? "'" + esc(caso.sheet_name) + "'" : 'NULL') + ",\n" +
  "  " + (caso.headers_json != null ? "'" + j(caso.headers_json) + "'::jsonb" : 'NULL') + ",\n" +
  "  '" + esc(caso.prompt_version) + "', '" + esc(caso.model_name) + "', " + promptVersionIdSql + "\n" +
  ") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\n" +
  "  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\n" +
  "  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\n" +
  "  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\n" +
  "  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, prompt_version_id, created_at;";
return [{ json: {
  sql,
  runId: caso.run_id,
  caseId: caso.id,
  caseCode: caso.code,
  question: caso.question,
  answer,
  durationMs,
  sources: sourcesSafe,
  chunkRefs,
  score: scored.score,
  verdict: scored.verdict,
  isHallucination: scored.isHallucination,
  isInternalError: scored.isInternalError,
  expectNoAnswer: !!caso.expect_no_answer,
  groupName: caso.group_name,
  expectedDocumentId: caso.expected_document_id,
  matchedDocument: scored.matchedDocument,
  sourcesCorrect: scored.sourcesCorrect,
  sourcesIncorrect: scored.sourcesIncorrect,
  promptVersionId: caso.prompt_version_id || null,
}}];