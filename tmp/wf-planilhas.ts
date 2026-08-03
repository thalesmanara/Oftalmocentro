import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const startTrigger = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    position: [0, 0],
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'versionId', type: 'string' },
          { name: 'documentId', type: 'string' },
          { name: 'filePath', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
          { name: 'force', type: 'boolean' },
        ],
      },
    },
  },
  output: [{ versionId: 'v1', documentId: 'd1', filePath: '/files/x.xlsx', requestId: 'r1', userId: 'u1', sessionId: 's1', force: false }],
});

const auditoriaImportado = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria TABLE_IMPORTED',
    position: [220, 0],
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: expr("{{ $('Trigger').item.json.requestId }}"),
          userId: expr("{{ $('Trigger').item.json.userId }}"),
          sessionId: expr("{{ $('Trigger').item.json.sessionId }}"),
          action: 'TABLE_IMPORTED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Trigger').item.json.versionId }}"),
          success: true,
          metadata: expr("{{ { versionId: $('Trigger').item.json.versionId } }}"),
        },
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  output: [{ audit: { ok: true } }],
});

const chamarServicoTabular = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Chamar serviço tabular',
    position: [440, 0],
    parameters: {
      method: 'POST',
      url: 'http://tabular:8081/parse',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr("{{ { filePath: $('Trigger').item.json.filePath } }}"),
      options: {
        timeout: 150000,
        response: { response: { fullResponse: true, neverError: true, responseFormat: 'json' } },
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  output: [{ statusCode: 200, body: { ok: true, summary: {}, sheets: [], preview: {}, chunks: [], rows: [], extractedText: '', durationMs: 120, stats: {} } }],
});

const validarRespostaTabular = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Validar resposta tabular',
    position: [660, 0],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const resp = $input.first().json || {};
const statusCode = Number(resp.statusCode ?? resp.status ?? 0);
let body = resp.body;
if (typeof body === 'string') {
  try { body = JSON.parse(body); } catch (e) { body = null; }
}

if (!body || typeof body !== 'object') {
  return [{ json: {
    ok: false,
    code: 'TABLE_PROCESS_FAILED',
    message: 'Resposta inválida do serviço de planilhas.',
    statusCode: statusCode || 500,
    durationMs: null,
  } }];
}

if (statusCode < 200 || statusCode >= 300 || body.ok !== true) {
  return [{ json: {
    ok: false,
    code: body.code || 'TABLE_PROCESS_FAILED',
    message: body.message || 'Falha ao processar planilha.',
    statusCode: statusCode || 500,
    durationMs: body.durationMs != null ? Number(body.durationMs) : null,
  } }];
}

const summary = body.summary || {};
const sheets = Array.isArray(body.sheets) ? body.sheets : [];
const rows = Array.isArray(body.rows) ? body.rows : [];
const chunks = Array.isArray(body.chunks) ? body.chunks : [];
const preview = body.preview || {};

return [{ json: {
  ok: true,
  sheetCount: summary.sheetCount != null ? Number(summary.sheetCount) : sheets.length,
  rowCount: summary.rowCount != null ? Number(summary.rowCount) : rows.length,
  columnCount: summary.columnCount != null ? Number(summary.columnCount) : 0,
  chunkCount: chunks.length,
  durationMs: body.durationMs != null ? Number(body.durationMs) : null,
  extractedText: body.extractedText || '',
  summary,
  sheets,
  rows,
  chunks,
  preview,
} }];`,
    },
  },
  output: [{ ok: true, sheetCount: 1, rowCount: 10, columnCount: 5, chunkCount: 1, durationMs: 100, extractedText: 'sample' }],
});

const parseTabularOk = ifElse({
  version: 2.3,
  config: {
    name: 'Parse tabular ok?',
    position: [880, 0],
    parameters: {
      conditions: {
        options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'loose' },
        combinator: 'and',
        conditions: [{ id: 'pt1', leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true' }, rightValue: true }],
      },
      looseTypeValidation: true,
    },
  },
});

const auditoriaParsed = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria TABLE_PARSED',
    position: [1100, -140],
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: expr("{{ $('Trigger').item.json.requestId }}"),
          userId: expr("{{ $('Trigger').item.json.userId }}"),
          sessionId: expr("{{ $('Trigger').item.json.sessionId }}"),
          action: 'TABLE_PARSED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Trigger').item.json.versionId }}"),
          success: true,
          metadata: expr('{{ { sheetCount: $json.sheetCount, rowCount: $json.rowCount, columnCount: $json.columnCount, durationMs: $json.durationMs, chunkCount: $json.chunkCount } }}'),
        },
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  output: [{ audit: { ok: true } }],
});

const deletarDadosAntigos = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Deletar dados tabulares antigos',
    position: [1320, -140],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=DELETE FROM document_chunks WHERE document_version_id = '{{ $('Trigger').item.json.versionId }}'::uuid AND chunk_kind = 'tabular';
DELETE FROM document_table_rows WHERE document_version_id = '{{ $('Trigger').item.json.versionId }}'::uuid;
DELETE FROM document_sheets WHERE document_version_id = '{{ $('Trigger').item.json.versionId }}'::uuid;
SELECT '{{ $('Trigger').item.json.versionId }}'::uuid AS "versionId";`,
    },
    alwaysOutputData: true,
  },
  output: [{ versionId: 'v1' }],
});

const prepararItensTabulares = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Preparar itens tabulares',
    position: [1540, -140],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const parsed = $('Validar resposta tabular').first().json || {};
const trig = $('Trigger').first().json || {};
const versionId = trig.versionId;
const documentId = trig.documentId;

const MAX_ROWS_PERSIST = 5000;

const sheets = Array.isArray(parsed.sheets) ? parsed.sheets : [];
const rowsAll = Array.isArray(parsed.rows) ? parsed.rows : [];
const chunks = Array.isArray(parsed.chunks) ? parsed.chunks : [];
const rowsCapped = rowsAll.slice(0, MAX_ROWS_PERSIST);

const sheetsPayload = sheets.map((s) => ({
  sheetIndex: s.sheetIndex,
  sheetName: s.sheetName,
  rowCount: s.rowCount || 0,
  columnCount: s.columnCount || 0,
  headers: s.headers || [],
  hasMergedCells: !!s.hasMergedCells,
  metadata: s.metadata || {},
}));

const rowsPayload = rowsCapped.map((r) => ({
  sheetName: r.sheetName,
  rowNumber: r.rowNumber,
  isHeader: !!r.isHeader,
  cells: r.cells || [],
  rowText: r.rowText || '',
}));

const chunksPayload = chunks.map((c) => ({
  chunkOrder: c.chunkOrder,
  sheetName: c.sheetName || null,
  rowStart: c.rowStart == null ? null : c.rowStart,
  rowEnd: c.rowEnd == null ? null : c.rowEnd,
  headersJson: c.headersJson || [],
  chunkText: c.chunkText || '',
}));

return [{ json: {
  versionId,
  documentId,
  sheetsJson: JSON.stringify(sheetsPayload),
  rowsJson: JSON.stringify(rowsPayload),
  chunksJson: JSON.stringify(chunksPayload),
  tableSummaryJson: JSON.stringify(parsed.summary || {}),
  tablePreviewJson: JSON.stringify(parsed.preview || {}),
  extractedText: parsed.extractedText || '',
  sheetCount: parsed.sheetCount != null ? Number(parsed.sheetCount) : sheets.length,
  rowCount: parsed.rowCount != null ? Number(parsed.rowCount) : rowsAll.length,
  rowPersistedCount: rowsPayload.length,
  columnCount: parsed.columnCount != null ? Number(parsed.columnCount) : 0,
  chunkCount: chunksPayload.length,
  durationMs: parsed.durationMs,
} }];`,
    },
  },
  output: [{ versionId: 'v1', documentId: 'd1', sheetsJson: '[]', rowsJson: '[]', chunksJson: '[]', tableSummaryJson: '{}', tablePreviewJson: '{}', extractedText: 'sample', sheetCount: 1, rowCount: 10, rowPersistedCount: 10, columnCount: 5, chunkCount: 1 }],
});

const inserirAbas = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Inserir abas (document_sheets)',
    position: [1760, -140],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=INSERT INTO document_sheets (
  document_version_id, document_id, sheet_index, sheet_name,
  row_count, column_count, headers, has_merged_cells, metadata
)
SELECT
  '{{ $json.versionId }}'::uuid,
  '{{ $json.documentId }}'::uuid,
  (elem->>'sheetIndex')::int,
  elem->>'sheetName',
  COALESCE((elem->>'rowCount')::int, 0),
  COALESCE((elem->>'columnCount')::int, 0),
  COALESCE(elem->'headers', '[]'::jsonb),
  COALESCE((elem->>'hasMergedCells')::boolean, false),
  COALESCE(elem->'metadata', '{}'::jsonb)
FROM jsonb_array_elements('{{ $json.sheetsJson.replace(/'/g, "''") }}'::jsonb) AS elem
RETURNING id, sheet_name;`,
    },
    alwaysOutputData: true,
  },
  output: [{ id: 'sheet-1', sheet_name: 'Sheet1' }],
});

const auditoriaNormalized = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria TABLE_NORMALIZED',
    position: [1980, -140],
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: expr("{{ $('Trigger').item.json.requestId }}"),
          userId: expr("{{ $('Trigger').item.json.userId }}"),
          sessionId: expr("{{ $('Trigger').item.json.sessionId }}"),
          action: 'TABLE_NORMALIZED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Trigger').item.json.versionId }}"),
          success: true,
          metadata: expr("{{ { sheetCount: $('Preparar itens tabulares').item.json.sheetCount, rowCount: $('Preparar itens tabulares').item.json.rowCount } }}"),
        },
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  output: [{ audit: { ok: true } }],
});

const inserirLinhas = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Inserir linhas (document_table_rows)',
    position: [2200, -140],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=INSERT INTO document_table_rows (
  document_version_id, document_id, sheet_id, sheet_name,
  row_number, is_header, cells, row_text
)
SELECT
  '{{ $('Preparar itens tabulares').item.json.versionId }}'::uuid,
  '{{ $('Preparar itens tabulares').item.json.documentId }}'::uuid,
  ds.id,
  elem->>'sheetName',
  COALESCE((elem->>'rowNumber')::int, 0),
  COALESCE((elem->>'isHeader')::boolean, false),
  COALESCE(elem->'cells', '[]'::jsonb),
  COALESCE(elem->>'rowText', '')
FROM jsonb_array_elements('{{ $('Preparar itens tabulares').item.json.rowsJson.replace(/'/g, "''") }}'::jsonb) AS elem
LEFT JOIN document_sheets ds
  ON ds.document_version_id = '{{ $('Preparar itens tabulares').item.json.versionId }}'::uuid
  AND ds.sheet_name = elem->>'sheetName'
RETURNING id;`,
    },
    alwaysOutputData: true,
  },
  output: [{ id: 'row-1' }],
});

const inserirChunksTabulares = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Inserir chunks tabulares',
    position: [2420, -140],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=INSERT INTO document_chunks (
  document_id, document_version_id, chunk_order, chunk_text,
  chunk_kind, sheet_name, row_start, row_end, headers_json
)
SELECT
  '{{ $('Preparar itens tabulares').item.json.documentId }}'::uuid,
  '{{ $('Preparar itens tabulares').item.json.versionId }}'::uuid,
  COALESCE((elem->>'chunkOrder')::int, 0),
  COALESCE(elem->>'chunkText', ''),
  'tabular',
  elem->>'sheetName',
  (elem->>'rowStart')::int,
  (elem->>'rowEnd')::int,
  COALESCE(elem->'headersJson', '[]'::jsonb)
FROM jsonb_array_elements('{{ $('Preparar itens tabulares').item.json.chunksJson.replace(/'/g, "''") }}'::jsonb) AS elem
RETURNING id;`,
    },
    alwaysOutputData: true,
  },
  output: [{ id: 'chunk-1' }],
});

const atualizarVersaoTabular = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Atualizar versão (tabular)',
    position: [2640, -140],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=UPDATE document_versions
SET
  extraction_method = 'tabular',
  extracted_text = '{{ $('Preparar itens tabulares').item.json.extractedText.replace(/'/g, "''") }}',
  sheet_count = {{ Number($('Preparar itens tabulares').item.json.sheetCount) || 0 }},
  table_row_count = {{ Number($('Preparar itens tabulares').item.json.rowCount) || 0 }},
  table_column_count = {{ Number($('Preparar itens tabulares').item.json.columnCount) || 0 }},
  table_summary = '{{ $('Preparar itens tabulares').item.json.tableSummaryJson.replace(/'/g, "''") }}'::jsonb,
  table_preview = '{{ $('Preparar itens tabulares').item.json.tablePreviewJson.replace(/'/g, "''") }}'::jsonb,
  processing_status = 'processed',
  ocr_status = 'NOT_APPLICABLE',
  status = 'READY'
WHERE id = '{{ $('Preparar itens tabulares').item.json.versionId }}'::uuid
RETURNING
  id AS "versionId",
  document_id AS "documentId",
  sheet_count AS "sheetCount",
  table_row_count AS "tableRowCount",
  table_column_count AS "tableColumnCount",
  processing_status AS "processingStatus";`,
    },
    alwaysOutputData: true,
  },
  output: [{ versionId: 'v1', documentId: 'd1', sheetCount: 1, tableRowCount: 10, tableColumnCount: 5, processingStatus: 'processed' }],
});

const auditoriaChunked = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria TABLE_CHUNKED',
    position: [2860, -140],
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: expr("{{ $('Trigger').item.json.requestId }}"),
          userId: expr("{{ $('Trigger').item.json.userId }}"),
          sessionId: expr("{{ $('Trigger').item.json.sessionId }}"),
          action: 'TABLE_CHUNKED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Trigger').item.json.versionId }}"),
          success: true,
          metadata: expr("{{ { chunkCount: $('Preparar itens tabulares').item.json.chunkCount, sheetCount: $('Preparar itens tabulares').item.json.sheetCount, rowCount: $('Preparar itens tabulares').item.json.rowCount, durationMs: $('Preparar itens tabulares').item.json.durationMs } }}"),
        },
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoSucesso = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno sucesso',
    position: [3080, -140],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const prep = $('Preparar itens tabulares').first().json || {};
const updated = $('Atualizar versão (tabular)').first().json || {};
let chunksInserted = 0;
try { chunksInserted = $('Inserir chunks tabulares').all().length; } catch (e) { chunksInserted = 0; }

return [{ json: {
  ok: true,
  needOcr: false,
  extractionMethod: 'tabular',
  extractedText: prep.extractedText || '',
  textLength: (prep.extractedText || '').length,
  versionId: updated.versionId || prep.versionId,
  documentId: updated.documentId || prep.documentId,
  sheetCount: updated.sheetCount != null ? updated.sheetCount : prep.sheetCount,
  tableRowCount: updated.tableRowCount != null ? updated.tableRowCount : prep.rowCount,
  tableColumnCount: updated.tableColumnCount != null ? updated.tableColumnCount : prep.columnCount,
  chunkCount: chunksInserted || prep.chunkCount || 0,
  ocrStatus: 'NOT_APPLICABLE',
} }];`,
    },
  },
  output: [{ ok: true, needOcr: false, extractionMethod: 'tabular', extractedText: 'sample', textLength: 6, versionId: 'v1', documentId: 'd1', sheetCount: 1, tableRowCount: 10, tableColumnCount: 5, chunkCount: 1, ocrStatus: 'NOT_APPLICABLE' }],
});

const marcarFalhaTabular = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Marcar falha tabular',
    position: [1100, 160],
    parameters: {
      operation: 'executeQuery',
      options: {},
      query: `=UPDATE document_versions SET processing_status = 'failed', status = 'FAILED' WHERE id = '{{ $('Trigger').item.json.versionId }}'::uuid;
UPDATE documents SET processing_status = 'error', updated_at = NOW() WHERE id = '{{ $('Trigger').item.json.documentId }}'::uuid;
SELECT '{{ $json.code }}' AS code, '{{ String($json.message || "").replace(/'/g, "''") }}' AS message, {{ Number($json.statusCode) || 500 }} AS "statusCode", {{ $json.durationMs == null ? 'null' : Number($json.durationMs) }} AS "durationMs";`,
    },
    alwaysOutputData: true,
  },
  output: [{ code: 'TABLE_PROCESS_FAILED', message: 'Falha ao processar planilha.', statusCode: 500, durationMs: 50 }],
});

const auditoriaFailed = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.3,
  config: {
    name: 'Auditoria TABLE_PROCESS_FAILED',
    position: [1320, 160],
    parameters: {
      mode: 'once',
      source: 'database',
      options: { waitForSubWorkflow: true },
      workflowId: { __rl: true, mode: 'id', value: 'jtQvQlqRZ5X5WF9I', cachedResultName: 'AUDITORIA - REGISTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          requestId: expr("{{ $('Trigger').item.json.requestId }}"),
          userId: expr("{{ $('Trigger').item.json.userId }}"),
          sessionId: expr("{{ $('Trigger').item.json.sessionId }}"),
          action: 'TABLE_PROCESS_FAILED',
          resourceType: 'document_version',
          resourceId: expr("{{ $('Trigger').item.json.versionId }}"),
          success: false,
          errorCode: expr('{{ $json.code }}'),
          metadata: expr('{{ { code: $json.code, durationMs: $json.durationMs } }}'),
        },
      },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  },
  output: [{ audit: { ok: true } }],
});

const montarRetornoFalha = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Montar retorno falha',
    position: [1540, 160],
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `const fail = $('Marcar falha tabular').first().json || {};
const trig = $('Trigger').first().json || {};
return [{ json: {
  ok: false,
  code: fail.code || 'TABLE_PROCESS_FAILED',
  message: fail.message || 'Falha ao processar planilha.',
  statusCode: Number(fail.statusCode) || 500,
  versionId: trig.versionId,
  documentId: trig.documentId,
} }];`,
    },
  },
  output: [{ ok: false, code: 'TABLE_PROCESS_FAILED', message: 'Falha ao processar planilha.', statusCode: 500, versionId: 'v1', documentId: 'd1' }],
});

export default workflow('planilhas-extrair-estruturado', 'PLANILHAS - EXTRAIR ESTRUTURADO')
  .add(startTrigger)
  .to(auditoriaImportado)
  .to(chamarServicoTabular)
  .to(validarRespostaTabular)
  .to(parseTabularOk
    .onTrue(auditoriaParsed
      .to(deletarDadosAntigos)
      .to(prepararItensTabulares)
      .to(inserirAbas)
      .to(auditoriaNormalized)
      .to(inserirLinhas)
      .to(inserirChunksTabulares)
      .to(atualizarVersaoTabular)
      .to(auditoriaChunked)
      .to(montarRetornoSucesso))
    .onFalse(marcarFalhaTabular
      .to(auditoriaFailed)
      .to(montarRetornoFalha)));
