import fs from 'fs'

const sanitizeJs = fs.readFileSync('tmp/auditoria-registrar-code.js', 'utf8')

const finalizeJs = `const prep = $('Sanitizar').first();
const base = prep.json || {};
const insertRow = $input.first().json || {};
const auditId = insertRow.id || null;
const result = {
  json: {
    statusCode: base.statusCode,
    requestId: base.requestId,
    durationMs: base.durationMs,
    response: base.response,
    responseHeaders: base.responseHeaders,
    tracking: base.tracking,
    audit: { ...(base.audit || {}), ok: !!auditId, id: auditId },
  },
};
if (prep.binary) result.binary = prep.binary;
return [result];`

const skipJs = `const prep = $('Sanitizar').first();
const base = prep.json || {};
const result = {
  json: {
    statusCode: base.statusCode,
    requestId: base.requestId,
    durationMs: base.durationMs,
    response: base.response,
    responseHeaders: base.responseHeaders,
    tracking: base.tracking,
    audit: { ...(base.audit || {}), ok: false, id: null },
  },
};
if (prep.binary) result.binary = prep.binary;
return [result];`

const q = (s) => JSON.stringify(s)

const code = `import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const sanitizeJs = ${q(sanitizeJs)};
const finalizeJs = ${q(finalizeJs)};
const skipJs = ${q(skipJs)};

const triggerNode = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'requestId', type: 'string' },
          { name: 'occurredAt', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
          { name: 'action', type: 'string' },
          { name: 'resourceType', type: 'string' },
          { name: 'resourceId', type: 'string' },
          { name: 'success', type: 'boolean' },
          { name: 'method', type: 'string' },
          { name: 'path', type: 'string' },
          { name: 'statusCode', type: 'number' },
          { name: 'durationMs', type: 'number' },
          { name: 'ipAddress', type: 'string' },
          { name: 'userAgent', type: 'string' },
          { name: 'beforeData', type: 'object' },
          { name: 'afterData', type: 'object' },
          { name: 'metadata', type: 'object' },
          { name: 'errorCode', type: 'string' },
          { name: 'headers', type: 'object' },
          { name: 'tracking', type: 'object' },
          { name: 'response', type: 'object' },
          { name: 'responseHeaders', type: 'object' },
          { name: 'skipAudit', type: 'boolean' },
        ],
      },
    },
  },
});

const sanitize = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Sanitizar',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: sanitizeJs },
  },
});

const shouldInsert = ifElse({
  version: 2.3,
  config: {
    name: 'Deve gravar?',
    parameters: {
      conditions: {
        combinator: 'and',
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{
          id: 'ins',
          leftValue: expr('{{ $json._auditInsert != null }}'),
          rightValue: true,
          operator: { type: 'boolean', operation: 'true' },
        }],
      },
      looseTypeValidation: true,
    },
  },
});

const insertQuery = ${q(`INSERT INTO audit_logs (
  occurred_at, user_id, session_id, action, resource_type, resource_id,
  success, request_id, method, path, status_code, duration_ms,
  ip_address, user_agent, before_data, after_data, metadata, error_code,
  entity, entity_id
) VALUES (
  '{{ $json._auditInsert.occurredAt }}'::timestamptz,
  NULLIF('{{ $json._auditInsert.userId || "" }}', '')::uuid,
  NULLIF('{{ $json._auditInsert.sessionId || "" }}', '')::uuid,
  '{{ String($json._auditInsert.action || "").replace(/'/g, "''") }}',
  '{{ String($json._auditInsert.resourceType || "").replace(/'/g, "''") }}',
  NULLIF('{{ $json._auditInsert.resourceId || "" }}', '')::uuid,
  {{ $json._auditInsert.success === true }},
  '{{ $json._auditInsert.requestId }}'::uuid,
  NULLIF('{{ String($json._auditInsert.method || "").replace(/'/g, "''") }}', ''),
  NULLIF('{{ String($json._auditInsert.path || "").replace(/'/g, "''") }}', ''),
  NULLIF('{{ $json._auditInsert.statusCode == null ? "" : String($json._auditInsert.statusCode) }}', '')::int,
  NULLIF('{{ $json._auditInsert.durationMs == null ? "" : String($json._auditInsert.durationMs) }}', '')::int,
  NULLIF('{{ $json._auditInsert.ipAddress || "" }}', '')::inet,
  NULLIF('{{ String($json._auditInsert.userAgent || "").replace(/'/g, "''") }}', ''),
  COALESCE(NULLIF('{{ JSON.stringify($json._auditInsert.beforeData ?? null).replace(/'/g, "''") }}', ''), 'null')::jsonb,
  COALESCE(NULLIF('{{ JSON.stringify($json._auditInsert.afterData ?? null).replace(/'/g, "''") }}', ''), 'null')::jsonb,
  COALESCE(NULLIF('{{ JSON.stringify($json._auditInsert.metadata ?? null).replace(/'/g, "''") }}', ''), 'null')::jsonb,
  NULLIF('{{ String($json._auditInsert.errorCode || "").replace(/'/g, "''") }}', ''),
  NULLIF('{{ String($json._auditInsert.entity || $json._auditInsert.resourceType || "").replace(/'/g, "''") }}', ''),
  NULLIF('{{ $json._auditInsert.entityId || $json._auditInsert.resourceId || "" }}', '')::uuid
)
RETURNING id;`)};

const insert = node({
  type: 'n8n-nodes-base.postgres',
  version: 2.6,
  config: {
    name: 'Inserir audit_logs',
    credentials: { postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' } },
    parameters: {
      operation: 'executeQuery',
      query: insertQuery,
      options: {},
    },
  },
});

const finalizeOk = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalizar',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: finalizeJs },
  },
});

const finalizeSkip = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalizar skip',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: skipJs },
  },
});

export default workflow('auditoria-registrar', 'AUDITORIA - REGISTRAR')
  .add(triggerNode)
  .to(sanitize)
  .to(shouldInsert.onTrue(insert.to(finalizeOk)).onFalse(finalizeSkip));
`

fs.writeFileSync('tmp/auditoria-registrar.workflow.js', code)
console.log('wrote', code.length)
