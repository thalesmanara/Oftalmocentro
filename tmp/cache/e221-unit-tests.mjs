#!/usr/bin/env node
/**
 * Etapa 22.1 — unit tests for fingerprint v2 + eligibility + TTL + agreement.
 */
import assert from 'assert';
import {
  buildSourceFingerprintV2,
  computeEffectiveTtl,
  evaluateEligibility,
  classifyShadowComparison,
  detectSensitive,
  canonicalJson,
} from './cache-helpers.mjs';

const docsA = [
  {
    documentId: 'a',
    documentVersionId: 'v1',
    versionNumber: 1,
    contentHash: 'h1',
    isCurrent: true,
    chunks: [
      { chunkId: 'c2', contentHash: 'ch2' },
      { chunkId: 'c1', contentHash: 'ch1' },
    ],
  },
  {
    documentId: 'b',
    documentVersionId: 'v2',
    versionNumber: 2,
    contentHash: 'h2',
    isCurrent: true,
    ocrQualityGrade: 'A',
    chunks: [],
  },
];

const docsB = [
  docsA[1],
  {
    ...docsA[0],
    chunks: [
      { chunkId: 'c1', contentHash: 'ch1' },
      { chunkId: 'c2', contentHash: 'ch2' },
    ],
  },
];

const fp1 = buildSourceFingerprintV2(docsA);
const fp2 = buildSourceFingerprintV2(docsB);
assert.strictEqual(fp1.sourceFingerprint, fp2.sourceFingerprint, 'order independence');
assert.strictEqual(fp1.sourceFingerprintVersion, 'source-fingerprint-v2');

const docsChanged = structuredClone(docsA);
docsChanged[0].contentHash = 'CHANGED';
const fp3 = buildSourceFingerprintV2(docsChanged);
assert.notStrictEqual(fp1.sourceFingerprint, fp3.sourceFingerprint, 'content change');

const docsOcr = structuredClone(docsA);
docsOcr[1].ocrQualityGrade = 'C';
assert.notStrictEqual(
  fp1.sourceFingerprint,
  buildSourceFingerprintV2(docsOcr).sourceFingerprint,
  'ocr change',
);

assert.ok(detectSensitive('qual o cpf 123.456.789-09 do paciente?'));
assert.ok(detectSensitive('CRM-MG 12345 do medico'));
assert.ok(detectSensitive('CRM 98765'));
assert.ok(!detectSensitive('qual o protocolo de esterilizacao?'));

const elig = evaluateEligibility({
  answer: 'ok',
  sensitive: false,
  conflictDetected: false,
  insufficientContext: false,
  fallbackUsed: false,
  sourceFingerprint: fp1.sourceFingerprint,
  documentVersionIds: fp1.documentVersionIds,
  nearestSourceExpiration: null,
});
assert.ok(elig.eligible);

const sens = evaluateEligibility({
  answer: 'ok',
  sensitive: true,
  conflictDetected: false,
  insufficientContext: false,
  fallbackUsed: false,
  sourceFingerprint: fp1.sourceFingerprint,
  documentVersionIds: fp1.documentVersionIds,
});
assert.ok(!sens.eligible);
assert.ok(sens.reasonCodes.includes('SENSITIVE_QUERY'));

const ttl = computeEffectiveTtl({
  ttlSeconds: 86400,
  nearestSourceExpiration: new Date(Date.now() + 3600 * 1000).toISOString(),
  hasTabular: true,
});
assert.ok(ttl.effectiveTtlSeconds <= 3600);
assert.ok(['TABULAR_6H', 'SOURCE_EXPIRATION'].includes(ttl.ttlPolicy));

const safe = classifyShadowComparison({
  liveAnswer: 'O prazo e 30 dias.',
  cachedAnswer: 'O prazo e 30 dias.',
  liveSources: [{ documentId: 'a' }],
  cachedSources: [{ documentId: 'a' }],
});
assert.strictEqual(safe.classification, 'SAFE_MATCH');

const crit = classifyShadowComparison({
  liveAnswer: 'Valor R$ 10,00',
  cachedAnswer: 'Valor R$ 99,00',
  liveSources: [{ documentId: 'a' }],
  cachedSources: [{ documentId: 'a' }],
});
assert.ok(crit.critical || crit.falseHit);

// canonical stability
assert.strictEqual(canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }));

console.log('OK fingerprint/eligibility/ttl/agreement unit tests passed');
