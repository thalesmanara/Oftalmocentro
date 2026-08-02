#!/usr/bin/env node
/**
 * Build n8n update_workflow operations for advanced request tracking propagation.
 */

const TRACKING = {
  requestStartedAtMs: "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
  method: "={{ $('Normalizar request').first().json.method }}",
  path: "={{ $('Normalizar request').first().json.path }}",
};

const JSON_RESP_HEADER_ENTRIES = [
  {
    name: 'X-Request-Id',
    value: '={{ $json.responseHeaders && $json.responseHeaders["X-Request-Id"] ? $json.responseHeaders["X-Request-Id"] : ($json.requestId || "") }}',
  },
  {
    name: 'X-Response-Time-Ms',
    value: '={{ $json.responseHeaders && $json.responseHeaders["X-Response-Time-Ms"] ? $json.responseHeaders["X-Response-Time-Ms"] : String($json.durationMs || 0) }}',
  },
];

const BINARY_RESP_HEADER_ENTRIES = [
  {
    name: 'X-Request-Id',
    value: "={{ $('Normalizar request').first().json.requestId }}",
  },
  {
    name: 'X-Response-Time-Ms',
    value: "={{ String(Math.max(0, Date.now() - Number($('Normalizar request').first().json.requestStartedAtMs || Date.now()))) }}",
  },
];

function matches(name, pattern) {
  const n = name.toLowerCase();
  if (pattern === 'normalizar') return n === 'normalizar request';
  if (pattern === 'auth') return n === 'validar auth';
  if (pattern === 'perm') return n === 'validar permissão' || n === 'validar permissao';
  if (pattern === 'sucesso') return n === 'preparar sucesso';
  if (pattern === 'erro') return n.startsWith('preparar erro');
  if (pattern === 'respond') return n.startsWith('respond');
  if (pattern === 'coletar') return n === 'coletar lista';
  if (pattern === 'montar') return n === 'montar data';
  return false;
}

function hasNode(nodes, pattern) {
  return nodes.some((n) => matches(n.name, pattern));
}

function authSnippet(hasAuth) {
  if (!hasAuth) return { block: '', fields: '' };
  return {
    block: `\nlet userId = '';\nlet sessionId = '';\ntry { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}`,
    fields: ', userId, sessionId',
  };
}

function enhanceDataCode(code, hasAuth) {
  if (code.includes('requestStartedAtMs')) return null;

  const { block, fields } = authSnippet(hasAuth);

  // Coletar lista pattern
  if (code.includes('.filter((j) => j && j.id)') || code.includes('.filter((j) => j && (j.id || j.code))')) {
    const statusMatch = code.match(/statusCode:\s*(\d+)/);
    const statusCode = statusMatch ? statusMatch[1] : '200';
    const filterExpr = code.includes('j.code')
      ? '.filter((j) => j && (j.id || j.code))'
      : '.filter((j) => j && j.id)';
    return `const rows = $input.all().map((i) => i.json)${filterExpr};
const norm = $('Normalizar request').first().json;${block}
return [{ json: { data: rows, asList: true, statusCode: ${statusCode}, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path${fields} } }];`;
  }

  // Montar data with auth input (AUTH VALIDATE)
  if (code.includes('const auth = $input.first().json')) {
    const statusMatch = code.match(/statusCode:\s*(\d+)/);
    const statusCode = statusMatch ? statusMatch[1] : '200';
    return `const auth = $input.first().json;
const norm = $('Normalizar request').first().json;
return [{
  json: {
    data: {
      user: auth.user,
      permissions: auth.permissions || (auth.user && auth.user.permissions) || [],
      sessionId: auth.sessionId || null,
      userId: auth.userId || (auth.user && auth.user.id) || null,
    },
    statusCode: ${statusCode},
    requestId: norm.requestId,
    requestStartedAtMs: norm.requestStartedAtMs,
    method: norm.method,
    path: norm.path,
    userId: auth.userId || (auth.user && auth.user.id) || '',
    sessionId: auth.sessionId || '',
  },
}];`;
  }

  // Montar data pattern - extract statusCode and asList from existing
  if (code.includes('$input.first().json')) {
    const statusMatch = code.match(/statusCode:\s*(\d+|[^,}\n]+)/);
    const asListMatch = code.match(/asList:\s*(true|false|\$json\.asList)/);
    const statusCode = statusMatch ? statusMatch[1].trim() : '200';
    const asListPart = asListMatch ? `, asList: ${asListMatch[1].trim()}` : '';

    if (code.includes('{ deleted: true }')) {
      return `const row = $input.first().json || {};
const norm = $('Normalizar request').first().json;${block}
const data = row && row.id ? row : { deleted: true };
return [{ json: { data, asList: false, statusCode: ${statusCode}, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path${fields} } }];`;
    }

    if (code.includes('row.id ? row : null')) {
      return `const row = $input.first().json || {};
const norm = $('Normalizar request').first().json;${block}
return [{ json: { data: row.id ? row : null, statusCode: ${statusCode}, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path${asListPart}${fields} } }];`;
    }

    if (code.includes('hasId')) {
      return `const row = $input.first().json || {};
const norm = $('Normalizar request').first().json;${block}
const hasId = Boolean(row && row.id);
return [{ json: { data: hasId ? row : row, asList: false, statusCode: ${statusCode}, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path${fields} } }];`;
    }

    return `const row = $input.first().json || {};
const norm = $('Normalizar request').first().json;${block}
return [{ json: { data: row, statusCode: ${statusCode}, requestId: norm.requestId, requestStartedAtMs: norm.requestStartedAtMs, method: norm.method, path: norm.path${asListPart}${fields} } }];`;
  }

  return null;
}

function buildOps(workflow) {
  const nodes = workflow.workflow?.nodes || workflow.nodes || [];
  const ops = [];
  const hasAuth = hasNode(nodes, 'auth');
  const hasNorm = hasNode(nodes, 'normalizar');

  if (!hasNorm) {
    return { ops: [], note: 'Missing Normalizar request node' };
  }

  for (const node of nodes) {
    const name = node.name;
    const params = node.parameters || {};

    if (matches(name, 'auth')) {
      const existing = params.workflowInputs?.value || {};
      ops.push({
        type: 'updateNodeParameters',
        nodeName: name,
        parameters: {
          workflowInputs: {
            mappingMode: 'defineBelow',
            value: {
              ...existing,
              authorization:
                existing.authorization ||
                "={{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}",
              requestId: "={{ $json.requestId || '' }}",
            },
          },
        },
      });
    }

    if (matches(name, 'perm')) {
      const existing = params.workflowInputs?.value || {};
      ops.push({
        type: 'updateNodeParameters',
        nodeName: name,
        parameters: {
          workflowInputs: {
            mappingMode: 'defineBelow',
            value: {
              ...existing,
              requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}",
            },
          },
        },
      });
    }

    if (matches(name, 'sucesso')) {
      const existing = params.workflowInputs?.value || {};
      const value = {
        ...existing,
        requestId: "={{ $json.requestId || $('Normalizar request').first().json.requestId }}",
        requestStartedAtMs: TRACKING.requestStartedAtMs,
        method: TRACKING.method,
        path: TRACKING.path,
      };
      if (hasAuth) {
        value.userId = "={{ $('Validar auth').first().json.userId || '' }}";
        value.sessionId = "={{ $('Validar auth').first().json.sessionId || '' }}";
      }
      ops.push({
        type: 'updateNodeParameters',
        nodeName: name,
        parameters: {
          workflowInputs: {
            mappingMode: 'defineBelow',
            value,
          },
        },
      });
    }

    if (matches(name, 'erro')) {
      const existing = params.workflowInputs?.value || {};
      ops.push({
        type: 'updateNodeParameters',
        nodeName: name,
        parameters: {
          workflowInputs: {
            mappingMode: 'defineBelow',
            value: {
              ...existing,
              requestId: "={{ $('Normalizar request').first().json.requestId }}",
              requestStartedAtMs: TRACKING.requestStartedAtMs,
              method: TRACKING.method,
              path: TRACKING.path,
            },
          },
        },
      });
    }

    if ((matches(name, 'coletar') || matches(name, 'montar')) && params.jsCode) {
      const newCode = enhanceDataCode(params.jsCode, hasAuth);
      if (newCode && newCode !== params.jsCode) {
        ops.push({
          type: 'updateNodeParameters',
          nodeName: name,
          parameters: { jsCode: newCode },
        });
      }
    }

    if (matches(name, 'respond') && params.respondWith === 'json') {
      const existingOptions = params.options || {};
      ops.push({
        type: 'updateNodeParameters',
        nodeName: name,
        parameters: {
          respondWith: 'json',
          responseBody: params.responseBody || '={{ $json.response }}',
          options: {
            ...existingOptions,
            responseHeaders: {
              entries: JSON_RESP_HEADER_ENTRIES,
            },
          },
        },
      });
    }

    if (name === 'Respond to Webhook' && params.respondWith === 'binary') {
      const existingEntries = params.options?.responseHeaders?.entries || [];
      const keep = existingEntries.filter(
        (e) => e.name !== 'X-Request-Id' && e.name !== 'X-Response-Time-Ms'
      );
      ops.push({
        type: 'updateNodeParameters',
        nodeName: name,
        parameters: {
          respondWith: 'binary',
          responseDataSource: params.responseDataSource || 'set',
          options: {
            ...(params.options || {}),
            responseHeaders: {
              entries: [...keep, ...BINARY_RESP_HEADER_ENTRIES],
            },
          },
        },
      });
    }
  }

  return { ops, note: null };
}

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

export { buildOps };

const __dirname = dirname(fileURLToPath(import.meta.url));
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const input = process.argv[2]
    ? readFileSync(process.argv[2], 'utf8')
    : readFileSync(0, 'utf8');
  const data = JSON.parse(input);
  const result = buildOps(data);
  const workflowId = data.workflow?.id || data.id;
  const payload = { workflowId, ...result };

  if (process.argv[3] === '--mcp') {
    mkdirSync(join(__dirname, '..', 'tmp', 'n8n-ops'), { recursive: true });
    if (workflowId) {
      writeFileSync(join(__dirname, '..', 'tmp', 'n8n-ops', `${workflowId}.json`), JSON.stringify({ workflowId, operations: result.ops }));
    }
  }

  console.log(JSON.stringify(payload, null, 2));
}
