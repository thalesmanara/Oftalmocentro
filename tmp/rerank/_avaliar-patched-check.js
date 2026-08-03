function normalizeText(s){return String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()}
function includesWord(haystack,word){const h=normalizeText(haystack);const w=normalizeText(word);if(!w)return true;return h.includes(w)}
function scoreCase(input){const{answer='',sources=[],classification={},durationMs=null,caseDef,refusalPhrase='Não encontrei essa informação na base documental disponível.',maxLatencyMs=30000,isInternalError=false}=input;const 
...
Code: caso.code,
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
  expectedDocumentRank, recallAtK, precisionAtK, mrr, hitRate, sourcePrecision, sourceRecall,
  candidatesRetrieved, candidatesReranked, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode,
  rankedDocumentIds, retrievalCasesEvaluable,
}}];