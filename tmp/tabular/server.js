/**
 * Oftalmocentro Tabular Parser — SheetJS (xlsx)
 * Internal only. Read-only. Never executes macros/formulas.
 *
 * POST /parse  — multipart file or JSON { filePath }
 * GET  /health
 * POST /preview — first N rows only
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');

const app = express();
const PORT = Number(process.env.PORT || 8081);
const WORK_DIR = process.env.TABULAR_WORK_DIR || '/tmp/tabular-work';
const DOCS_ROOT = process.env.TABULAR_DOCS_ROOT || '/home/node/files/documents';
const MAX_UPLOAD = Number(process.env.TABULAR_MAX_UPLOAD_BYTES || 26 * 1024 * 1024);
const MAX_SHEETS = Number(process.env.TABULAR_MAX_SHEETS || 50);
const MAX_ROWS = Number(process.env.TABULAR_MAX_ROWS || 50000);
const MAX_COLS = Number(process.env.TABULAR_MAX_COLUMNS || 100);
const ROWS_PER_CHUNK = Number(process.env.TABULAR_ROWS_PER_CHUNK || 25);
const PREVIEW_ROWS = Number(process.env.TABULAR_PREVIEW_ROWS || 30);
const TIMEOUT_MS = Number(process.env.TABULAR_TIMEOUT_SECONDS || 120) * 1000;

fs.mkdirSync(WORK_DIR, { recursive: true });

app.use(express.json({ limit: '2mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD, files: 1 },
});

function safePath(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  const root = path.resolve(DOCS_ROOT);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return null;
  }
  if (resolved.includes('..')) return null;
  return resolved;
}

function stripInvisible(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Neutralize CSV/formula injection for display — never execute */
function sanitizeDisplay(value) {
  const s = stripInvisible(value);
  if (/^[=+\-@|]/.test(s)) return `'${s}`;
  return s;
}

function detectCellType(raw, cell) {
  if (raw == null || raw === '') return 'empty';
  if (cell && cell.f) return 'formula';
  if (cell && cell.t === 'b') return 'boolean';
  if (cell && cell.t === 'n') {
    if (cell.z && /%/.test(String(cell.z))) return 'percent';
    if (cell.z && /[$€£R]/.test(String(cell.z))) return 'currency';
    if (cell.z && /[dmyh]/i.test(String(cell.z)) && !/%/.test(String(cell.z))) return 'date';
    return 'number';
  }
  if (cell && cell.t === 'd') return 'date';
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s)) return 'date';
  if (/^R\$\s?[\d.,]+$/.test(s) || /^\$?\s?[\d.,]+$/.test(s)) return 'currency';
  if (/^\d+(\.\d+)?%$/.test(s)) return 'percent';
  if (/^(true|false|sim|não|nao)$/i.test(s)) return 'boolean';
  if (/^0\d+$/.test(s)) return 'text'; // leading zeros
  return 'text';
}

function formatDisplay(raw, cellType, cell) {
  if (raw == null || raw === '') return '';
  if (cell && cell.w != null && String(cell.w).length) return sanitizeDisplay(cell.w);
  if (cellType === 'date' && raw instanceof Date) {
    return sanitizeDisplay(raw.toISOString().slice(0, 10));
  }
  if (cellType === 'boolean') return raw ? 'true' : 'false';
  return sanitizeDisplay(raw);
}

function normalizeHeader(h, idx) {
  const cleaned = stripInvisible(h);
  if (!cleaned) return `coluna_${idx + 1}`;
  return cleaned.slice(0, 120);
}

function parseWorkbook(buffer, ext) {
  const warnings = [];
  const opts = {
    type: 'buffer',
    cellDates: true,
    cellNF: true,
    cellStyles: false,
    sheetStubs: true,
    raw: false,
  };
  // Never execute macros; SheetJS does not run VBA
  let workbook;
  try {
    workbook = XLSX.read(buffer, opts);
  } catch (err) {
    const e = new Error('TABLE_CORRUPT');
    e.code = 'TABLE_CORRUPT';
    e.cause = err;
    throw e;
  }

  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) {
    const e = new Error('TABLE_EMPTY');
    e.code = 'TABLE_EMPTY';
    throw e;
  }
  if (sheetNames.length > MAX_SHEETS) {
    warnings.push(`SHEETS_TRUNCATED:${sheetNames.length}->${MAX_SHEETS}`);
  }

  const sheetsOut = [];
  const allRows = [];
  const chunks = [];
  let totalRows = 0;
  let maxCols = 0;
  let chunkOrder = 0;

  const names = sheetNames.slice(0, MAX_SHEETS);
  for (let si = 0; si < names.length; si++) {
    const sheetName = names[si];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const ref = sheet['!ref'];
    if (!ref) {
      sheetsOut.push({
        sheetIndex: si,
        sheetName,
        rowCount: 0,
        columnCount: 0,
        headers: [],
        hasMergedCells: !!(sheet['!merges'] && sheet['!merges'].length),
        metadata: { empty: true },
      });
      continue;
    }

    const range = XLSX.utils.decode_range(ref);
    let colCount = range.e.c - range.s.c + 1;
    if (colCount > MAX_COLS) {
      warnings.push(`COLS_TRUNCATED:${sheetName}:${colCount}->${MAX_COLS}`);
      colCount = MAX_COLS;
    }
    maxCols = Math.max(maxCols, colCount);

    // Header = best row among first 15 (many short labels), not necessarily row 0
    let headerRowIdx = range.s.r;
    let bestHeaderScore = -1;
    const headerScanEnd = Math.min(range.s.r + 15, range.e.r);
    for (let r = range.s.r; r <= headerScanEnd; r++) {
      let nonEmpty = 0;
      let lenSum = 0;
      for (let c = 0; c < colCount; c++) {
        const addr = XLSX.utils.encode_cell({ r, c: range.s.c + c });
        const cell = sheet[addr];
        const v = cell ? String(cell.w ?? cell.v ?? '').trim() : '';
        if (v) {
          nonEmpty += 1;
          lenSum += v.length;
        }
      }
      if (nonEmpty < 2) continue;
      const avgLen = lenSum / nonEmpty;
      const score = nonEmpty * 12 - Math.min(avgLen, 100);
      if (score > bestHeaderScore) {
        bestHeaderScore = score;
        headerRowIdx = r;
      }
    }

    const headers = [];
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r: headerRowIdx, c: range.s.c + c });
      const cell = sheet[addr];
      const raw = cell ? (cell.v != null ? cell.v : cell.w) : '';
      headers.push(normalizeHeader(raw, c));
    }

    const dataStart = headerRowIdx + 1;
    const maxR = range.e.r;
    const sheetRows = [];
    let dataRowCount = 0;

    for (let r = dataStart; r <= maxR; r++) {
      if (totalRows >= MAX_ROWS) {
        warnings.push(`ROWS_TRUNCATED:${MAX_ROWS}`);
        break;
      }
      const cells = [];
      let any = false;
      const parts = [];
      for (let c = 0; c < colCount; c++) {
        const addr = XLSX.utils.encode_cell({ r, c: range.s.c + c });
        const cell = sheet[addr];
        const raw = cell ? cell.v : null;
        const formula = cell && cell.f ? String(cell.f) : null;
        const cellType = detectCellType(raw, cell);
        const display = formatDisplay(raw, cellType, cell);
        if (display) any = true;
        const colName = headers[c];
        cells.push({
          columnIndex: c,
          columnName: colName,
          cellType,
          formula, // stored, never executed
          displayValue: display,
          rawValue: raw == null ? null : typeof raw === 'object' ? String(raw) : raw,
        });
        if (display) parts.push(`${colName}: ${display}`);
      }
      if (!any) continue;
      dataRowCount++;
      totalRows++;
      const rowNumber = dataRowCount; // 1-based data rows
      const rowText = parts.join(' | ');
      const rowObj = {
        sheetIndex: si,
        sheetName,
        rowNumber,
        isHeader: false,
        cells,
        rowText,
      };
      sheetRows.push(rowObj);
      allRows.push(rowObj);
    }

    // Build tabular chunks — never split a row; always include headers
    const headerLine = `Aba: ${sheetName}\nColunas: ${headers.join(' | ')}`;
    for (let i = 0; i < sheetRows.length; i += ROWS_PER_CHUNK) {
      const slice = sheetRows.slice(i, i + ROWS_PER_CHUNK);
      if (!slice.length) continue;
      const rowStart = slice[0].rowNumber;
      const rowEnd = slice[slice.length - 1].rowNumber;
      const body = slice
        .map((row) => `Linha ${row.rowNumber}: ${row.rowText}`)
        .join('\n');
      const chunkText = `${headerLine}\nLinhas ${rowStart}-${rowEnd}:\n${body}`;
      chunks.push({
        chunkOrder: chunkOrder++,
        chunkKind: 'tabular',
        sheetName,
        rowStart,
        rowEnd,
        headersJson: headers,
        chunkText,
      });
    }

    // Sheet summary chunk even if empty data
    if (!sheetRows.length) {
      chunks.push({
        chunkOrder: chunkOrder++,
        chunkKind: 'tabular',
        sheetName,
        rowStart: null,
        rowEnd: null,
        headersJson: headers,
        chunkText: `${headerLine}\n(sem linhas de dados)`,
      });
    }

    sheetsOut.push({
      sheetIndex: si,
      sheetName,
      rowCount: dataRowCount,
      columnCount: colCount,
      headers,
      hasMergedCells: !!(sheet['!merges'] && sheet['!merges'].length),
      metadata: {
        merges: (sheet['!merges'] || []).length,
        range: ref,
      },
    });
  }

  if (totalRows === 0 && sheetsOut.every((s) => s.rowCount === 0)) {
    // allow header-only sheets
    warnings.push('NO_DATA_ROWS');
  }

  const preview = {};
  for (const s of sheetsOut) {
    preview[s.sheetName] = {
      headers: s.headers,
      rows: allRows
        .filter((r) => r.sheetName === s.sheetName)
        .slice(0, PREVIEW_ROWS)
        .map((r) => ({
          rowNumber: r.rowNumber,
          values: r.cells.map((c) => c.displayValue),
        })),
    };
  }

  const summary = {
    sheetCount: sheetsOut.length,
    rowCount: totalRows,
    columnCount: maxCols,
    sheets: sheetsOut.map((s) => ({
      name: s.sheetName,
      rows: s.rowCount,
      columns: s.columnCount,
      headers: s.headers,
      hasMergedCells: s.hasMergedCells,
    })),
    warnings,
    engine: 'sheetjs',
    library: 'xlsx',
    extension: ext || null,
  };

  // Compact extracted text for documents.extracted_text (not full dump)
  const extractedText = sheetsOut
    .map((s) => {
      const sample = allRows
        .filter((r) => r.sheetName === s.sheetName)
        .slice(0, 5)
        .map((r) => r.rowText)
        .join('\n');
      return `[${s.sheetName}] cols=${s.headers.join(', ')}\n${sample}`;
    })
    .join('\n\n')
    .slice(0, 20000);

  return {
    ok: true,
    summary,
    sheets: sheetsOut,
    preview,
    chunks,
    // Persist at most 20k rows of structured cells to keep payload manageable
    rows: allRows.slice(0, Math.min(totalRows, 20000)),
    extractedText,
    stats: {
      sheetCount: sheetsOut.length,
      rowCount: totalRows,
      columnCount: maxCols,
      chunkCount: chunks.length,
      rowPayloadCount: Math.min(totalRows, 20000),
    },
  };
}

function readInputBuffer(req) {
  if (req.file && req.file.buffer) {
    return {
      buffer: req.file.buffer,
      ext: path.extname(req.file.originalname || '').replace(/^\./, '').toLowerCase(),
      source: 'upload',
    };
  }
  if (req.body && req.body.filePath) {
    const fp = safePath(req.body.filePath);
    if (!fp || !fs.existsSync(fp)) {
      const e = new Error('TABLE_PATH_INVALID');
      e.code = 'TABLE_PATH_INVALID';
      throw e;
    }
    const st = fs.statSync(fp);
    if (st.size > MAX_UPLOAD) {
      const e = new Error('TABLE_TOO_LARGE');
      e.code = 'TABLE_TOO_LARGE';
      throw e;
    }
    return {
      buffer: fs.readFileSync(fp),
      ext: path.extname(fp).replace(/^\./, '').toLowerCase(),
      source: 'path',
      filePath: fp,
    };
  }
  // raw body as binary
  if (Buffer.isBuffer(req.body) && req.body.length) {
    return { buffer: req.body, ext: 'xlsx', source: 'raw' };
  }
  const e = new Error('TABLE_NO_INPUT');
  e.code = 'TABLE_NO_INPUT';
  throw e;
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'oftalmocentro-tabular',
    engine: 'sheetjs',
    library: 'xlsx',
    version: require('xlsx/package.json').version,
    limits: {
      maxUploadBytes: MAX_UPLOAD,
      maxSheets: MAX_SHEETS,
      maxRows: MAX_ROWS,
      maxColumns: MAX_COLS,
      rowsPerChunk: ROWS_PER_CHUNK,
      previewRows: PREVIEW_ROWS,
      timeoutSeconds: TIMEOUT_MS / 1000,
    },
    formats: ['xls', 'xlsx', 'csv', 'tsv'],
    features: {
      formulasStoredNotExecuted: true,
      macrosNeverExecuted: true,
      csvInjectionSanitized: true,
      mergedCellsDetected: true,
      streamingNote: 'file read once; row iteration incremental; payload capped',
    },
  });
});

function withTimeout(fn) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const e = new Error('TABLE_TIMEOUT');
      e.code = 'TABLE_TIMEOUT';
      reject(e);
    }, TIMEOUT_MS);
    Promise.resolve()
      .then(fn)
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((err) => {
        clearTimeout(t);
        reject(err);
      });
  });
}

app.post('/parse', upload.single('file'), async (req, res) => {
  const started = Date.now();
  try {
    const input = readInputBuffer(req);
    const allowed = new Set(['xls', 'xlsx', 'csv', 'tsv']);
    if (input.ext && !allowed.has(input.ext)) {
      return res.status(422).json({ ok: false, code: 'TABLE_UNSUPPORTED', message: 'Formato não suportado.' });
    }
    const result = await withTimeout(() => parseWorkbook(input.buffer, input.ext));
    result.durationMs = Date.now() - started;
    result.checksum = crypto.createHash('sha256').update(input.buffer).digest('hex');
    res.set('X-Tabular-Duration-Ms', String(result.durationMs));
    res.set('X-Tabular-Engine', 'sheetjs');
    return res.json(result);
  } catch (err) {
    const code = err.code || 'TABLE_PROCESS_FAILED';
    const status =
      code === 'TABLE_TIMEOUT' ? 408 :
      code === 'TABLE_TOO_LARGE' ? 413 :
      code === 'TABLE_PATH_INVALID' || code === 'TABLE_NO_INPUT' ? 400 :
      code === 'TABLE_CORRUPT' || code === 'TABLE_EMPTY' ? 422 : 500;
    return res.status(status).json({
      ok: false,
      code,
      message: err.message || 'Falha ao processar planilha.',
      durationMs: Date.now() - started,
    });
  }
});

app.post('/preview', upload.single('file'), async (req, res) => {
  const started = Date.now();
  try {
    const input = readInputBuffer(req);
    const result = await withTimeout(() => parseWorkbook(input.buffer, input.ext));
    return res.json({
      ok: true,
      summary: result.summary,
      preview: result.preview,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    return res.status(422).json({
      ok: false,
      code: err.code || 'TABLE_PROCESS_FAILED',
      message: err.message,
      durationMs: Date.now() - started,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`oftalmocentro-tabular listening on ${PORT}`);
});
