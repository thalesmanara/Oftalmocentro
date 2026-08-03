/**
 * Shared deterministic cache helpers used inside n8n Code nodes.
 * Also imported by Node test scripts.
 */
import { createHash } from 'crypto';

export const CACHE_SCHEMA_VERSION = 'v1';

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
  let q = String(raw || '').normalize('NFKC').trim().toLowerCase();
  q = q.replace(/[?!.,;:]+$/g, '');
  q = q.replace(/\s+/g, ' ');
  // keep digits/identifiers intact; strip light punctuation except -./@
  q = q.replace(/[^\p{L}\p{N}\s\-./@]/gu, ' ');
  q = q.replace(/\s+/g, ' ').trim();
  return q;
}

export function detectSensitive(question) {
  const q = String(question || '');
  const patterns = [
    /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF
    /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, // CNPJ
    /\bCRM[-\s]?\d{2,}/i,
    /\bCOREN[-\s]?\d{2,}/i,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/,
    /\bprontu[aá]rio\b/i,
    /\bsal[aá]rio\b/i,
    /\bremunera/i,
  ];
  return patterns.some((p) => p.test(q));
}

export function redactQuestion(q) {
  return String(q || '')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}\b/g, '[PHONE]');
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

export function buildSourceFingerprint(docs) {
  const list = (Array.isArray(docs) ? docs : [])
    .map((d) => ({
      documentId: String(d.documentId || d.document_id || d.id || ''),
      documentVersionId: String(d.documentVersionId || d.document_version_id || d.versionId || ''),
      versionNumber: d.versionNumber ?? d.version_number ?? null,
      contentHash: String(d.contentHash || d.content_hash || ''),
      updatedAt: d.updatedAt || d.updated_at || null,
      isCurrent: d.isCurrent ?? d.is_current ?? true,
      expirationDate: d.expirationDate || d.expiration_date || null,
    }))
    .filter((d) => d.documentId)
    .sort((a, b) =>
      `${a.documentId}:${a.documentVersionId}`.localeCompare(`${b.documentId}:${b.documentVersionId}`),
    );
  return sha256(canonicalJson(list));
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

export function answersAgree(a, b) {
  const na = normalizeAnswer(a);
  const nb = normalizeAnswer(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // soft: one contains the other and length ratio ok
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
      if (!Number.isFinite(v) || v < 1 || String(cfg[n]).trim() === String(cfg[n]) && typeof cfg[n] === 'string') {
        // reject string numbers
      }
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
