const crypto = require('crypto');
const rows = $input.all().map(function (i) { return i.json || {}; });

const items = rows.map(function (r) {
  const item = {
    id: r.id,
    title: r.title,
    fileName: r.file_name,
    fileType: r.file_type,
    fileSize: r.file_size != null ? Number(r.file_size) : null,
    processingStatus: r.processing_status,
    storageKey: r.storage_key,
    ocrStatus: r.ocr_status != null ? r.ocr_status : null,
    extractionMethod: r.extraction_method != null ? r.extraction_method : null,
    ocrEngine: r.ocr_engine != null ? r.ocr_engine : null,
    ocrLanguages: r.ocr_languages != null ? r.ocr_languages : null,
    ocrAttempts: r.ocr_attempts != null ? Number(r.ocr_attempts) : null,
    ocrDurationMs: r.ocr_duration_ms != null ? Number(r.ocr_duration_ms) : null,
    hasOcrDerivedFile: r.has_ocr_derived_file === true,
    ocrDerivedFileName: r.ocr_derived_file_name != null ? r.ocr_derived_file_name : null,
    sheetCount: r.sheet_count != null ? Number(r.sheet_count) : null,
    tableRowCount: r.table_row_count != null ? Number(r.table_row_count) : null,
    tableColumnCount: r.table_column_count != null ? Number(r.table_column_count) : null,
    actualSheetCount: r.actual_sheet_count != null ? Number(r.actual_sheet_count) : 0,
    actualTableRowCount: r.actual_table_row_count != null ? Number(r.actual_table_row_count) : 0,
  };
  if (r.ocr_derived_checksum != null && String(r.ocr_derived_checksum).trim() !== '') {
    item.ocrDerivedChecksum = r.ocr_derived_checksum;
  }
  return item;
});

const totalBytes = items.reduce(function (sum, it) { return sum + (Number(it.fileSize) || 0); }, 0);
const byStatus = {};
items.forEach(function (it) {
  const st = it.processingStatus || 'unknown';
  byStatus[st] = (byStatus[st] || 0) + 1;
});
const tabularDocsCount = items.filter(function (it) { return it.extractionMethod === 'tabular'; }).length;
const tabularSheetsTotal = items.reduce(function (sum, it) { return sum + (Number(it.actualSheetCount) || 0); }, 0);
const tabularRowsTotal = items.reduce(function (sum, it) { return sum + (Number(it.actualTableRowCount) || 0); }, 0);

const now = new Date();
const exportObj = {
  version: 1,
  exportedAt: now.toISOString(),
  packing: 'inventory_only',
  excludes: ['.health-probe.tmp'],
  counts: {
    total: items.length,
    totalBytes,
    byStatus,
    tabular: { documents: tabularDocsCount, sheets: tabularSheetsTotal, rows: tabularRowsTotal },
  },
  documents: items,
};
const payloadText = JSON.stringify(exportObj);
const checksum = crypto.createHash('sha256').update(payloadText).digest('hex');
function pad(n) { return String(n).padStart(2, '0'); }
const ts = now.getUTCFullYear() + pad(now.getUTCMonth() + 1) + pad(now.getUTCDate()) + '_' + pad(now.getUTCHours()) + pad(now.getUTCMinutes()) + pad(now.getUTCSeconds());
const fileName = 'oftalmocentro_documents_' + ts + '.json';

return [{ json: { fileName, payloadText, checksum, recordsCount: items.length, fileSize: Buffer.byteLength(payloadText, 'utf8'), counts: exportObj.counts } }];
