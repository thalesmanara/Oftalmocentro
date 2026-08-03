import { workflow, node, trigger, expr, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');

const SCORE_FN = `function normalizeText(s){return String(s??'').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\s+/g,' ').trim()}
function includesWord(haystack,word){const h=normalizeText(haystack);const w=normalizeText(word);if(!w)return true;return h.includes(w)}
function scoreCase(input){const{answer='',sources=[],classification={},durationMs=null,caseDef,refusalPhrase='Não encontrei essa informação na base documental disponível.',maxLatencyMs=30000,isInternalError=false}=input;const requiredWords=Array.isArray(caseDef.required_words||caseDef.requiredWords)?caseDef.required_words||caseDef.requiredWords:[];const forbiddenWords=Array.isArray(caseDef.forbidden_words||caseDef.forbiddenWords)?caseDef.forbidden_words||caseDef.forbiddenWords:[];const minScore=Number(caseDef.min_score??caseDef.minScore??70);const expectNoAnswer=!!(caseDef.expect_no_answer??caseDef.expectNoAnswer);const expectedDocId=caseDef.expected_document_id||caseDef.expectedDocumentId||null;const requiredSourceId=caseDef.required_source_document_id||caseDef.requiredSourceDocumentId||expectedDocId;const expectedCategory=caseDef.category_name||caseDef.categoryName||null;const expectedSubcategory=caseDef.subcategory_name||caseDef.subcategoryName||null;const isEmpty=!String(answer||'').trim();const refused=includesWord(answer,refusalPhrase)||normalizeText(answer)===normalizeText(refusalPhrase);let requiredHit=0;for(const w of requiredWords){if(includesWord(answer,w))requiredHit+=1}let forbiddenHit=0;for(const w of forbiddenWords){if(includesWord(answer,w))forbiddenHit+=1}const sourceIds=(sources||[]).map(s=>String(s.documentId||s.document_id||'')).filter(Boolean);const hasRequiredSource=requiredSourceId?sourceIds.includes(String(requiredSourceId)):sourceIds.length>0||expectNoAnswer;const hasExpectedDoc=expectedDocId?sourceIds.includes(String(expectedDocId)):true;const matchedCategory=expectedCategory?normalizeText(classification.categoryName||classification.category_name)===normalizeText(expectedCategory):null;const matchedSubcategory=expectedSubcategory?normalizeText(classification.subcategoryName||classification.subcategory_name)===normalizeText(expectedSubcategory):null;let answerQuality=0;if(expectNoAnswer){answerQuality=refused?40:isEmpty?20:0}else if(requiredWords.length){answerQuality=(requiredHit/requiredWords.length)*40}else if(!isEmpty&&!refused){answerQuality=28}else if(!isEmpty){answerQuality=10}if(forbiddenWords.length&&forbiddenHit>0){answerQuality=Math.max(0,answerQuality-(forbiddenHit/forbiddenWords.length)*40)}let sourcesScore=0;if(expectNoAnswer)sourcesScore=refused?30:0;else if(requiredSourceId)sourcesScore=hasRequiredSource?30:0;else sourcesScore=sourceIds.length>0?25:10;let documentScore=0;if(expectNoAnswer)documentScore=refused?20:0;else if(expectedDocId)documentScore=hasExpectedDoc?20:0;else documentScore=15;let latencyScore=0;const d=Number(durationMs);if(Number.isFinite(d)){if(d<=15000)latencyScore=10;else if(d<=maxLatencyMs)latencyScore=5;else latencyScore=0}let score=Math.round(Math.max(0,Math.min(100,answerQuality+sourcesScore+documentScore+latencyScore)));const isHallucination=!expectNoAnswer&&!isEmpty&&!refused&&!!requiredSourceId&&!hasRequiredSource&&requiredWords.length>0&&requiredHit===0;if(isHallucination)score=Math.min(score,25);const verdict=isInternalError?'ERROR':score>=minScore&&!isHallucination?'PASS':'FAIL';return{score,verdict,scoreBreakdown:{answerQuality:Math.round(answerQuality*100)/100,sources:sourcesScore,document:documentScore,latency:latencyScore,weights:{answerQuality:40,sources:30,document:20,latency:10},formula:'score = answerQuality(0-40) + sources(0-30) + document(0-20) + latency(0-10); PASS if score>=minScore && !hallucination'},requiredWordsHit:requiredHit,requiredWordsTotal:requiredWords.length,forbiddenWordsHit:forbiddenHit,sourcesCorrect:!!hasRequiredSource,sourcesIncorrect:!!(requiredSourceId&&!hasRequiredSource&&sourceIds.length>0),matchedDocument:hasExpectedDoc,matchedCategory,matchedSubcategory,isHallucination,isEmptyAnswer:isEmpty,isInternalError}}`;

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'runId', type: 'string' },
          { name: 'caseId', type: 'string' },
          { name: 'authorization', type: 'string' },
          { name: 'promptVersion', type: 'string' },
          { name: 'modelName', type: 'string' },
          { name: 'refusalPhrase', type: 'string' },
          { name: 'maxLatencyMs', type: 'number' },
        ],
      },
    },
    output: [
      {
        json: {
          runId: '11111111-1111-1111-1111-111111111111',
          caseId: '22222222-2222-2222-2222-222222222222',
          authorization: 'Bearer x',
          promptVersion: 'consulta-ia-v1',
          modelName: 'gpt-4.1-mini',
          refusalPhrase: 'Não encontrei essa informação na base documental disponível.',
          maxLatencyMs: 30000,
        },
      },
    ],
  },
});

const loadCase = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Carregar caso',
    credentials: { postgres: PG_CRED },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr(
        "SELECT c.id, c.code, c.name, c.group_name, c.test_type, c.category_name, c.subcategory_name,\n" +
          '  c.expected_document_id, c.expected_document_ids, c.question, c.expected_answer,\n' +
          '  c.required_words, c.forbidden_words, c.required_source_document_id, c.min_score,\n' +
          '  c.expect_no_answer, c.notes, c.status, c.version, c.depends_on_missing_docs,\n' +
          "  '{{ $json.runId }}'::text AS run_id,\n" +
          "  '{{ String($json.authorization || \"\").replace(/'/g, \"''\") }}'::text AS authorization,\n" +
          "  COALESCE(NULLIF('{{ String($json.promptVersion || \"\").replace(/'/g, \"''\") }}', ''), (SELECT value FROM app_secrets WHERE key='ai_eval_prompt_version' LIMIT 1), 'unknown') AS prompt_version,\n" +
          "  COALESCE(NULLIF('{{ String($json.modelName || \"\").replace(/'/g, \"''\") }}', ''), (SELECT value FROM app_secrets WHERE key='ai_eval_model_name' LIMIT 1), 'unknown') AS model_name,\n" +
          "  COALESCE(NULLIF('{{ String($json.refusalPhrase || \"\").replace(/'/g, \"''\") }}', ''), (SELECT value FROM app_secrets WHERE key='ai_eval_refusal_phrase' LIMIT 1), 'Não encontrei essa informação na base documental disponível.') AS refusal_phrase,\n" +
          "  COALESCE(NULLIF('{{ $json.maxLatencyMs || \"\" }}', '')::int, (SELECT value::int FROM app_secrets WHERE key='ai_eval_max_latency_ms' LIMIT 1), 30000) AS max_latency_ms,\n" +
          "  dv.extraction_method, dv.ocr_quality_grade, dv.ocr_status, ds.sheet_name, dc.headers_json\n" +
          'FROM ai_test_cases c\n' +
          'LEFT JOIN LATERAL (\n' +
          '  SELECT extraction_method, ocr_quality_grade, ocr_status\n' +
          '  FROM document_versions\n' +
          "  WHERE document_id = c.expected_document_id AND status = 'CURRENT'\n" +
          '  ORDER BY version_number DESC NULLS LAST LIMIT 1\n' +
          ') dv ON true\n' +
          'LEFT JOIN LATERAL (\n' +
          '  SELECT sheet_name FROM document_sheets WHERE document_id = c.expected_document_id ORDER BY sheet_index LIMIT 1\n' +
          ') ds ON true\n' +
          'LEFT JOIN LATERAL (\n' +
          "  SELECT headers_json FROM document_chunks WHERE document_id = c.expected_document_id AND chunk_kind = 'tabular' ORDER BY chunk_order LIMIT 1\n" +
          ') dc ON true\n' +
          "WHERE c.id = '{{ $json.caseId }}'::uuid\n" +
          'LIMIT 1;'
      ),
    },
  },
  output: [
    {
      json: {
        id: '22222222-2222-2222-2222-222222222222',
        code: 'TC-001',
        question: 'Pergunta?',
        required_words: ['x'],
        forbidden_words: [],
        min_score: 70,
        expect_no_answer: false,
        run_id: '11111111-1111-1111-1111-111111111111',
        authorization: 'Bearer x',
        prompt_version: 'v1',
        model_name: 'gpt-4.1-mini',
        refusal_phrase: 'Não encontrei',
        max_latency_ms: 30000,
      },
    },
  ],
});

const callIa = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Chamar Consulta IA',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'POST',
      url: 'http://127.0.0.1:5678/webhook/consulta-ia',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          { name: 'Authorization', value: expr('={{ $json.authorization }}') },
          { name: 'Content-Type', value: 'application/json' },
          { name: 'X-Request-Id', value: expr('={{ $json.run_id }}') },
        ],
      },
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('={{ JSON.stringify({ question: $json.question }) }}'),
      options: {
        timeout: 120000,
        response: { response: { fullResponse: true, neverError: true } },
      },
    },
  },
  output: [{ json: { statusCode: 200, body: { answer: 'ok', sources: [] } } }],
});

const scoreAndPersist = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Avaliar e montar insert',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode:
        SCORE_FN +
        `\nconst caso = $('Carregar caso').first().json;\n` +
        `const http = $input.first().json || {};\n` +
        `const started = Date.now();\n` +
        `let body = http.body;\n` +
        `if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }\n` +
        `body = body || {};\n` +
        `const data = body.data && typeof body.data === 'object' ? body.data : body;\n` +
        `const statusCode = Number(http.statusCode || 0);\n` +
        `const isInternalError = !(statusCode >= 200 && statusCode < 300);\n` +
        `const answer = data.answer != null ? String(data.answer) : '';\n` +
        `const sources = Array.isArray(data.sources) ? data.sources : [];\n` +
        `const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};\n` +
        `const durationMs = Number(http.durationMs || http.requestDuration || 0) || null;\n` +
        `const scored = scoreCase({\n` +
        `  answer, sources, classification, durationMs,\n` +
        `  caseDef: caso,\n` +
        `  refusalPhrase: caso.refusal_phrase,\n` +
        `  maxLatencyMs: Number(caso.max_latency_ms || 30000),\n` +
        `  isInternalError,\n` +
        `});\n` +
        `if (isInternalError) { scored.verdict = 'ERROR'; scored.isInternalError = true; }\n` +
        `const chunkRefs = sources.map((s, i) => ({\n` +
        `  documentId: s.documentId || s.document_id || null,\n` +
        `  chunkOrder: s.chunkOrder != null ? Number(s.chunkOrder) : (s.chunk_order != null ? Number(s.chunk_order) : null),\n` +
        `  index: s.index != null ? Number(s.index) : i + 1,\n` +
        `})).filter((r) => r.documentId);\n` +
        `const sourcesSafe = sources.map((s) => ({\n` +
        `  index: s.index,\n` +
        `  documentId: s.documentId || s.document_id || null,\n` +
        `  documentTitle: s.documentTitle || s.document_title || null,\n` +
        `  categoryName: s.categoryName || s.category_name || null,\n` +
        `  subcategoryName: s.subcategoryName || s.subcategory_name || null,\n` +
        `  chunkOrder: s.chunkOrder != null ? s.chunkOrder : s.chunk_order,\n` +
        `}));\n` +
        `function esc(s){ return String(s ?? '').replace(/'/g, \"''\"); }\n` +
        `function j(v){ return esc(JSON.stringify(v ?? null)); }\n` +
        `const ocrUsed = String(caso.ocr_status || '').toUpperCase() === 'SUCCESS' || String(caso.extraction_method || '') === 'ocr';\n` +
        `const sql = \"INSERT INTO ai_test_results (\\n\" +\n` +
        `  \"  run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs, classification,\\n\" +\n` +
        `  \"  matched_document, matched_category, matched_subcategory, required_words_hit, required_words_total,\\n\" +\n` +
        `  \"  forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination, is_empty_answer,\\n\" +\n` +
        `  \"  is_internal_error, score, verdict, score_breakdown, extraction_method, ocr_quality_grade,\\n\" +\n` +
        `  \"  ocr_used, sheet_name, headers_json, prompt_version, model_name\\n\" +\n` +
        `  \") VALUES (\\n\" +\n` +
        `  \"  '\" + esc(caso.run_id) + \"'::uuid,\\n\" +\n` +
        `  \"  '\" + esc(caso.id) + \"'::uuid,\\n\" +\n` +
        `  \"  '\" + esc(caso.code) + \"',\\n\" +\n` +
        `  \"  '\" + esc(caso.question) + \"',\\n\" +\n` +
        `  \"  '\" + esc(answer) + \"',\\n\" +\n` +
        `  \"  \" + (durationMs == null ? 'NULL' : String(Math.round(durationMs))) + \",\\n\" +\n` +
        `  \"  '\" + j(sourcesSafe) + \"'::jsonb,\\n\" +\n` +
        `  \"  '\" + j(chunkRefs) + \"'::jsonb,\\n\" +\n` +
        `  \"  '\" + j(classification) + \"'::jsonb,\\n\" +\n` +
        `  \"  \" + (scored.matchedDocument === true ? 'true' : scored.matchedDocument === false ? 'false' : 'NULL') + \",\\n\" +\n` +
        `  \"  \" + (scored.matchedCategory === true ? 'true' : scored.matchedCategory === false ? 'false' : 'NULL') + \",\\n\" +\n` +
        `  \"  \" + (scored.matchedSubcategory === true ? 'true' : scored.matchedSubcategory === false ? 'false' : 'NULL') + \",\\n\" +\n` +
        `  \"  \" + scored.requiredWordsHit + \", \" + scored.requiredWordsTotal + \", \" + scored.forbiddenWordsHit + \",\\n\" +\n` +
        `  \"  \" + (scored.sourcesCorrect ? 'true' : 'false') + \", \" + (scored.sourcesIncorrect ? 'true' : 'false') + \",\\n\" +\n` +
        `  \"  \" + (scored.isHallucination ? 'true' : 'false') + \", \" + (scored.isEmptyAnswer ? 'true' : 'false') + \",\\n\" +\n` +
        `  \"  \" + (scored.isInternalError ? 'true' : 'false') + \",\\n\" +\n` +
        `  \"  \" + scored.score + \", '\" + esc(scored.verdict) + \"',\\n\" +\n` +
        `  \"  '\" + j(scored.scoreBreakdown) + \"'::jsonb,\\n\" +\n` +
        `  \"  \" + (caso.extraction_method ? \"'\" + esc(caso.extraction_method) + \"'\" : 'NULL') + \",\\n\" +\n` +
        `  \"  \" + (caso.ocr_quality_grade ? \"'\" + esc(caso.ocr_quality_grade) + \"'\" : 'NULL') + \",\\n\" +\n` +
        `  \"  \" + (ocrUsed ? 'true' : 'false') + \",\\n\" +\n` +
        `  \"  \" + (caso.sheet_name ? \"'\" + esc(caso.sheet_name) + \"'\" : 'NULL') + \",\\n\" +\n` +
        `  \"  \" + (caso.headers_json != null ? \"'\" + j(caso.headers_json) + \"'::jsonb\" : 'NULL') + \",\\n\" +\n` +
        `  \"  '\" + esc(caso.prompt_version) + \"', '\" + esc(caso.model_name) + \"'\\n\" +\n` +
        `  \") RETURNING id, run_id, case_id, case_code, question, answer, duration_ms, sources, chunk_refs,\\n\" +\n` +
        `  \"  classification, matched_document, matched_category, matched_subcategory, required_words_hit,\\n\" +\n` +
        `  \"  required_words_total, forbidden_words_hit, sources_correct, sources_incorrect, is_hallucination,\\n\" +\n` +
        `  \"  is_empty_answer, is_internal_error, score, verdict, score_breakdown, extraction_method,\\n\" +\n` +
        `  \"  ocr_quality_grade, ocr_used, sheet_name, prompt_version, model_name, created_at;\";\n` +
        `return [{ json: {\n` +
        `  sql,\n` +
        `  runId: caso.run_id,\n` +
        `  caseId: caso.id,\n` +
        `  caseCode: caso.code,\n` +
        `  question: caso.question,\n` +
        `  answer,\n` +
        `  durationMs,\n` +
        `  sources: sourcesSafe,\n` +
        `  chunkRefs,\n` +
        `  score: scored.score,\n` +
        `  verdict: scored.verdict,\n` +
        `  isHallucination: scored.isHallucination,\n` +
        `  isInternalError: scored.isInternalError,\n` +
        `  expectNoAnswer: !!caso.expect_no_answer,\n` +
        `  groupName: caso.group_name,\n` +
        `  expectedDocumentId: caso.expected_document_id,\n` +
        `  matchedDocument: scored.matchedDocument,\n` +
        `  sourcesCorrect: scored.sourcesCorrect,\n` +
        `  sourcesIncorrect: scored.sourcesIncorrect,\n` +
        `}}];`,
    },
  },
  output: [{ json: { sql: 'SELECT 1', verdict: 'PASS', score: 80 } }],
});

const insertResult = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Inserir resultado',
    credentials: { postgres: PG_CRED },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: expr('={{ $json.sql }}'),
    },
  },
  output: [{ json: { id: '33333333-3333-3333-3333-333333333333', verdict: 'PASS', score: 80 } }],
});

const normalizeOut = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalizar saída',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const row = $input.first().json || {};
const scored = $('Avaliar e montar insert').first().json || {};
function camel(r) {
  return {
    id: r.id,
    runId: r.run_id || scored.runId,
    caseId: r.case_id || scored.caseId,
    caseCode: r.case_code || scored.caseCode,
    question: r.question || scored.question,
    answer: r.answer != null ? r.answer : scored.answer,
    durationMs: r.duration_ms != null ? Number(r.duration_ms) : scored.durationMs,
    sources: r.sources || scored.sources || [],
    chunkRefs: r.chunk_refs || scored.chunkRefs || [],
    classification: r.classification || null,
    matchedDocument: r.matched_document,
    matchedCategory: r.matched_category,
    matchedSubcategory: r.matched_subcategory,
    requiredWordsHit: Number(r.required_words_hit || 0),
    requiredWordsTotal: Number(r.required_words_total || 0),
    forbiddenWordsHit: Number(r.forbidden_words_hit || 0),
    sourcesCorrect: r.sources_correct,
    sourcesIncorrect: r.sources_incorrect,
    isHallucination: !!r.is_hallucination,
    isEmptyAnswer: !!r.is_empty_answer,
    isInternalError: !!r.is_internal_error,
    score: r.score != null ? Number(r.score) : scored.score,
    verdict: r.verdict || scored.verdict,
    scoreBreakdown: r.score_breakdown || null,
    extractionMethod: r.extraction_method || null,
    ocrQualityGrade: r.ocr_quality_grade || null,
    ocrUsed: r.ocr_used,
    sheetName: r.sheet_name || null,
    promptVersion: r.prompt_version || null,
    modelName: r.model_name || null,
    createdAt: r.created_at || new Date().toISOString(),
  };
}
return [{ json: { ok: true, result: camel(row), verdict: row.verdict || scored.verdict, score: Number(row.score ?? scored.score) } }];`,
    },
  },
  output: [{ json: { ok: true, result: { verdict: 'PASS' }, verdict: 'PASS', score: 80 } }],
});

export default workflow('ia-executar-teste', 'IA - EXECUTAR TESTE')
  .add(trig)
  .to(loadCase)
  .to(callIa)
  .to(scoreAndPersist)
  .to(insertResult)
  .to(normalizeOut);
