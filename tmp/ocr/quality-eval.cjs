/**
 * Avaliação documental determinística (sem IA).
 * Usado pelos Code nodes do OCR - ORQUESTRAR / Processar / chunks.
 *
 * SCORE 0–100 (pesos fixos):
 *  - Densidade útil (0–25): chars úteis por página
 *  - Riqueza lexical (0–25): qtd palavras + razão palavras únicas
 *  - Ruído de símbolos (0–20): baixa proporção de símbolos/controle
 *  - Diversidade de linhas (0–15): pouca repetição de linhas/blocos
 *  - Estrutura de corpo (0–15): não só cabeçalho/rodapé
 *
 * GRADES:
 *  EXCELLENT   >= 85
 *  GOOD        >= 70
 *  ACCEPTABLE  >= 50
 *  POOR        >= 30
 *  FAILED      < 30 (texto quase inexistente ou só lixo)
 *  MANUAL_REVIEW: decisão operacional (ex.: esgotou retries HQ)
 */

function normalizeDocumentText(raw) {
  let text = String(raw ?? '');
  // NFC Unicode, remove controles invisíveis (mantém \n \t)
  text = text.normalize('NFC');
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
  // normaliza quebras
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // colapsa linhas vazias repetidas
  text = text.replace(/\n{3,}/g, '\n\n');
  // espaços horizontais duplicados (preserva \n)
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd())
    .join('\n');
  return text.trim();
}

function tokenizeWords(text) {
  const matches = text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return matches || [];
}

function evaluateDocumentQuality(rawText, meta = {}) {
  const text = normalizeDocumentText(rawText);
  const pageCount = Math.max(1, Number(meta.pageCount) || Number(meta.ocrPageCount) || 1);
  const thresholds = {
    excellent: Number(meta.excellentMin ?? 85),
    good: Number(meta.goodMin ?? 70),
    acceptable: Number(meta.acceptableMin ?? 50),
    poor: Number(meta.poorMin ?? 30),
  };

  const charCount = text.length;
  const lettersDigits = (text.match(/[\p{L}\p{N}]/gu) || []).length;
  const spaces = (text.match(/[ \t]/g) || []).length;
  const usefulChars = lettersDigits + spaces;
  const controlOrSymbol = Math.max(0, charCount - usefulChars);
  const symbolRatio = charCount > 0 ? controlOrSymbol / charCount : 1;

  const words = tokenizeWords(text);
  const wordCount = words.length;
  const uniqueWords = new Set(words);
  const uniqueWordCount = uniqueWords.size;
  const uniqueRatio = wordCount > 0 ? uniqueWordCount / wordCount : 0;
  const charsPerPage = usefulChars / pageCount;
  const wordsPerPage = wordCount / pageCount;

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lineCount = lines.length;
  const uniqueLineCount = new Set(lines.map((l) => l.toLowerCase())).size;
  const uniqueLineRatio = lineCount > 0 ? uniqueLineCount / lineCount : 0;

  // blocos de 3 linhas
  let blockRepetition = 0;
  if (lines.length >= 6) {
    const blocks = [];
    for (let i = 0; i < lines.length - 2; i++) {
      blocks.push(`${lines[i]}|${lines[i + 1]}|${lines[i + 2]}`.toLowerCase());
    }
    const uniqBlocks = new Set(blocks).size;
    blockRepetition = 1 - uniqBlocks / blocks.length;
  }

  const shortLines = lines.filter((l) => l.length <= 40).length;
  const shortLineRatio = lineCount > 0 ? shortLines / lineCount : 1;
  const avgLineLen = lineCount > 0 ? lines.reduce((a, l) => a + l.length, 0) / lineCount : 0;

  // --- scores ---
  let density = 0;
  if (charsPerPage >= 400) density = 25;
  else if (charsPerPage >= 200) density = 20;
  else if (charsPerPage >= 100) density = 16;
  else if (charsPerPage >= 60) density = 12;
  else if (charsPerPage >= 30) density = 8;
  else if (charsPerPage >= 15) density = 4;

  let lexical = 0;
  if (wordCount >= 120) lexical += 15;
  else if (wordCount >= 60) lexical += 12;
  else if (wordCount >= 30) lexical += 9;
  else if (wordCount >= 15) lexical += 6;
  else if (wordCount >= 8) lexical += 3;
  else if (wordCount >= 3) lexical += 1;

  if (uniqueRatio >= 0.55) lexical += 10;
  else if (uniqueRatio >= 0.4) lexical += 7;
  else if (uniqueRatio >= 0.28) lexical += 4;
  else if (uniqueRatio >= 0.18) lexical += 2;
  lexical = Math.min(25, lexical);

  let noise = 0;
  if (symbolRatio <= 0.05) noise = 20;
  else if (symbolRatio <= 0.1) noise = 15;
  else if (symbolRatio <= 0.2) noise = 10;
  else if (symbolRatio <= 0.35) noise = 5;

  let diversity = 0;
  if (uniqueLineRatio >= 0.9) diversity = 15;
  else if (uniqueLineRatio >= 0.75) diversity = 12;
  else if (uniqueLineRatio >= 0.6) diversity = 8;
  else if (uniqueLineRatio >= 0.45) diversity = 4;
  if (blockRepetition >= 0.4) diversity = Math.max(0, diversity - 8);
  else if (blockRepetition >= 0.25) diversity = Math.max(0, diversity - 4);

  let structure = 0;
  if (avgLineLen >= 45 && shortLineRatio <= 0.55) structure = 15;
  else if (avgLineLen >= 30 && shortLineRatio <= 0.7) structure = 11;
  else if (avgLineLen >= 20) structure = 7;
  else if (wordCount >= 15) structure = 4;
  // texto só de cabeçalhos/rodapés curtos
  if (lineCount >= 3 && shortLineRatio >= 0.85 && avgLineLen < 25) {
    structure = Math.min(structure, 3);
  }

  const reasons = [];
  let score = density + lexical + noise + diversity + structure;
  // texto altamente repetido (cabeçalhos/rodapés) não passa de POOR
  if (uniqueLineRatio < 0.25 && lineCount >= 8) {
    score = Math.min(score, 29);
    reasons.push('REPEATED_LINES');
  } else if (blockRepetition >= 0.5 && lineCount >= 8) {
    score = Math.min(score, 45);
    reasons.push('REPEATED_BLOCKS');
  }
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (density <= 8) reasons.push('LOW_DENSITY');
  if (lexical <= 6) reasons.push('LOW_LEXICAL');
  if (noise <= 5) reasons.push('HIGH_SYMBOL_NOISE');
  if (diversity <= 4) reasons.push('HIGH_REPETITION');
  if (structure <= 4) reasons.push('WEAK_BODY_STRUCTURE');
  if (wordCount >= 15 && uniqueRatio >= 0.35 && charsPerPage >= 60) reasons.push('SUFFICIENT_CONTENT');

  const reasonSet = [...new Set(reasons)];

  let grade;
  if (score >= thresholds.excellent) grade = 'EXCELLENT';
  else if (score >= thresholds.good) grade = 'GOOD';
  else if (score >= thresholds.acceptable) grade = 'ACCEPTABLE';
  else if (score >= thresholds.poor) grade = 'POOR';
  else grade = 'FAILED';

  // 1 página com ~40 palavras úteis tipicamente ACCEPTABLE+ (não MANUAL_REVIEW)
  const usable = grade === 'EXCELLENT' || grade === 'GOOD' || grade === 'ACCEPTABLE';

  return {
    normalizedText: text,
    score,
    grade,
    usable,
    reasons: reasonSet.slice(0, 6),
    metrics: {
      pageCount,
      characterCount: charCount,
      usefulChars,
      wordCount,
      uniqueWordCount,
      uniqueRatio: Math.round(uniqueRatio * 1000) / 1000,
      charsPerPage: Math.round(charsPerPage * 100) / 100,
      wordsPerPage: Math.round(wordsPerPage * 100) / 100,
      symbolRatio: Math.round(symbolRatio * 1000) / 1000,
      uniqueLineRatio: Math.round(uniqueLineRatio * 1000) / 1000,
      blockRepetition: Math.round(blockRepetition * 1000) / 1000,
      avgLineLen: Math.round(avgLineLen * 10) / 10,
      shortLineRatio: Math.round(shortLineRatio * 1000) / 1000,
      components: { density, lexical, noise, diversity, structure },
    },
  };
}

function buildQualityReason(evalResult) {
  return (evalResult.reasons || []).join(',') || null;
}

function decidePostOcrAction(evalResult, ocrAttempts, maxAttempts, ocrMode) {
  const attempts = Number(ocrAttempts) || 1;
  const max = Number(maxAttempts) || 3;
  const mode = String(ocrMode || 'STANDARD').toUpperCase();

  if (evalResult.usable) {
    return {
      action: 'SUCCESS',
      ocrStatus: 'SUCCESS',
      qualityGrade: evalResult.grade,
      reviewReason: null,
    };
  }

  if (mode !== 'HIGH_QUALITY' && attempts < max) {
    return {
      action: 'HIGH_QUALITY_RETRY',
      ocrStatus: 'PROCESSING',
      qualityGrade: evalResult.grade,
      reviewReason: `RETRY_HQ:${evalResult.grade}:${buildQualityReason(evalResult) || 'LOW_QUALITY'}`,
    };
  }

  return {
    action: 'MANUAL_REVIEW',
    ocrStatus: 'MANUAL_REVIEW',
    qualityGrade: 'MANUAL_REVIEW',
    reviewReason: `EXHAUSTED:${evalResult.grade}:${buildQualityReason(evalResult) || 'LOW_QUALITY'}`,
  };
}

function decideNeedOcrFromTika(evalResult, force) {
  if (force) return { needOcr: true, reason: 'FORCE' };
  if (evalResult.usable) return { needOcr: false, reason: 'TIKA_SUFFICIENT', ocrStatus: 'NOT_REQUIRED' };
  return { needOcr: true, reason: `TIKA_${evalResult.grade}` };
}

function improveChunksFromText(rawText, documentId, versionId) {
  const text = normalizeDocumentText(rawText);
  // rejunta hifenização de fim de linha comum em OCR: "pala-\nvra" → "palavra"
  const dehyphen = text.replace(/(\p{L})-\n(\p{L})/gu, '$1$2');
  const flat = dehyphen.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
  const soft = flat.replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

  const chunkSize = 1100;
  const overlap = 160;
  const minChunk = 40;
  const chunks = [];

  const breakAt = (slice) => {
    // preferir quebra em espaço/pontuação perto do fim
    if (slice.length < chunkSize) return slice;
    const window = slice.slice(0, chunkSize);
    const candidates = [window.lastIndexOf('. '), window.lastIndexOf('; '), window.lastIndexOf(' '), window.lastIndexOf('\n')];
    const idx = Math.max(...candidates);
    if (idx >= Math.floor(chunkSize * 0.55)) return slice.slice(0, idx + 1).trim();
    return window.trim();
  };

  let i = 0;
  while (i < soft.length) {
    const content = breakAt(soft.slice(i));
    if (content.length >= minChunk) {
      chunks.push({
        json: {
          documentId,
          versionId,
          chunkIndex: chunks.length,
          content,
        },
      });
    }
    if (!content.length) break;
    const advance = Math.max(1, content.length - overlap);
    i += advance;
    if (i >= soft.length) break;
  }

  if (!chunks.length && soft.length) {
    chunks.push({ json: { documentId, versionId, chunkIndex: 0, content: soft } });
  }
  if (!chunks.length) {
    return [{ json: { documentId, versionId, chunkIndex: -1, content: '', skip: true } }];
  }
  return chunks;
}

module.exports = {
  normalizeDocumentText,
  evaluateDocumentQuality,
  buildQualityReason,
  decidePostOcrAction,
  decideNeedOcrFromTika,
  improveChunksFromText,
};
