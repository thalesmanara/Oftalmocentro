/**
 * Response Quality Layer — deterministic validation + quality score.
 * Used by Node tests and inlined into n8n Code nodes.
 */

export const RESPONSE_QUALITY_SCHEMA_VERSION = 'response-quality-schema-v1';

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, Number(n) || 0));
}

export function gradeFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 85) return 'EXCELLENT';
  if (s >= 70) return 'GOOD';
  if (s >= 55) return 'ACCEPTABLE';
  if (s >= 40) return 'LOW';
  return 'POOR';
}

export function confidenceFromScore(score) {
  const s = Number(score) || 0;
  if (s >= 80) return 'HIGH';
  if (s >= 55) return 'MEDIUM';
  return 'LOW';
}

export function defaultResponseQualityConfig() {
  return {
    mode: 'VALIDATE',
    minAnswerLength: 40,
    maxAnswerLength: 8000,
    requireSources: true,
    allowEmptyOnInsufficientContext: true,
    forbiddenPhrases: [
      'como modelo de linguagem',
      'como uma ia',
      'não tenho acesso à internet',
      'posso inventar',
      'vou inventar',
    ],
    minQualityScoreWarn: 55,
    minQualityScoreError: 40,
    minCitationCoverage: 0.35,
    enableHallucinationRules: true,
    enableConsistencyRules: true,
    enableSourceValidation: true,
    enableLengthRules: true,
    enableForbiddenPhrases: true,
    passthroughAnswer: true,
    notes: '',
    responsePolicy: defaultResponsePolicy({ enabled: false }),
  };
}

export function validateResponseQualityConfiguration(input) {
  const errors = [];
  const cfg = { ...defaultResponseQualityConfig(), ...(input || {}) };
  const modes = ['DISABLED', 'PASSTHROUGH', 'VALIDATE', 'VALIDATE_STRICT'];
  if (!modes.includes(String(cfg.mode || '').toUpperCase())) {
    errors.push({ field: 'mode', message: 'mode inválido' });
  }
  if (!(Number(cfg.minAnswerLength) >= 0)) {
    errors.push({ field: 'minAnswerLength', message: 'minAnswerLength inválido' });
  }
  if (!(Number(cfg.maxAnswerLength) > Number(cfg.minAnswerLength))) {
    errors.push({ field: 'maxAnswerLength', message: 'maxAnswerLength deve ser > minAnswerLength' });
  }
  if (!(Number(cfg.minQualityScoreWarn) >= 0 && Number(cfg.minQualityScoreWarn) <= 100)) {
    errors.push({ field: 'minQualityScoreWarn', message: 'minQualityScoreWarn 0–100' });
  }
  if (!(Number(cfg.minQualityScoreError) >= 0 && Number(cfg.minQualityScoreError) <= 100)) {
    errors.push({ field: 'minQualityScoreError', message: 'minQualityScoreError 0–100' });
  }
  if (Number(cfg.minQualityScoreError) > Number(cfg.minQualityScoreWarn)) {
    errors.push({
      field: 'minQualityScoreError',
      message: 'minQualityScoreError não pode ser maior que minQualityScoreWarn',
    });
  }
  cfg.mode = String(cfg.mode || 'VALIDATE').toUpperCase();
  cfg.forbiddenPhrases = Array.isArray(cfg.forbiddenPhrases)
    ? cfg.forbiddenPhrases.map((p) => String(p)).filter(Boolean)
    : defaultResponseQualityConfig().forbiddenPhrases;

  const policyCheck = validateResponsePolicy(cfg.responsePolicy);
  if (!policyCheck.ok) {
    for (const e of policyCheck.errors) {
      errors.push({ field: `responsePolicy.${e.field}`, message: e.message });
    }
  } else {
    cfg.responsePolicy = policyCheck.policy;
  }

  return { ok: errors.length === 0, configuration: cfg, errors };
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9à-ú]+/i)
    .filter((w) => w.length > 2);
}

function uniqueRatio(tokens) {
  if (!tokens.length) return 0;
  return new Set(tokens).size / tokens.length;
}

function repetitionRate(text) {
  const tokens = tokenize(text);
  if (tokens.length < 8) return 0;
  const uniq = uniqueRatio(tokens);
  return clamp(1 - uniq, 0, 1);
}

function extractCitedDocHints(answer, sources) {
  const a = String(answer || '');
  const titles = (sources || [])
    .map((s) => String(s.documentTitle || s.title || '').trim())
    .filter((t) => t.length >= 8);
  const cited = [];
  for (const t of titles) {
    if (a.toLowerCase().includes(t.toLowerCase().slice(0, Math.min(40, t.length)))) {
      cited.push(t);
    }
  }
  // numeric source refs [1] (2) etc.
  const refs = [...a.matchAll(/[\[(]\s*(\d{1,2})\s*[\])]/g)].map((m) => Number(m[1]));
  return { citedTitles: cited, numericRefs: refs };
}

function avg(nums) {
  const xs = (nums || []).filter((n) => Number.isFinite(Number(n))).map(Number);
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function ocrGradeToScore(g) {
  const s = String(g || '').toUpperCase();
  if (s === 'A' || s === 'EXCELLENT') return 95;
  if (s === 'B' || s === 'GOOD') return 80;
  if (s === 'C' || s === 'ACCEPTABLE') return 65;
  if (s === 'D' || s === 'LOW') return 45;
  if (s === 'POOR' || s === 'FAILED' || s === 'MANUAL_REVIEW') return 25;
  return 70;
}

/**
 * Deterministic response quality evaluation.
 * Never mutates documents. Never calls another LLM.
 */
export function evaluateResponseQuality(input, configuration = {}) {
  const t0 = Date.now();
  const cfg = { ...defaultResponseQualityConfig(), ...(configuration || {}) };
  const mode = String(cfg.mode || 'VALIDATE').toUpperCase();

  const answer = String(input.answer ?? '');
  const question = String(input.question ?? '');
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const evidenceMeta = input.evidenceMeta || {};
  const contextMeta = input.contextMeta || {};
  const retrievalMeta = input.retrievalMeta || {};

  const issues = [];
  const flags = {
    emptyAnswer: false,
    tooShort: false,
    tooLong: false,
    missingSources: false,
    duplicateSources: false,
    nonexistentReferences: false,
    conflictDetected: false,
    insufficientContext: false,
    highRepetition: false,
    lowCoverage: false,
    forbiddenPhrase: false,
    outOfDocumentaryContext: false,
    expiredSource: false,
    removedSource: false,
    hallucinationSuspected: false,
    negativeWithoutBasis: false,
  };

  const answerLength = answer.trim().length;
  const tokens = tokenize(answer);
  const redundancyRate = repetitionRate(answer);

  // --- Length ---
  if (cfg.enableLengthRules !== false) {
    if (!answer.trim()) {
      flags.emptyAnswer = true;
      issues.push({ code: 'EMPTY_ANSWER', severity: 'ERROR', message: 'Resposta vazia' });
    } else if (answerLength < Number(cfg.minAnswerLength || 40)) {
      flags.tooShort = true;
      issues.push({ code: 'ANSWER_TOO_SHORT', severity: 'WARNING', message: 'Resposta muito curta' });
    }
    if (answerLength > Number(cfg.maxAnswerLength || 8000)) {
      flags.tooLong = true;
      issues.push({ code: 'ANSWER_TOO_LONG', severity: 'WARNING', message: 'Resposta muito longa' });
    }
  }

  // --- Sources ---
  const sourceIds = sources.map((s) => String(s.documentId || s.id || '')).filter(Boolean);
  const uniqueSourceIds = [...new Set(sourceIds)];
  if (sourceIds.length !== uniqueSourceIds.length) {
    flags.duplicateSources = true;
    issues.push({ code: 'DUPLICATE_SOURCES', severity: 'WARNING', message: 'Fontes duplicadas' });
  }

  const now = Date.now();
  let expiredCount = 0;
  let removedCount = 0;
  for (const s of sources) {
    const exp = s.expirationDate || s.expiration || s.vigencyDate;
    if (exp && Date.parse(exp) < now) {
      expiredCount++;
      flags.expiredSource = true;
    }
    if (s.deleted === true || s.removed === true || s.status === 'REMOVED') {
      removedCount++;
      flags.removedSource = true;
    }
  }
  if (expiredCount) {
    issues.push({
      code: 'EXPIRED_SOURCE',
      severity: 'WARNING',
      message: `${expiredCount} fonte(s) expirada(s)`,
    });
  }
  if (removedCount) {
    issues.push({
      code: 'REMOVED_SOURCE',
      severity: 'ERROR',
      message: `${removedCount} fonte(s) removida(s)`,
    });
  }

  const requireSources = cfg.requireSources !== false && mode !== 'PASSTHROUGH';
  if (requireSources && uniqueSourceIds.length === 0 && answer.trim()) {
    flags.missingSources = true;
    issues.push({ code: 'MISSING_SOURCES', severity: 'ERROR', message: 'Resposta sem fontes' });
  }

  const { citedTitles, numericRefs } = extractCitedDocHints(answer, sources);
  const maxIndex = sources.length;
  const badNumeric = numericRefs.filter((n) => n < 1 || n > maxIndex);
  if (badNumeric.length) {
    flags.nonexistentReferences = true;
    issues.push({
      code: 'NONEXISTENT_REFERENCE',
      severity: 'ERROR',
      message: 'Referência a fonte inexistente',
    });
  }

  // --- Context / conflict from prior layers ---
  const conflictDetected = !!(
    evidenceMeta.conflictDetected ||
    contextMeta.conflictDetected ||
    input.conflictDetected
  );
  flags.conflictDetected = conflictDetected;
  if (conflictDetected) {
    issues.push({
      code: 'DOCUMENT_CONFLICT',
      severity: 'WARNING',
      message: 'Conflito documental detectado nas evidências/contexto',
    });
  }

  const insufficientContext = !!(
    contextMeta.insufficientContext ||
    contextMeta.fallbackUsed ||
    retrievalMeta.insufficientContext ||
    (Number(evidenceMeta.evidenceCount || sources.length) === 0 && answer.trim())
  );
  flags.insufficientContext = insufficientContext;
  if (insufficientContext) {
    issues.push({
      code: 'INSUFFICIENT_CONTEXT',
      severity: 'WARNING',
      message: 'Contexto insuficiente',
    });
  }

  if (redundancyRate >= 0.45) {
    flags.highRepetition = true;
    issues.push({
      code: 'HIGH_REPETITION',
      severity: 'WARNING',
      message: 'Excesso de repetição na resposta',
    });
  }

  // --- Forbidden phrases ---
  if (cfg.enableForbiddenPhrases !== false) {
    const lower = answer.toLowerCase();
    for (const p of cfg.forbiddenPhrases || []) {
      if (p && lower.includes(String(p).toLowerCase())) {
        flags.forbiddenPhrase = true;
        issues.push({
          code: 'FORBIDDEN_PHRASE',
          severity: 'ERROR',
          message: `Frase proibida: ${p}`,
        });
        break;
      }
    }
  }

  // --- Coverage ---
  const avgEvidenceScore = Number(
    evidenceMeta.averageEvidenceScore ?? avg(sources.map((s) => s.evidenceScore)),
  );
  const evidenceCount = Number(evidenceMeta.evidenceCount ?? sources.length) || 0;
  const evidenceCoverage = clamp(
    evidenceCount <= 0 ? 0 : Math.min(1, evidenceCount / 5) * 0.5 + clamp(avgEvidenceScore / 100, 0, 1) * 0.5,
    0,
    1,
  );

  const contextTokens = tokenize(
    [
      ...(sources || []).map((s) => `${s.documentTitle || ''} ${s.categoryName || ''}`),
      question,
    ].join(' '),
  );
  const answerTok = tokens;
  let overlap = 0;
  if (answerTok.length && contextTokens.length) {
    const set = new Set(contextTokens);
    overlap = answerTok.filter((t) => set.has(t)).length / answerTok.length;
  }
  const sourceCoverage = clamp(
    uniqueSourceIds.length === 0 ? 0 : Math.min(1, uniqueSourceIds.length / 3) * 0.4 + overlap * 0.6,
    0,
    1,
  );

  if (sourceCoverage < Number(cfg.minCitationCoverage || 0.35) && answer.trim() && uniqueSourceIds.length) {
    flags.lowCoverage = true;
    issues.push({
      code: 'LOW_COVERAGE',
      severity: 'WARNING',
      message: 'Baixa cobertura documental da resposta',
    });
  }

  // Out of documentary context: long answer with almost no overlap and no sources
  if (answerLength > 120 && uniqueSourceIds.length === 0 && overlap < 0.08) {
    flags.outOfDocumentaryContext = true;
    issues.push({
      code: 'OUT_OF_DOCUMENTARY_CONTEXT',
      severity: 'ERROR',
      message: 'Possível fuga do contexto documental',
    });
  }

  // Negative without basis
  const negativeAnswer = /n[aã]o (consta|encontr|localiz|foi possible|h[aá] registro|foi encontrado)|sem (informa|registro|document)/i.test(
    answer,
  );
  if (negativeAnswer && uniqueSourceIds.length === 0 && !insufficientContext) {
    flags.negativeWithoutBasis = true;
    issues.push({
      code: 'NEGATIVE_WITHOUT_BASIS',
      severity: 'WARNING',
      message: 'Negativa sem fundamento documental',
    });
  }

  // --- Hallucination heuristics ---
  if (cfg.enableHallucinationRules !== false) {
    if (flags.missingSources && answerLength > 80) flags.hallucinationSuspected = true;
    if (flags.nonexistentReferences) flags.hallucinationSuspected = true;
    if (flags.outOfDocumentaryContext) flags.hallucinationSuspected = true;
    // inventing IDs/CNPJ-like patterns not present in sources blob
    const sourceBlob = JSON.stringify(sources).toLowerCase();
    const idLike = answer.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g) || [];
    for (const id of idLike) {
      const norm = id.replace(/\D/g, '');
      if (norm && !sourceBlob.replace(/\D/g, '').includes(norm)) {
        flags.hallucinationSuspected = true;
        issues.push({
          code: 'ENTITY_NOT_IN_SOURCES',
          severity: 'ERROR',
          message: 'Entidade/identificador ausente nas fontes',
        });
        break;
      }
    }
    if (flags.hallucinationSuspected && !issues.some((i) => i.code.startsWith('HALLUC'))) {
      issues.push({
        code: 'HALLUCINATION_SUSPECTED',
        severity: 'ERROR',
        message: 'Provável alucinação por regras determinísticas',
      });
    }
  }

  // --- Consistency ---
  let consistencyStatus = 'OK';
  if (cfg.enableConsistencyRules !== false) {
    const hasError = issues.some((i) => i.severity === 'ERROR');
    const hasWarn = issues.some((i) => i.severity === 'WARNING');
    if (
      flags.hallucinationSuspected ||
      flags.nonexistentReferences ||
      flags.emptyAnswer ||
      flags.removedSource ||
      (conflictDetected && /definitiv|certamente|sem d[uú]vida/i.test(answer) && !/conflito|diverg/i.test(answer))
    ) {
      consistencyStatus = 'ERROR';
      if (conflictDetected && consistencyStatus === 'ERROR') {
        issues.push({
          code: 'UNEXPLAINED_CONFLICT',
          severity: 'ERROR',
          message: 'Conflito documental não explicado na resposta',
        });
      }
    } else if (hasError) {
      consistencyStatus = 'ERROR';
    } else if (hasWarn || conflictDetected || insufficientContext) {
      consistencyStatus = 'WARNING';
    }
  }

  // --- Quality score ---
  const ocrAvg = avg(sources.map((s) => ocrGradeToScore(s.ocrGrade || s.ocrQualityGrade)));
  const confMap = { HIGH: 90, MEDIUM: 65, LOW: 35 };
  const confDist = evidenceMeta.confidenceDistribution || {};
  const confTotal =
    (Number(confDist.HIGH) || 0) + (Number(confDist.MEDIUM) || 0) + (Number(confDist.LOW) || 0);
  const avgConfidence =
    confTotal > 0
      ? ((Number(confDist.HIGH) || 0) * 90 +
          (Number(confDist.MEDIUM) || 0) * 65 +
          (Number(confDist.LOW) || 0) * 35) /
        confTotal
      : avgEvidenceScore || 50;

  const objective =
    answerLength >= 40 &&
    !flags.emptyAnswer &&
    !/desculpe,? n[aã]o (posso|consigo)|como (uma )?ia\b/i.test(answer)
      ? 1
      : 0;

  let qualityScore = 0;
  qualityScore += evidenceCoverage * 22;
  qualityScore += clamp(avgEvidenceScore / 100, 0, 1) * 14;
  qualityScore += Math.min(1, uniqueSourceIds.length / 3) * 12;
  qualityScore += conflictDetected ? 0 : 10;
  qualityScore += insufficientContext ? 2 : 8;
  qualityScore += clamp(ocrAvg / 100, 0, 1) * 8;
  qualityScore += (1 - redundancyRate) * 8;
  qualityScore += clamp(avgConfidence / 100, 0, 1) * 10;
  qualityScore += objective * 8;

  // penalties
  if (flags.emptyAnswer) qualityScore = Math.min(qualityScore, 5);
  if (flags.missingSources) qualityScore -= 18;
  if (flags.hallucinationSuspected) qualityScore -= 25;
  if (flags.forbiddenPhrase) qualityScore -= 20;
  if (flags.tooShort) qualityScore -= 10;
  if (flags.tooLong) qualityScore -= 6;
  if (flags.duplicateSources) qualityScore -= 4;
  if (flags.nonexistentReferences) qualityScore -= 15;
  if (flags.expiredSource) qualityScore -= 6;
  if (flags.outOfDocumentaryContext) qualityScore -= 15;
  if (flags.highRepetition) qualityScore -= 8;
  if (flags.lowCoverage) qualityScore -= 8;
  if (flags.negativeWithoutBasis) qualityScore -= 10;

  qualityScore = clamp(Math.round(qualityScore), 0, 100);
  const qualityGrade = gradeFromScore(qualityScore);
  const confidence = confidenceFromScore(qualityScore);

  const citationQuality = clamp(
    (uniqueSourceIds.length ? 0.4 : 0) +
      sourceCoverage * 0.4 +
      (flags.nonexistentReferences ? 0 : 0.2) -
      (flags.duplicateSources ? 0.1 : 0),
    0,
    1,
  );

  const responseMeta = {
    qualityScore,
    qualityGrade,
    evidenceCoverage: Math.round(evidenceCoverage * 1000) / 1000,
    sourceCoverage: Math.round(sourceCoverage * 1000) / 1000,
    conflictDetected,
    insufficientContext,
    redundancyRate: Math.round(redundancyRate * 1000) / 1000,
    answerLength,
    citationsCount: uniqueSourceIds.length,
    confidence,
    consistencyStatus,
    hallucinationSuspected: flags.hallucinationSuspected,
    missingSources: flags.missingSources,
    citationQuality: Math.round(citationQuality * 1000) / 1000,
    issues,
    flags,
    citedTitles,
    numericRefs,
    durationMs: Date.now() - t0,
    schemaVersion: RESPONSE_QUALITY_SCHEMA_VERSION,
    mode,
    configVersion: input.configVersion || null,
    configVersionId: input.configVersionId || null,
  };

  // Audit action hint (no full answer)
  let auditAction = 'AI_RESPONSE_VALIDATION_COMPLETED';
  if (flags.hallucinationSuspected) auditAction = 'AI_RESPONSE_HALLUCINATION';
  else if (conflictDetected && consistencyStatus === 'ERROR') auditAction = 'AI_RESPONSE_CONFLICT';
  else if (qualityScore < Number(cfg.minQualityScoreWarn || 55)) auditAction = 'AI_RESPONSE_LOW_QUALITY';

  return {
    answer, // never rewrite by default — passthrough
    responseMeta,
    auditAction,
    qualityScore,
    qualityGrade,
    consistencyStatus,
  };
}

export function evaluateDisabledOrPassthrough(input, mode) {
  const answer = String(input.answer ?? '');
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const responseMeta = {
    qualityScore: null,
    qualityGrade: null,
    evidenceCoverage: null,
    sourceCoverage: null,
    conflictDetected: !!(input.evidenceMeta?.conflictDetected || input.contextMeta?.conflictDetected),
    insufficientContext: !!(input.contextMeta?.insufficientContext || input.contextMeta?.fallbackUsed),
    redundancyRate: null,
    answerLength: answer.length,
    citationsCount: new Set(sources.map((s) => s.documentId).filter(Boolean)).size,
    confidence: null,
    consistencyStatus: 'OK',
    hallucinationSuspected: false,
    missingSources: false,
    citationQuality: null,
    issues: [],
    flags: {},
    durationMs: 0,
    schemaVersion: RESPONSE_QUALITY_SCHEMA_VERSION,
    mode,
    configVersion: input.configVersion || null,
    configVersionId: input.configVersionId || null,
    skipped: true,
  };
  return {
    answer,
    responseMeta,
    auditAction: 'AI_RESPONSE_VALIDATION_COMPLETED',
    qualityScore: null,
    qualityGrade: null,
    consistencyStatus: 'OK',
  };
}

/** Official response strategies (Etapa 25). */
export const RESPONSE_POLICY_STRATEGIES = [
  'ANSWER',
  'ANSWER_WITH_WARNING',
  'ANSWER_WITH_LIMITATION',
  'REQUEST_CLARIFICATION',
  'ABSTAIN',
  'DECLINE',
];

export function defaultResponsePolicy(overrides = {}) {
  return {
    enabled: false,
    preserveOriginalAnswerOnAnswer: true,
    strategies: {
      ANSWER: true,
      ANSWER_WITH_WARNING: true,
      ANSWER_WITH_LIMITATION: true,
      REQUEST_CLARIFICATION: true,
      ABSTAIN: true,
      DECLINE: true,
    },
    thresholds: {
      poorGradeAbstainWithoutSources: true,
      lowGradeLimitation: true,
      minSourcesForAnswer: 1,
      minCoverageForAnswer: 0.35,
      conflictRequiresWarning: true,
      potentialConflictRequiresWarning: true,
      lowConfidenceLimitation: true,
      ambiguousRequiresClarification: true,
    },
    phrases: {
      abstain: 'Não foi localizada documentação interna suficiente para responder com segurança.',
      limitationPrefix: 'Os documentos disponíveis permitem uma resposta parcial:',
      conflictPrefix: 'Há divergência entre os documentos disponíveis. A informação mais recente indica:',
      clarificationPrefix: 'Para consultar a documentação correta, preciso que você especifique:',
      decline: 'Esta solicitação não pode ser respondida com base na documentação interna disponível.',
    },
    forbiddenExpressions: [
      'acho que',
      'imagino que',
      'provavelmente',
      'talvez',
      'segundo meu conhecimento',
      'conhecimento externo',
      'com certeza absoluta',
    ],
    ...overrides,
    strategies: {
      ANSWER: true,
      ANSWER_WITH_WARNING: true,
      ANSWER_WITH_LIMITATION: true,
      REQUEST_CLARIFICATION: true,
      ABSTAIN: true,
      DECLINE: true,
      ...(overrides.strategies || {}),
    },
    thresholds: {
      poorGradeAbstainWithoutSources: true,
      lowGradeLimitation: true,
      minSourcesForAnswer: 1,
      minCoverageForAnswer: 0.35,
      conflictRequiresWarning: true,
      potentialConflictRequiresWarning: true,
      lowConfidenceLimitation: true,
      ambiguousRequiresClarification: true,
      ...(overrides.thresholds || {}),
    },
    phrases: {
      abstain: 'Não foi localizada documentação interna suficiente para responder com segurança.',
      limitationPrefix: 'Os documentos disponíveis permitem uma resposta parcial:',
      conflictPrefix: 'Há divergência entre os documentos disponíveis. A informação mais recente indica:',
      clarificationPrefix: 'Para consultar a documentação correta, preciso que você especifique:',
      decline: 'Esta solicitação não pode ser respondida com base na documentação interna disponível.',
      ...(overrides.phrases || {}),
    },
  };
}

const SECRETISH = /(api[_-]?key|password|secret|token|bearer|postgres:\/\/|sk-[a-z0-9])/i;
const EXECISH = /(Function\s*\(|eval\s*\(|new\s+Function|<\/?script)/i;

export function validateResponsePolicy(input) {
  const errors = [];
  const base = defaultResponsePolicy();
  const policy = {
    ...base,
    ...(input && typeof input === 'object' ? input : {}),
    strategies: { ...base.strategies, ...(input?.strategies || {}) },
    thresholds: { ...base.thresholds, ...(input?.thresholds || {}) },
    phrases: { ...base.phrases, ...(input?.phrases || {}) },
  };

  if (typeof policy.enabled !== 'boolean') {
    errors.push({ field: 'enabled', message: 'enabled deve ser boolean' });
  }
  if (typeof policy.preserveOriginalAnswerOnAnswer !== 'boolean') {
    errors.push({
      field: 'preserveOriginalAnswerOnAnswer',
      message: 'preserveOriginalAnswerOnAnswer deve ser boolean',
    });
  }

  for (const [k, v] of Object.entries(policy.strategies || {})) {
    if (!RESPONSE_POLICY_STRATEGIES.includes(k)) {
      errors.push({ field: `strategies.${k}`, message: 'estratégia não permitida' });
    } else if (typeof v !== 'boolean') {
      errors.push({ field: `strategies.${k}`, message: 'deve ser boolean' });
    }
  }

  for (const [k, v] of Object.entries(policy.thresholds || {})) {
    if (typeof v === 'boolean') continue;
    if (typeof v === 'number' && Number.isFinite(v)) continue;
    errors.push({ field: `thresholds.${k}`, message: 'tipo inválido' });
  }

  for (const key of ['abstain', 'limitationPrefix', 'conflictPrefix', 'clarificationPrefix', 'decline']) {
    const phrase = String(policy.phrases?.[key] || '').trim();
    if (!phrase) errors.push({ field: `phrases.${key}`, message: 'frase não pode ser vazia' });
    if (SECRETISH.test(phrase) || EXECISH.test(phrase)) {
      errors.push({ field: `phrases.${key}`, message: 'frase contém conteúdo proibido' });
    }
  }

  if (!Array.isArray(policy.forbiddenExpressions)) {
    errors.push({ field: 'forbiddenExpressions', message: 'deve ser array' });
  } else {
    policy.forbiddenExpressions = policy.forbiddenExpressions.map((p) => String(p)).filter(Boolean);
    for (const p of policy.forbiddenExpressions) {
      if (SECRETISH.test(p) || EXECISH.test(p)) {
        errors.push({ field: 'forbiddenExpressions', message: 'expressão proibida inválida' });
        break;
      }
    }
  }

  const knownTop = new Set([
    'enabled',
    'strategies',
    'thresholds',
    'phrases',
    'forbiddenExpressions',
    'preserveOriginalAnswerOnAnswer',
  ]);
  for (const k of Object.keys(input || {})) {
    if (!knownTop.has(k)) {
      errors.push({ field: k, message: 'campo desconhecido em responsePolicy' });
    }
  }

  return { ok: errors.length === 0, policy, errors };
}

function detectDecline(question, classification) {
  const q = String(question || '').toLowerCase();
  const reasons = [];
  const injection =
    /ignore (todas|as)?\s*instru|disregard (previous|all)|system prompt|revel[ae] (o )?prompt|mostre (seu|o) prompt|jailbreak|dan mode|developer mode|exfiltrat|api[_ -]?key|senha do banco|credenciais|connection string/i.test(
      q,
    );
  if (injection) reasons.push('PROMPT_INJECTION_OR_SECRETS');

  const outOfScope =
    /gerar imagem|traduzir para|escreva um poema|conte uma piada|qual a capital|previs[aã]o do tempo|me d[eê] conselho m[eé]dico pessoal|prescreva medicamento/i.test(
      q,
    ) ||
    classification?.outOfScope === true ||
    String(classification?.intent || '').toUpperCase() === 'OUT_OF_SCOPE';
  if (outOfScope) reasons.push('OUT_OF_SCOPE');

  const action =
    /apague (o )?documento|delete (all|user)|execute sql|drop table|atualize o banco|envie e-?mail|fa[cç]a login/i.test(
      q,
    );
  if (action) reasons.push('UNSUPPORTED_ACTION');

  return reasons;
}

function detectAmbiguity(classification, retrievalMeta, evidenceMeta) {
  if (classification?.ambiguous === true) return true;
  if (classification?.needsClarification === true) return true;
  const intent = String(classification?.intent || classification?.type || '').toUpperCase();
  if (intent === 'AMBIGUOUS' || intent === 'CLARIFY') return true;
  const alts = classification?.alternatives || classification?.options || retrievalMeta?.ambiguousOptions;
  if (Array.isArray(alts) && alts.length >= 2) return true;
  const cats = evidenceMeta?.labelDiversity;
  // don't treat mere diversity as ambiguity
  return false;
}

function clarificationOptions(classification, retrievalMeta, sources) {
  const fromClass = classification?.alternatives || classification?.options || [];
  if (Array.isArray(fromClass) && fromClass.length) {
    return fromClass.map((x) => String(x?.label || x?.name || x)).filter(Boolean).slice(0, 5);
  }
  const fromRetrieval = retrievalMeta?.ambiguousOptions || retrievalMeta?.candidateCategories || [];
  if (Array.isArray(fromRetrieval) && fromRetrieval.length) {
    return fromRetrieval.map((x) => String(x?.name || x?.label || x)).filter(Boolean).slice(0, 5);
  }
  const cats = [
    ...new Set(
      (sources || [])
        .map((s) => s.categoryName || s.subcategoryName)
        .filter(Boolean)
        .map(String),
    ),
  ];
  return cats.slice(0, 5);
}

function sanitizeAnswerText(answer, forbiddenExpressions) {
  let text = String(answer || '');
  for (const expr of forbiddenExpressions || []) {
    if (!expr) continue;
    const re = new RegExp(expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    text = text.replace(re, '');
  }
  return text.replace(/\s{2,}/g, ' ').trim();
}

function dedupeSources(sources) {
  const seen = new Set();
  const out = [];
  for (const s of sources || []) {
    const id = String(s.documentId || s.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      index: out.length + 1,
      documentId: id,
      documentTitle: s.documentTitle || s.title || null,
      sectorName: s.sectorName || null,
      categoryName: s.categoryName || null,
      subcategoryName: s.subcategoryName || null,
      ocrGrade: s.ocrGrade || s.ocrQualityGrade || null,
      sourceType: s.sourceType || null,
      vigente: s.vigente,
      evidenceScore: s.evidenceScore ?? null,
      expirationDate: s.expirationDate || s.expiration || null,
    });
  }
  return out;
}

function publicSourcesForStrategy(strategy, sources, responseMeta) {
  if (strategy === 'DECLINE') return [];
  if (strategy === 'ABSTAIN') return [];
  const list = dedupeSources(sources);
  if (strategy === 'ANSWER_WITH_LIMITATION' || strategy === 'ANSWER_WITH_WARNING') {
    return list.filter((s) => (Number(s.evidenceScore) || 0) >= 40 || list.length <= 2);
  }
  if (responseMeta?.flags?.expiredSource) {
    // keep but do not invent
  }
  return list;
}

/**
 * Deterministic response policy — consolidates final user-facing answer.
 * Consumes responseMeta/evidenceMeta/contextMeta; does not re-detect conflicts.
 */
export function applyResponsePolicy(input, configuration = {}) {
  const t0 = Date.now();
  const cfg = { ...defaultResponseQualityConfig(), ...(configuration || {}) };
  const policy = defaultResponsePolicy(cfg.responsePolicy || {});
  const answerOriginal = String(input.answer ?? '');
  const question = String(input.question ?? '');
  const sources = Array.isArray(input.sources) ? input.sources : [];
  const classification = input.classification || {};
  const responseMeta = input.responseMeta || {};
  const evidenceMeta = input.evidenceMeta || {};
  const contextMeta = input.contextMeta || {};
  const retrievalMeta = input.retrievalMeta || {};
  const configVersion = input.configVersion || cfg.notes || 'response-quality-v1';

  const baseMeta = {
    strategy: 'ANSWER',
    reasonCodes: [],
    warningApplied: false,
    answerModified: false,
    clarificationRequired: false,
    abstained: false,
    declined: false,
    durationMs: 0,
    configVersion,
    enabled: !!policy.enabled,
  };

  if (!policy.enabled) {
    return {
      answer: answerOriginal,
      sources: dedupeSources(sources),
      policyMeta: {
        ...baseMeta,
        strategy: 'ANSWER',
        reasonCodes: ['POLICY_DISABLED_PASSTHROUGH'],
        durationMs: Date.now() - t0,
        skipped: true,
      },
      auditAction: 'AI_RESPONSE_POLICY_APPLIED',
    };
  }

  const reasonCodes = [];
  let strategy = 'ANSWER';

  const declineReasons = detectDecline(question, classification);
  if (declineReasons.length && policy.strategies.DECLINE !== false) {
    strategy = 'DECLINE';
    reasonCodes.push(...declineReasons);
  }

  const insufficient =
    !!(contextMeta.insufficientContext || contextMeta.fallbackUsed || responseMeta.insufficientContext) ||
    (Number(evidenceMeta.evidenceCount || sources.length) === 0 && !answerOriginal.trim());
  const emptySources = dedupeSources(sources).length === 0;
  const grade = String(responseMeta.qualityGrade || '').toUpperCase();
  const confidence = String(responseMeta.confidence || evidenceMeta.confidence || '').toUpperCase();
  const conflictDetected = !!(
    responseMeta.conflictDetected ||
    evidenceMeta.conflictDetected ||
    contextMeta.conflictDetected
  );
  const conflictType = String(
    evidenceMeta.conflictType || contextMeta.conflictType || responseMeta.conflictType || '',
  ).toUpperCase();
  const coverage = Number(
    responseMeta.sourceCoverage ?? responseMeta.evidenceCoverage ?? evidenceMeta.evidenceCoverage ?? 0,
  );

  if (strategy === 'ANSWER') {
    if (
      (insufficient || (emptySources && (grade === 'POOR' || !answerOriginal.trim()))) &&
      policy.strategies.ABSTAIN !== false
    ) {
      strategy = 'ABSTAIN';
      if (insufficient) reasonCodes.push('INSUFFICIENT_CONTEXT');
      if (emptySources) reasonCodes.push('NO_SOURCES');
      if (!answerOriginal.trim()) reasonCodes.push('EMPTY_ANSWER');
      if (grade === 'POOR') reasonCodes.push('QUALITY_POOR');
    } else if (
      grade === 'POOR' &&
      emptySources &&
      policy.thresholds.poorGradeAbstainWithoutSources !== false &&
      policy.strategies.ABSTAIN !== false
    ) {
      strategy = 'ABSTAIN';
      reasonCodes.push('QUALITY_POOR', 'NO_SOURCES');
    }
  }

  if (strategy === 'ANSWER' && detectAmbiguity(classification, retrievalMeta, evidenceMeta)) {
    const opts = clarificationOptions(classification, retrievalMeta, sources);
    if (opts.length >= 2 && policy.thresholds.ambiguousRequiresClarification !== false && policy.strategies.REQUEST_CLARIFICATION !== false) {
      strategy = 'REQUEST_CLARIFICATION';
      reasonCodes.push('AMBIGUOUS_QUESTION');
    }
  }

  if (strategy === 'ANSWER' && conflictDetected) {
    const confirmed = conflictType.includes('CONFIRMED') || conflictType === 'CONFIRMED_CONFLICT';
    const potential = conflictType.includes('POTENTIAL') || conflictType === 'POTENTIAL_CONFLICT';
    if (
      (confirmed && policy.thresholds.conflictRequiresWarning !== false) ||
      (potential && policy.thresholds.potentialConflictRequiresWarning !== false) ||
      (!conflictType && policy.thresholds.conflictRequiresWarning !== false)
    ) {
      if (policy.strategies.ANSWER_WITH_WARNING !== false) {
        strategy = 'ANSWER_WITH_WARNING';
        reasonCodes.push(confirmed ? 'CONFIRMED_CONFLICT' : 'POTENTIAL_CONFLICT');
      }
    }
  }

  if (strategy === 'ANSWER') {
    const lowConf =
      confidence === 'LOW' ||
      responseMeta.flags?.lowCoverage ||
      coverage < Number(policy.thresholds.minCoverageForAnswer ?? 0.35);
    const lowGrade = grade === 'LOW' || grade === 'POOR';
    if (
      (lowGrade && policy.thresholds.lowGradeLimitation !== false) ||
      (confidence === 'LOW' && policy.thresholds.lowConfidenceLimitation !== false) ||
      (lowConf && lowGrade)
    ) {
      if (emptySources && policy.strategies.ABSTAIN !== false) {
        strategy = 'ABSTAIN';
        reasonCodes.push('LOW_CONFIDENCE_NO_SOURCES');
      } else if (policy.strategies.ANSWER_WITH_LIMITATION !== false) {
        strategy = 'ANSWER_WITH_LIMITATION';
        if (lowGrade) reasonCodes.push(`QUALITY_${grade || 'LOW'}`);
        if (confidence === 'LOW') reasonCodes.push('EVIDENCE_CONFIDENCE_LOW');
        if (coverage < Number(policy.thresholds.minCoverageForAnswer ?? 0.35)) {
          reasonCodes.push('LOW_COVERAGE');
        }
      }
    }
  }

  if (strategy === 'ANSWER' && responseMeta.hallucinationSuspected && emptySources) {
    strategy = policy.strategies.ABSTAIN !== false ? 'ABSTAIN' : 'ANSWER_WITH_LIMITATION';
    reasonCodes.push('HALLUCINATION_SUSPECTED');
  }

  if (strategy === 'ANSWER' && policy.strategies.ANSWER === false) {
    strategy = 'ABSTAIN';
    reasonCodes.push('ANSWER_DISABLED');
  }

  let answer = answerOriginal;
  let answerModified = false;
  const phrases = policy.phrases;

  if (strategy === 'DECLINE') {
    answer = phrases.decline;
    answerModified = true;
  } else if (strategy === 'ABSTAIN') {
    answer = phrases.abstain;
    answerModified = true;
  } else if (strategy === 'REQUEST_CLARIFICATION') {
    const opts = clarificationOptions(classification, retrievalMeta, sources);
    const optsText = opts.length
      ? opts.map((o, i) => `${i + 1}) ${o}`).join('; ')
      : 'o setor, a categoria ou o documento de interesse';
    answer = `${phrases.clarificationPrefix} ${optsText}.`;
    answerModified = true;
  } else if (strategy === 'ANSWER_WITH_WARNING') {
    const body =
      policy.preserveOriginalAnswerOnAnswer !== false
        ? sanitizeAnswerText(answerOriginal, policy.forbiddenExpressions)
        : sanitizeAnswerText(answerOriginal, policy.forbiddenExpressions);
    answer = `${phrases.conflictPrefix}\n\n${body}`.trim();
    answerModified = answer !== answerOriginal;
  } else if (strategy === 'ANSWER_WITH_LIMITATION') {
    const body = sanitizeAnswerText(answerOriginal, policy.forbiddenExpressions);
    answer = `${phrases.limitationPrefix}\n\n${body}`.trim();
    answerModified = answer !== answerOriginal;
  } else {
    // ANSWER
    if (policy.preserveOriginalAnswerOnAnswer !== false) {
      answer = answerOriginal;
      answerModified = false;
    } else {
      answer = sanitizeAnswerText(answerOriginal, policy.forbiddenExpressions);
      answerModified = answer !== answerOriginal;
    }
  }

  const finalSources = publicSourcesForStrategy(strategy, sources, responseMeta);

  const policyMeta = {
    strategy,
    reasonCodes: [...new Set(reasonCodes)],
    warningApplied: strategy === 'ANSWER_WITH_WARNING',
    answerModified,
    clarificationRequired: strategy === 'REQUEST_CLARIFICATION',
    abstained: strategy === 'ABSTAIN',
    declined: strategy === 'DECLINE',
    durationMs: Date.now() - t0,
    configVersion,
    enabled: true,
    conflictType: conflictType || null,
    preferredDocumentId:
      evidenceMeta.preferredDocumentId ||
      evidenceMeta.preferredEvidence?.documentId ||
      contextMeta.preferredDocumentId ||
      null,
  };

  let auditAction = 'AI_RESPONSE_POLICY_APPLIED';
  if (strategy === 'DECLINE') auditAction = 'AI_RESPONSE_POLICY_DECLINE';
  else if (strategy === 'ABSTAIN') auditAction = 'AI_RESPONSE_POLICY_ABSTAIN';
  else if (strategy === 'REQUEST_CLARIFICATION') auditAction = 'AI_RESPONSE_POLICY_CLARIFICATION';
  else if (strategy === 'ANSWER_WITH_WARNING') auditAction = 'AI_RESPONSE_POLICY_WARNING';
  else if (strategy === 'ANSWER_WITH_LIMITATION') auditAction = 'AI_RESPONSE_POLICY_LIMITATION';

  return { answer, sources: finalSources, policyMeta, auditAction };
}
