/**
 * Evidence Layer helpers — deterministic score, classification, conflict, redundancy.
 * Used by Node tests and inlined into n8n Code nodes.
 */
import { createHash } from 'crypto';

export const EVIDENCE_SCHEMA_VERSION = 'evidence-schema-v1';

export function sha256(input) {
  return createHash('sha256').update(String(input), 'utf8').digest('hex');
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
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

export function detectSourceType(chunk) {
  const kind = String(chunk.chunkKind || chunk.chunk_kind || '').toLowerCase();
  const sheet = chunk.sheetName || chunk.sheet_name;
  if (sheet || kind.includes('table') || kind.includes('row') || kind.includes('tabular')) return 'tabular';
  const ocr = String(chunk.ocrQualityGrade || chunk.ocrQuality || chunk.ocr_quality_grade || '').toUpperCase();
  const method = String(chunk.extractionMethod || chunk.extraction_method || '').toLowerCase();
  if (ocr || method.includes('ocr')) return 'OCR';
  return 'texto';
}

export function classifyEvidence(chunk, text) {
  const labels = [];
  const t = String(text || chunk.text || chunk.content || '');
  const src = detectSourceType(chunk);
  const cat = String(chunk.categoryName || chunk.category_name || '').toLowerCase();
  const sub = String(chunk.subcategoryName || chunk.subcategory_name || '').toLowerCase();
  const title = String(chunk.documentTitle || chunk.document_title || '').toLowerCase();
  const blob = `${cat} ${sub} ${title} ${t}`.toLowerCase();

  if (src === 'tabular') labels.push('Evidência tabular');
  if (src === 'OCR') labels.push('Evidência OCR');
  if (/n[aã]o (consta|encontr|localiz|h[aá])|sem registro|inexistente|negativ/i.test(t)) {
    labels.push('Evidência negativa');
  } else {
    labels.push('Evidência positiva');
  }
  if (/norma|resolu[cç][aã]o|portaria|regulament|procedimento operacional|pop\b|protocolo/i.test(blob)) {
    labels.push('Evidência normativa');
  }
  if (/opera[cç][aã]o|plant[aã]o|escala|agenda|atendimento|fluxo|processo/i.test(blob)) {
    labels.push('Evidência operacional');
  }
  if (/financeiro|or[cç]amento|fatur|pagamento|sal[aá]rio|remunera|r\$|custos?/i.test(blob)) {
    labels.push('Evidência financeira');
  }
  if (/cl[ií]nic|paciente|prontu[aá]rio|oftalm|cirurg|anamnese|diagn[oó]st/i.test(blob)) {
    labels.push('Evidência clínica');
  }
  return [...new Set(labels)];
}

function numScore(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // accept 0-1 or 0-100
  return n > 1.5 ? clamp(n, 0, 100) : clamp(n * 100, 0, 100);
}

export function computeEvidenceScore(chunk, opts = {}) {
  const retrieval =
    numScore(chunk.hybridScore ?? chunk.hybrid_score ?? chunk.vectorScore ?? chunk.vector_score ?? chunk.textScore) ?? 50;
  const rerank = numScore(chunk.rerankScore ?? chunk.rerank_score ?? chunk.relevance);
  const ocrGrade = String(chunk.ocrQualityGrade || chunk.ocrQuality || '').toUpperCase();
  const src = detectSourceType(chunk);
  const text = String(chunk.text || chunk.content || '');
  const expired =
    chunk.expirationDate || chunk.vigencyDate
      ? new Date(chunk.expirationDate || chunk.vigencyDate).getTime() < Date.now()
      : false;
  const isCurrent = chunk.isCurrent !== false && chunk.currentVersion !== false;
  const conflict = !!(chunk.conflictFlag || chunk.conflictDetected);
  const redundant = !!(chunk.redundant || chunk.isRedundant);

  let score = 0;
  score += retrieval * 0.35;
  score += (rerank != null ? rerank : retrieval) * 0.25;

  // OCR quality
  if (src === 'OCR') {
    if (ocrGrade === 'A' || ocrGrade === 'EXCELLENT') score += 12;
    else if (ocrGrade === 'B' || ocrGrade === 'GOOD') score += 8;
    else if (ocrGrade === 'C' || ocrGrade === 'ACCEPTABLE') score += 4;
    else if (ocrGrade === 'POOR' || ocrGrade === 'FAILED' || ocrGrade === 'MANUAL_REVIEW') score -= 15;
    else score += 2;
  } else {
    score += 8;
  }

  if (src === 'tabular') score += 6;
  if (isCurrent) score += 8;
  else score -= 10;
  if (expired) score -= 25;
  else score += 5;

  const cat = String(chunk.categoryName || '').toLowerCase();
  if (cat) score += 3;
  if (conflict) score -= 12;
  if (redundant) score -= 8;
  if (text.trim().length < 40) score -= 10;
  if (text.trim().length > 200) score += 3;

  if (opts.minEvidenceScore != null && score < Number(opts.minEvidenceScore)) {
    // keep score but mark low
  }

  score = clamp(Math.round(score), 0, 100);
  return {
    evidenceScore: score,
    evidenceGrade: gradeFromScore(score),
    confidence: confidenceFromScore(score),
    sourceType: src,
  };
}

export function overlapRatio(a, b) {
  const ta = String(a || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  const tb = String(b || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!ta.length || !tb.length) return 0;
  const sb = new Set(tb);
  let inter = 0;
  for (const w of ta) if (sb.has(w)) inter++;
  return inter / Math.max(ta.length, tb.length);
}

export function detectRedundancy(evidences, threshold = 0.92) {
  const kept = [];
  let redundancyCount = 0;
  const seenChunk = new Set();
  const seenDocVer = new Set();
  for (const e of evidences) {
    const cid = String(e.chunkId || '');
    const dv = `${e.documentId || ''}:${e.versionId || ''}:${e.chunkId || ''}`;
    if (cid && seenChunk.has(cid)) {
      redundancyCount++;
      e.redundant = true;
      e.redundancyScore = 1;
      continue;
    }
    let dup = false;
    for (const p of kept) {
      if (e.documentId && p.documentId === e.documentId && e.versionId && p.versionId === e.versionId && e.chunkId === p.chunkId) {
        dup = true;
        break;
      }
      const ratio = overlapRatio(e.chunkText, p.chunkText);
      if (ratio >= threshold) {
        dup = true;
        e.redundancyScore = ratio;
        break;
      }
    }
    if (dup) {
      redundancyCount++;
      e.redundant = true;
      continue;
    }
    if (cid) seenChunk.add(cid);
    seenDocVer.add(dv);
    e.redundant = false;
    e.redundancyScore = 0;
    kept.push(e);
  }
  return {
    evidences: kept,
    allWithFlags: [...kept, ...evidences.filter((e) => e.redundant)],
    redundancyCount,
    deduplicatedEvidenceCount: kept.length,
  };
}

export function consolidateConflicts(evidences) {
  const docs = new Map();
  for (const e of evidences) {
    const id = String(e.documentId || '');
    if (!id) continue;
    if (!docs.has(id)) {
      docs.set(id, {
        documentId: id,
        title: e.documentTitle || '',
        vigency: e.expiration || null,
        maxScore: e.evidenceScore || 0,
        texts: [],
      });
    }
    const d = docs.get(id);
    d.maxScore = Math.max(d.maxScore, e.evidenceScore || 0);
    d.texts.push(String(e.chunkText || '').slice(0, 500));
    if (e.expiration) d.vigency = e.expiration;
  }
  const list = [...docs.values()];
  let conflictType = 'NO_CONFLICT';
  let reasonCode = null;
  let conflictDetected = false;
  const conflictDocumentIds = [];

  const moneyRe = /R\$\s*[\d.]+,?\d*/gi;
  const idRe = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\bCRM[-\s]?\w*\s*\d+/gi;

  outer: for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const ta = a.texts.join(' ');
      const tb = b.texts.join(' ');
      const idsA = ta.match(idRe) || [];
      const idsB = tb.match(idRe) || [];
      const monA = ta.match(moneyRe) || [];
      const monB = tb.match(moneyRe) || [];
      const sharedId = idsA.some((x) => idsB.map((y) => y.toLowerCase()).includes(x.toLowerCase()));
      if (sharedId && monA.length && monB.length) {
        const norm = (xs) => [...new Set(xs.map((x) => x.replace(/\s/g, '').toLowerCase()))];
        const sa = norm(monA);
        const sb = norm(monB);
        if (sa.some((x) => !sb.includes(x)) || sb.some((x) => !sa.includes(x))) {
          conflictType = 'CONFIRMED_CONFLICT';
          reasonCode = 'DIVERGENT_MONETARY_VALUES';
          conflictDocumentIds.push(a.documentId, b.documentId);
          conflictDetected = true;
          break outer;
        }
      }
      const titleTokens = (t) =>
        String(t || '')
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 3);
      const sharedTitle = titleTokens(a.title).filter((t) => titleTokens(b.title).includes(t)).length;
      if (sharedTitle >= 2 && a.vigency && b.vigency && String(a.vigency) !== String(b.vigency)) {
        conflictType = 'POTENTIAL_CONFLICT';
        reasonCode = 'DIVERGENT_VIGENCY';
        conflictDocumentIds.push(a.documentId, b.documentId);
        conflictDetected = true;
      }
    }
  }

  let preferred = null;
  if (conflictDetected) {
    preferred = [...list]
      .filter((d) => conflictDocumentIds.includes(d.documentId))
      .sort((a, b) => {
        const vr = (Date.parse(b.vigency || 0) || 0) - (Date.parse(a.vigency || 0) || 0);
        if (vr) return vr;
        return (b.maxScore || 0) - (a.maxScore || 0);
      })[0];
  }

  const preferredEvidence = preferred
    ? evidences
        .filter((e) => e.documentId === preferred.documentId)
        .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0))[0]
    : null;

  return {
    conflictDetected,
    conflictType,
    conflictReasonCode: reasonCode,
    preferredEvidenceId: preferredEvidence?.evidenceId || null,
    preferredDocumentId: preferred?.documentId || null,
    conflictingDocuments: [...new Set(conflictDocumentIds)],
    reasonCode,
  };
}

export function buildEvidenceFromChunk(chunk, index, cfg = {}) {
  const text = String(chunk.text || chunk.content || '');
  const scored = computeEvidenceScore(chunk, cfg);
  const labels = classifyEvidence(chunk, text);
  const evidenceId = sha256(
    `${chunk.documentId || ''}:${chunk.documentVersionId || chunk.versionId || ''}:${chunk.chunkId || index}:${text.slice(0, 80)}`,
  ).slice(0, 24);

  return {
    evidenceId,
    documentId: chunk.documentId || chunk.document_id || null,
    versionId: chunk.documentVersionId || chunk.versionId || chunk.document_version_id || null,
    chunkId: chunk.chunkId || chunk.chunk_id || null,
    documentTitle: chunk.documentTitle || chunk.document_title || null,
    setor: chunk.sectorName || chunk.sector_name || null,
    sectorId: chunk.sectorId || chunk.sector_id || null,
    categoria: chunk.categoryName || chunk.category_name || null,
    categoryId: chunk.categoryId || chunk.category_id || null,
    subcategoria: chunk.subcategoryName || chunk.subcategory_name || null,
    subcategoryId: chunk.subcategoryId || chunk.subcategory_id || null,
    sourceType: scored.sourceType,
    ocrGrade: chunk.ocrQualityGrade || chunk.ocrQuality || null,
    retrievalScore: numScore(chunk.hybridScore ?? chunk.vectorScore ?? chunk.textScore),
    rerankScore: numScore(chunk.rerankScore ?? chunk.relevance),
    evidenceScore: scored.evidenceScore,
    evidenceGrade: scored.evidenceGrade,
    currentVersion: chunk.isCurrent !== false,
    expiration: chunk.expirationDate || chunk.vigencyDate || null,
    conflictFlags: [],
    confidence: scored.confidence,
    chunkText: text,
    labels,
    chunkOrder: chunk.chunkOrder ?? chunk.chunkIndex ?? index,
    chunkKind: chunk.chunkKind || null,
    sheetName: chunk.sheetName || null,
    rowStart: chunk.rowStart ?? null,
    rowEnd: chunk.rowEnd ?? null,
    sourceMetadata: {
      sectorName: chunk.sectorName || null,
      categoryName: chunk.categoryName || null,
      subcategoryName: chunk.subcategoryName || null,
      vigencyDate: chunk.vigencyDate || chunk.expirationDate || null,
      sheetName: chunk.sheetName || null,
    },
  };
}

export function evidencesToSelectedChunks(evidences) {
  return evidences.map((e, i) => ({
    chunkId: e.chunkId,
    documentId: e.documentId,
    documentVersionId: e.versionId,
    documentTitle: e.documentTitle,
    sectorId: e.sectorId,
    sectorName: e.setor,
    categoryId: e.categoryId,
    categoryName: e.categoria,
    subcategoryId: e.subcategoryId,
    subcategoryName: e.subcategoria,
    vigencyDate: e.expiration,
    expirationDate: e.expiration,
    chunkOrder: e.chunkOrder ?? i,
    chunkKind: e.chunkKind,
    sheetName: e.sheetName,
    rowStart: e.rowStart,
    rowEnd: e.rowEnd,
    text: e.chunkText,
    content: e.chunkText,
    hybridScore: e.retrievalScore != null ? e.retrievalScore / 100 : null,
    rerankScore: e.rerankScore != null ? e.rerankScore / 100 : null,
    relevance: e.evidenceScore / 100,
    ocrQualityGrade: e.ocrGrade,
    evidenceId: e.evidenceId,
    evidenceScore: e.evidenceScore,
    evidenceGrade: e.evidenceGrade,
    isCurrent: e.currentVersion,
  }));
}

export function buildRichSources(evidences) {
  const byDoc = new Map();
  for (const e of evidences) {
    const id = String(e.documentId || '');
    if (!id) continue;
    if (!byDoc.has(id)) {
      byDoc.set(id, {
        documentId: id,
        documentTitle: e.documentTitle,
        setor: e.setor,
        categoria: e.categoria,
        subcategoria: e.subcategoria,
        ocrGrade: e.ocrGrade,
        sourceType: e.sourceType,
        vigente: !e.expiration || new Date(e.expiration).getTime() >= Date.now(),
        evidenceScore: e.evidenceScore,
        versionPresent: !!e.versionId,
      });
    } else {
      const s = byDoc.get(id);
      s.evidenceScore = Math.max(s.evidenceScore || 0, e.evidenceScore || 0);
      if (e.sourceType === 'tabular') s.sourceType = 'tabular';
      if (e.sourceType === 'OCR' && s.sourceType !== 'tabular') s.sourceType = 'OCR';
    }
  }
  return [...byDoc.values()]
    .sort((a, b) => (b.evidenceScore || 0) - (a.evidenceScore || 0))
    .map((s, index) => ({
      index: index + 1,
      documentId: s.documentId,
      documentTitle: s.documentTitle,
      sectorName: s.setor,
      categoryName: s.categoria,
      subcategoryName: s.subcategoria,
      ocrGrade: s.ocrGrade,
      sourceType: s.sourceType,
      vigente: s.vigente,
      evidenceScore: s.evidenceScore,
      expirationDate: null,
    }));
}

export function buildEvidenceMeta(evidences, excluded, conflict, redundancy, durationMs) {
  const scores = evidences.map((e) => e.evidenceScore || 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const ocrDist = {};
  const tabDist = { tabular: 0, texto: 0, OCR: 0 };
  const confDist = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const e of evidences) {
    const g = e.ocrGrade || 'N/A';
    ocrDist[g] = (ocrDist[g] || 0) + 1;
    tabDist[e.sourceType] = (tabDist[e.sourceType] || 0) + 1;
    confDist[e.confidence] = (confDist[e.confidence] || 0) + 1;
  }
  const labels = new Set(evidences.flatMap((e) => e.labels || []));
  return {
    evidenceCount: evidences.length,
    averageEvidenceScore: Math.round(avg * 10) / 10,
    highestEvidenceScore: scores.length ? Math.max(...scores) : 0,
    conflictCount: conflict.conflictDetected ? conflict.conflictingDocuments.length : 0,
    conflictDetected: !!conflict.conflictDetected,
    conflictType: conflict.conflictType || 'NO_CONFLICT',
    redundancyCount: redundancy.redundancyCount || 0,
    deduplicatedEvidenceCount: redundancy.deduplicatedEvidenceCount || evidences.length,
    ocrDistribution: ocrDist,
    tabularDistribution: tabDist,
    confidenceDistribution: confDist,
    selectedEvidenceIds: evidences.map((e) => e.evidenceId),
    excludedEvidenceIds: (excluded || []).map((e) => e.evidenceId),
    labelDiversity: labels.size,
    durationMs: durationMs || 0,
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
  };
}

export function defaultEvidenceConfig() {
  return {
    mode: 'STRUCTURED',
    enableEvidenceScore: true,
    enableClassification: true,
    enableConflictConsolidation: true,
    enableRedundancyDetection: true,
    enableRichSources: true,
    passthroughToCwm: true,
    minEvidenceScore: 0,
    redundancyThreshold: 0.92,
    dropBelowMinScore: false,
    notes: 'evidence-v1 — structured passthrough (compatível com CWM)',
  };
}

export function validateEvidenceConfiguration(raw) {
  const errors = [];
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const modes = ['DISABLED', 'PASSTHROUGH', 'STRUCTURED', 'STRUCTURED_STRICT'];
  const mode = String(cfg.mode || '').toUpperCase();
  if (!modes.includes(mode)) errors.push({ field: 'mode', message: 'mode inválido' });
  for (const b of [
    'enableEvidenceScore',
    'enableClassification',
    'enableConflictConsolidation',
    'enableRedundancyDetection',
    'enableRichSources',
    'passthroughToCwm',
    'dropBelowMinScore',
  ]) {
    if (cfg[b] !== undefined && typeof cfg[b] !== 'boolean') {
      errors.push({ field: b, message: 'deve ser boolean' });
    }
  }
  if (cfg.minEvidenceScore !== undefined) {
    const v = Number(cfg.minEvidenceScore);
    if (typeof cfg.minEvidenceScore === 'string' || !Number.isFinite(v) || v < 0 || v > 100) {
      errors.push({ field: 'minEvidenceScore', message: '0–100 número' });
    }
  }
  if (cfg.redundancyThreshold !== undefined) {
    const v = Number(cfg.redundancyThreshold);
    if (typeof cfg.redundancyThreshold === 'string' || !Number.isFinite(v) || v < 0.5 || v > 1) {
      errors.push({ field: 'redundancyThreshold', message: '0.5–1 número' });
    }
  }
  return { ok: errors.length === 0, errors, configuration: { ...defaultEvidenceConfig(), ...cfg, mode } };
}
