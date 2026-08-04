#!/usr/bin/env node
/**
 * Shared deterministic cache helpers — Etapa 22.1
 */
import { createHash } from 'crypto';

export const CACHE_SCHEMA_VERSION = 'v1';
export const SOURCE_FINGERPRINT_VERSION = 'source-fingerprint-v2';

export function sha256(input) {
  return createHash('sha256').update(String(input), 'utf8').digest('hex');
}

export function canonicalJson(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
}

export function normalizeQuestion(raw) {
  let q = String(raw || '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .normalize('NFKC')
    .trim()
    .toLowerCase();
  q = q.replace(/[?!.,;:]+$/g, '');
  q = q.replace(/\s+/g, ' ');
  q = q.replace(/[^\p{L}\p{N}\s\-./@]/gu, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  return q;
}

export function detectSensitive(question) {
  const q = String(question || '');
  const patterns = [
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
    /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/,
    /\bCRM[-\s]?[A-Z]{0,2}[-\s]?\d{2,}/i,
    /\bCOREN[-\s]?[A-Z]{0,2}[-\s]?\d{2,}/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/,
    /\bprontu[aá]rio\b/i,
    /\bmatr[ií]cula\b/i,
    /\bsal[aá]rio\b/i,
    /\bremunera/i,
    /\bfuncion[aá]rio\b.*\b(cpf|crm|matricula)/i,
    /\b(cpf|crm|matr[ií]cula)\b.*\bfuncion[aá]rio\b/i,
  ];
  return patterns.some((p) => p.test(q));
}

export function redactQuestion(q) {
  return String(q || '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[CNPJ]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, '[PHONE]')
    .replace(/\bCRM[-\s]?\d{2,}/gi, '[CRM]');
}

export function buildScopeHash({ isMaster, permissions, sectorId, environment }) {
  const perms = [...new Set((permissions || []).map((p) => String(p).toLowerCase()))].sort();
  return sha256(
    canonicalJson({
      isMaster: !!isMaster,
      permissions: perms,
      sectorId: sectorId || null,
      environment: environment || 'production',
      scopeMode: 'PERMISSION_SET',
    }),
  );
}

/** Normalize a document/version snapshot for fingerprint v2 */
export function normalizeDocSnapshot(d) {
  const chunks = (Array.isArray(d.chunks) ? d.chunks : [])
    .map((c) => ({
      chunkId: String(c.chunkId || c.chunk_id || c.id || ''),
      contentHash: String(c.contentHash || c.content_hash || ''),
    }))
    .filter((c) => c.chunkId)
    .sort((a, b) => a.chunkId.localeCompare(b.chunkId));
  return {
    documentId: String(d.documentId || d.document_id || d.id || ''),
    documentVersionId: String(d.documentVersionId || d.document_version_id || d.versionId || ''),
    versionNumber: d.versionNumber ?? d.version_number ?? null,
    contentHash: String(d.contentHash || d.content_hash || d.checksum || ''),
    updatedAt: d.updatedAt || d.updated_at || null,
    expirationDate: d.expirationDate || d.expiration_date || null,
    isCurrent: d.isCurrent ?? d.is_current ?? true,
    processingStatus: d.processingStatus || d.processing_status || null,
    validationStatus: d.validationStatus || d.validation_status || null,
    ocrExtractionMethod: d.ocrExtractionMethod || d.extraction_method || d.ocr_engine || null,
    ocrQualityGrade: d.ocrQualityGrade || d.ocr_quality_grade || null,
    ocrStatus: d.ocrStatus || d.ocr_status || null,
    tabularProcessingVersion: d.tabularProcessingVersion || d.table_summary || null,
    tableRowCount: d.tableRowCount ?? d.table_row_count ?? null,
    tableColumnCount: d.tableColumnCount ?? d.table_column_count ?? null,
    embeddingModel: d.embeddingModel || d.embedding_model || null,
    embeddingStatus: d.embeddingStatus || d.embedding_status || null,
    qdrantSyncStatus: d.qdrantSyncStatus || d.qdrant_sync_status || null,
    qdrantSyncedCount: d.qdrantSyncedCount ?? d.qdrant_synced_count ?? null,
    includedChunkIds: chunks.map((c) => c.chunkId),
    chunkHashes: chunks.map((c) => ({ chunkId: c.chunkId, contentHash: c.contentHash })),
  };
}

export function buildSourceFingerprintV2(docs) {
  const list = (Array.isArray(docs) ? docs : [])
    .map(normalizeDocSnapshot)
    .filter((d) => d.documentId)
    .sort((a, b) =>
      `${a.documentId}:${a.documentVersionId}`.localeCompare(`${b.documentId}:${b.documentVersionId}`),
    );
  const payload = {
    schemaVersion: SOURCE_FINGERPRINT_VERSION,
    documents: list,
  };
  return {
    sourceFingerprint: sha256(canonicalJson(payload)),
    sourceFingerprintVersion: SOURCE_FINGERPRINT_VERSION,
    fingerprintPayload: payload,
    documentVersionIds: list.map((d) => d.documentVersionId).filter(Boolean),
    sourceDocumentIds: list.map((d) => d.documentId).filter(Boolean),
    nearestSourceExpiration: list
      .map((d) => d.expirationDate)
      .filter(Boolean)
      .sort()[0] || null,
  };
}

/** Legacy alias */
export function buildSourceFingerprint(docs) {
  return buildSourceFingerprintV2(docs).sourceFingerprint;
}

export function buildCacheKeyHash(parts) {
  return sha256(
    canonicalJson({
      cacheSchemaVersion: CACHE_SCHEMA_VERSION,
      normalizedQuestion: parts.normalizedQuestion,
      questionType: parts.questionType || null,
      classification: parts.classification || null,
      scopeHash: parts.scopeHash,
      promptVersionId: parts.promptVersionId,
      promptContentHash: parts.promptContentHash || parts.promptHash,
      retrievalConfigVersionId: parts.retrievalConfigVersionId || null,
      retrievalConfigHash: parts.retrievalConfigHash || null,
      contextConfigVersionId: parts.contextConfigVersionId || null,
      contextConfigHash: parts.contextConfigHash || null,
      modelName: parts.modelName,
      modelParametersHash: parts.modelParametersHash || '',
      sourceFingerprint: parts.sourceFingerprint,
      systemVersion: parts.systemVersion || 'oftalmocentro-v1',
    }),
  );
}

export function normalizeAnswer(a) {
  return String(a || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function extractIdentifiers(text) {
  const t = String(text || '');
  const ids = [];
  const cpf = t.match(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g);
  if (cpf) ids.push(...cpf);
  const nums = t.match(/\b\d{1,3}(?:\.\d{3})*(?:,\d{2})?\b/g);
  if (nums) ids.push(...nums.slice(0, 20));
  const dates = t.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g);
  if (dates) ids.push(...dates);
  const money = t.match(/R\$\s*\d[\d.,]*/gi);
  if (money) ids.push(...money);
  return [...new Set(ids.map((x) => x.toLowerCase()))].sort();
}

export function answersAgree(a, b) {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length > nb.length ? na : nb;
  if (longer.includes(shorter) && shorter.length / longer.length >= 0.85) return true;
  return false;
}

export function sourcesAgree(a, b) {
  const idsA = new Set(
    (Array.isArray(a) ? a : []).map((s) => String(s.documentId || s.document_id || s.id || '')).filter(Boolean),
  );
  const idsB = new Set(
    (Array.isArray(b) ? b : []).map((s) => String(s.documentId || s.document_id || s.id || '')).filter(Boolean),
  );
  if (!idsA.size && !idsB.size) return true;
  if (!idsA.size || !idsB.size) return false;
  let inter = 0;
  for (const id of idsA) if (idsB.has(id)) inter++;
  const union = new Set([...idsA, ...idsB]).size;
  return inter / union >= 0.8;
}

export function classifyShadowComparison({
  liveAnswer,
  cachedAnswer,
  liveSources,
  cachedSources,
  fingerprintValid = true,
  scopeMatched = true,
  conflictDetected = false,
}) {
  if (!fingerprintValid) {
    return { classification: 'FALSE_HIT', falseHit: true, critical: false, reason: 'SOURCE_FINGERPRINT_INVALID' };
  }
  if (!scopeMatched) {
    return { classification: 'FALSE_HIT', falseHit: true, critical: true, reason: 'SCOPE_MISMATCH' };
  }
  if (conflictDetected) {
    return { classification: 'FALSE_HIT', falseHit: true, critical: true, reason: 'CONFLICT_NOT_REPRESENTED' };
  }

  const ansOk = answersAgree(liveAnswer, cachedAnswer);
  const srcOk = sourcesAgree(liveSources, cachedSources);
  const liveIds = extractIdentifiers(liveAnswer);
  const cachedIds = extractIdentifiers(cachedAnswer);
  const idMismatch =
    liveIds.length &&
    cachedIds.length &&
    liveIds.some((id) => !cachedIds.includes(id)) &&
    cachedIds.some((id) => !liveIds.includes(id));

  const liveAbstain = /n[aã]o (encontrei|localizei|possui)|sem evid[eê]ncia|insufficient/i.test(
    String(liveAnswer || ''),
  );
  const cachedAbstain = /n[aã]o (encontrei|localizei|possui)|sem evid[eê]ncia|insufficient/i.test(
    String(cachedAnswer || ''),
  );
  if (liveAbstain !== cachedAbstain) {
    return {
      classification: 'CRITICAL_FALSE_HIT',
      falseHit: true,
      critical: true,
      reason: 'ABSTENTION_MISMATCH',
      answerAgreement: ansOk,
      sourceAgreement: srcOk,
    };
  }
  if (idMismatch) {
    return {
      classification: 'CRITICAL_FALSE_HIT',
      falseHit: true,
      critical: true,
      reason: 'IDENTIFIER_DIVERGENCE',
      answerAgreement: ansOk,
      sourceAgreement: srcOk,
    };
  }
  if (!srcOk) {
    return {
      classification: 'FALSE_HIT',
      falseHit: true,
      critical: false,
      reason: 'SOURCE_MISMATCH',
      answerAgreement: ansOk,
      sourceAgreement: false,
    };
  }
  if (!ansOk) {
    return {
      classification: 'NON_CRITICAL_DIVERGENCE',
      falseHit: false,
      critical: false,
      reason: 'ANSWER_TEXT_DIVERGENCE',
      answerAgreement: false,
      sourceAgreement: true,
    };
  }
  return {
    classification: 'SAFE_MATCH',
    falseHit: false,
    critical: false,
    reason: null,
    answerAgreement: true,
    sourceAgreement: true,
  };
}

export function evaluateEligibility({
  answer,
  sensitive,
  conflictDetected,
  insufficientContext,
  fallbackUsed,
  sourceFingerprint,
  documentVersionIds,
  nearestSourceExpiration,
  cacheNegativeAnswers = false,
}) {
  const reasonCodes = [];
  if (!answer || !String(answer).trim()) reasonCodes.push('EMPTY_ANSWER');
  if (sensitive) reasonCodes.push('SENSITIVE_QUERY');
  if (conflictDetected) reasonCodes.push('CONFLICT');
  if (insufficientContext) reasonCodes.push('INSUFFICIENT_CONTEXT');
  if (fallbackUsed) reasonCodes.push('FALLBACK');
  if (!sourceFingerprint) reasonCodes.push('FINGERPRINT_MISSING');
  if (!documentVersionIds || !documentVersionIds.length) reasonCodes.push('DEPENDENCIES_INCOMPLETE');
  if (nearestSourceExpiration && new Date(nearestSourceExpiration).getTime() <= Date.now()) {
    reasonCodes.push('DOCUMENT_EXPIRED');
  }
  const neg = /n[aã]o (encontrei|localizei|há informa)|sem resultados/i.test(String(answer || ''));
  if (neg && !cacheNegativeAnswers) reasonCodes.push('NEGATIVE_ANSWER');

  return {
    eligible: reasonCodes.length === 0,
    reasonCodes,
    containsSensitiveData: !!sensitive,
    scopeMode: 'PERMISSION_SET',
  };
}

export function computeEffectiveTtl({
  ttlSeconds = 86400,
  nearestSourceExpiration = null,
  hasTabular = false,
  hasFinancial = false,
  hasRhIndividual = false,
}) {
  if (hasFinancial || hasRhIndividual) {
    return {
      ttlPolicy: hasFinancial ? 'FINANCIAL_NO_CACHE' : 'RH_NO_CACHE',
      effectiveTtlSeconds: 0,
      nearestSourceExpiration,
    };
  }
  let effective = Number(ttlSeconds) || 86400;
  let ttlPolicy = 'CONFIG_TTL';
  if (hasTabular) {
    effective = Math.min(effective, 6 * 3600);
    ttlPolicy = 'TABULAR_6H';
  } else {
    effective = Math.min(effective, 24 * 3600);
    ttlPolicy = 'INSTITUTIONAL_24H';
  }
  if (nearestSourceExpiration) {
    const remaining = Math.floor((new Date(nearestSourceExpiration).getTime() - Date.now()) / 1000);
    if (remaining <= 0) {
      return { ttlPolicy: 'SOURCE_EXPIRED', effectiveTtlSeconds: 0, nearestSourceExpiration };
    }
    if (remaining < effective) {
      effective = remaining;
      ttlPolicy = 'SOURCE_EXPIRATION';
    }
  }
  return {
    ttlPolicy,
    effectiveTtlSeconds: Math.max(0, effective),
    nearestSourceExpiration,
  };
}

export function defaultCacheConfig() {
  return {
    mode: 'SHADOW',
    exactEnabled: true,
    normalizedEnabled: true,
    semanticEnabled: false,
    semanticThreshold: 0.92,
    ttlSeconds: 86400,
    maxEntries: 5000,
    maxEntriesPerScope: 500,
    cacheNegativeAnswers: false,
    cacheInsufficientContext: false,
    cacheConflictResponses: false,
    cacheSensitiveQueries: false,
    requireSameSources: true,
    requireSameDocumentVersions: true,
    requireSamePromptVersion: true,
    requireSameRetrievalVersion: true,
    requireSameContextVersion: true,
    requireSameModel: true,
    scopeMode: 'PERMISSION_SET',
    cacheSchemaVersion: CACHE_SCHEMA_VERSION,
    qdrantCollection: 'oftalmocentro_query_cache',
  };
}

export function validateCacheConfiguration(raw) {
  const errors = [];
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const modes = ['DISABLED', 'SHADOW', 'EXACT_ONLY', 'NORMALIZED', 'SEMANTIC'];
  const mode = String(cfg.mode || '').toUpperCase();
  if (!modes.includes(mode)) errors.push({ field: 'mode', message: 'mode inválido' });
  const ttl = Number(cfg.ttlSeconds);
  if (typeof cfg.ttlSeconds === 'string' || !Number.isFinite(ttl) || ttl <= 0) {
    errors.push({ field: 'ttlSeconds', message: 'TTL deve ser número > 0 (não string)' });
  }
  if (ttl > 60 * 60 * 24 * 30) errors.push({ field: 'ttlSeconds', message: 'TTL acima do máximo (30d)' });
  const thr = Number(cfg.semanticThreshold);
  if (cfg.semanticEnabled === true && (!Number.isFinite(thr) || thr < 0.8 || thr > 0.99)) {
    errors.push({ field: 'semanticThreshold', message: 'threshold deve estar entre 0.8 e 0.99' });
  }
  for (const b of [
    'exactEnabled',
    'normalizedEnabled',
    'semanticEnabled',
    'cacheNegativeAnswers',
    'cacheInsufficientContext',
    'cacheConflictResponses',
    'cacheSensitiveQueries',
    'requireSameSources',
    'requireSameDocumentVersions',
    'requireSamePromptVersion',
    'requireSameRetrievalVersion',
    'requireSameContextVersion',
    'requireSameModel',
  ]) {
    if (cfg[b] !== undefined && typeof cfg[b] !== 'boolean') {
      errors.push({ field: b, message: 'deve ser boolean real (não string)' });
    }
  }
  for (const n of ['maxEntries', 'maxEntriesPerScope']) {
    if (cfg[n] !== undefined) {
      const v = Number(cfg[n]);
      if (typeof cfg[n] === 'string' || !Number.isFinite(v) || v < 1) {
        errors.push({ field: n, message: 'deve ser número >= 1' });
      }
    }
  }
  const scopeModes = ['USER', 'PERMISSION_SET', 'SECTOR', 'GLOBAL_SAFE'];
  if (cfg.scopeMode && !scopeModes.includes(String(cfg.scopeMode))) {
    errors.push({ field: 'scopeMode', message: 'scopeMode inválido' });
  }
  if (cfg.cacheSensitiveQueries === true && cfg.scopeMode === 'GLOBAL_SAFE') {
    errors.push({ field: 'cacheSensitiveQueries', message: 'não combine sensível com GLOBAL_SAFE' });
  }
  if (cfg.cacheConflictResponses === true) {
    errors.push({ field: 'cacheConflictResponses', message: 'política conservadora: deve ser false nesta etapa' });
  }
  if (cfg.cacheInsufficientContext === true) {
    errors.push({ field: 'cacheInsufficientContext', message: 'política conservadora: deve ser false nesta etapa' });
  }
  const known = new Set([
    'mode',
    'exactEnabled',
    'normalizedEnabled',
    'semanticEnabled',
    'semanticThreshold',
    'ttlSeconds',
    'maxEntries',
    'maxEntriesPerScope',
    'cacheNegativeAnswers',
    'cacheInsufficientContext',
    'cacheConflictResponses',
    'cacheSensitiveQueries',
    'requireSameSources',
    'requireSameDocumentVersions',
    'requireSamePromptVersion',
    'requireSameRetrievalVersion',
    'requireSameContextVersion',
    'requireSameModel',
    'scopeMode',
    'cacheSchemaVersion',
    'qdrantCollection',
    'notes',
  ]);
  for (const k of Object.keys(cfg)) {
    if (!known.has(k)) errors.push({ field: k, message: 'campo desconhecido' });
  }
  return { ok: errors.length === 0, errors, configuration: { ...defaultCacheConfig(), ...cfg, mode } };
}
