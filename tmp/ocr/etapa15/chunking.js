/**
 * Chunking melhorado (word-boundary + dehyphenation) usado em:
 *  - Processar documento (vNDpCzOdR7ATnHDP) -> node "Code in JavaScript"
 *  - POST Documento OCR (QFZ2PRTlGV7umesd) -> node "Gerar chunks OCR"
 */
function normalizeDocumentText(raw) {
  let t = String(raw ?? '');
  t = t.normalize('NFC');
  t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '');
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.split('\n').map((line) => line.replace(/[ \t\f\v]+/g, ' ').trimEnd()).join('\n');
  return t.trim();
}

function improveChunksFromText(rawText, documentId, versionId) {
  const text = normalizeDocumentText(rawText);
  const dehyphen = text.replace(/(\p{L})-\n(\p{L})/gu, '$1$2');
  const flat = dehyphen.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/\n{2,}/g, '\n\n').trim();
  const soft = flat.replace(/\n/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();

  const chunkSize = 1100;
  const overlap = 160;
  const minChunk = 40;
  const chunks = [];

  const breakAt = (slice) => {
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
      chunks.push({ json: { documentId, versionId, chunkIndex: chunks.length, content } });
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
