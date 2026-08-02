#!/usr/bin/env node
/**
 * Generates update_workflow operations to instrument mutation workflows with AUDITORIA - REGISTRAR.
 * Output: JSON files per batch for MCP update_workflow calls.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const AUDIT_WF = 'jtQvQlqRZ5X5WF9I';
const makeRepassarJs = (prepNode) => `const prep = $('${prepNode}').first().json || {};
const audit = $input.first().json || {};
return [{ json: audit.response != null ? audit : prep }];`;

function registrarNode(name, position, inputs) {
  return {
    type: 'addNode',
    node: {
      id: randomUUID(),
      name,
      type: 'n8n-nodes-base.executeWorkflow',
      typeVersion: 1.3,
      position,
      parameters: {
        source: 'database',
        workflowId: { __rl: true, mode: 'id', value: AUDIT_WF, cachedResultName: 'AUDITORIA - REGISTRAR' },
        mode: 'once',
        options: { waitForSubWorkflow: true },
        workflowInputs: { mappingMode: 'defineBelow', value: inputs },
      },
    },
  };
}

function repassarNode(name, position, prepNode) {
  return {
    type: 'addNode',
    node: {
      id: randomUUID(),
      name,
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position,
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: makeRepassarJs(prepNode),
      },
    },
  };
}

function baseAuditInputs(action, resourceType, extra = {}) {
  return {
    requestId: '={{ $json.requestId }}',
    tracking: '={{ $json.tracking }}',
    response: '={{ $json.response }}',
    responseHeaders: '={{ $json.responseHeaders }}',
    headers: "={{ $('Normalizar request').first().json.headers || {} }}",
    action: typeof action === 'string' && action.startsWith('=') ? action : action,
    resourceType,
    resourceId:
      extra.resourceId ||
      "={{ $json.response?.data?.id || $('Webhook').first().json.body?.id || '' }}",
    success: extra.success !== undefined ? extra.success : '={{ $json.tracking?.success !== false }}',
    userId: "={{ $json.tracking?.userId || '' }}",
    sessionId: "={{ $json.tracking?.sessionId || '' }}",
    method: "={{ $json.tracking?.method || $('Normalizar request').first().json.method }}",
    path: "={{ $json.tracking?.path || $('Normalizar request').first().json.path }}",
    statusCode: '={{ $json.statusCode }}',
    durationMs: '={{ $json.durationMs }}',
    errorCode:
      extra.errorCode ||
      "={{ $json.tracking?.errorCode || ($json.response?.error?.code ?? null) }}",
    beforeData: extra.beforeData || '={{ null }}',
    afterData: extra.afterData || '={{ null }}',
    metadata: extra.metadata || '={{ {} }}',
  };
}

function wireAuditPath(ops, { prepNode, respondNode, registrarName, repassarName, regPos, repPos, inputs }) {
  ops.push(registrarNode(registrarName, regPos, inputs));
  ops.push(repassarNode(repassarName, repPos, prepNode));
  ops.push({
    type: 'setNodeSettings',
    nodeName: registrarName,
    settings: { onError: 'continueRegularOutput', alwaysOutputData: true },
  });
  ops.push({ type: 'removeConnection', source: prepNode, target: respondNode });
  ops.push({ type: 'addConnection', source: prepNode, target: registrarName });
  ops.push({ type: 'addConnection', source: registrarName, target: repassarName });
  ops.push({ type: 'addConnection', source: repassarName, target: respondNode });
}

const userAfterCreate =
  "={{ (() => { const d = $json.response?.data || {}; return { name: d.name, email: d.email, sectorId: d.sectorId, active: d.active, isMaster: d.isMaster, permissions: d.permissions }; })() }}";

const userAfterUpdate =
  "={{ (() => { const d = $json.response?.data || {}; return { name: d.name, email: d.email, sectorId: d.sectorId, active: d.active, isMaster: d.isMaster, permissions: d.permissions }; })() }}";

const userBeforeUpdate =
  "={{ (() => { const b = $('Webhook').first().json.body || {}; return { name: b.name, email: b.email, sectorId: b.sectorId, active: b.active, isMaster: b.isMaster, permissions: b.permissions }; })() }}";

const entityAfter =
  '={{ $json.response?.data ? { name: $json.response.data.name, description: $json.response.data.description, active: $json.response.data.active } : null }}';

const entityBefore =
  "={{ (() => { const b = $('Webhook').first().json.body || {}; return { name: b.name, description: b.description, active: b.active }; })() }}";

const subAfter =
  '={{ $json.response?.data ? { categoryId: $json.response.data.categoryId, name: $json.response.data.name, description: $json.response.data.description, active: $json.response.data.active } : null }}';

const settingsAfter =
  "={{ (() => { const d = $json.response?.data || {}; return { systemName: d.systemName, clinicName: d.clinicName, logoUrl: d.logoUrl, primaryColor: d.primaryColor, secondaryColor: d.secondaryColor }; })() }}";

const settingsBefore =
  "={{ (() => { const b = $('Webhook').first().json.body || {}; return { systemName: b.systemName, clinicName: b.clinicName, logoUrl: b.logoUrl, primaryColor: b.primaryColor, secondaryColor: b.secondaryColor }; })() }}";

const WORKFLOWS = [
  {
    id: 'gCEgRsZzch3l7mfD',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1220, -40],
        repPos: [1440, -40],
        inputs: baseAuditInputs('USER_CREATE', 'user', { afterData: userAfterCreate }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('USER_CREATE', 'user', {
          success: false,
          afterData: "={{ (() => { const b = $('Webhook').first().json.body || {}; return { name: b.name, email: b.email }; })() }}",
        }),
      },
      {
        prep: 'Preparar erro 409',
        respond: 'Respond 409',
        reg: 'Registrar auditoria 409',
        rep: 'Repassar resposta 409',
        regPos: [1220, 200],
        repPos: [1440, 200],
        inputs: baseAuditInputs('USER_CREATE', 'user', {
          success: false,
          afterData: "={{ (() => { const b = $('Webhook').first().json.body || {}; return { email: b.email }; })() }}",
        }),
      },
    ],
  },
  {
    id: 'z63rJlQKqheFBw4u',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1660, -40],
        repPos: [1880, -40],
        inputs: baseAuditInputs('USER_UPDATE', 'user', {
          beforeData: userBeforeUpdate,
          afterData: userAfterUpdate,
        }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('USER_UPDATE', 'user', {
          success: false,
          resourceId: "={{ $('Webhook').first().json.body?.id || '' }}",
          beforeData: userBeforeUpdate,
        }),
      },
    ],
  },
  {
    id: 'a7EsJH9zcj7SMEnM',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1220, -40],
        repPos: [1440, -40],
        inputs: baseAuditInputs('USER_INACTIVATE', 'user', {
          afterData: userAfterUpdate,
          metadata: '={{ { softDelete: true, inactive: true } }}',
        }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('USER_INACTIVATE', 'user', {
          success: false,
          resourceId: "={{ $('Webhook').first().json.body?.id || '' }}",
        }),
      },
    ],
  },
  {
    id: 'oyTndr1NgGRbbsTt',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SECTOR_CREATE', 'sector', { afterData: entityAfter }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SECTOR_CREATE', 'sector', { success: false, afterData: entityBefore }),
      },
    ],
  },
  {
    id: 'eyRMMc4qCzGf9naj',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SECTOR_UPDATE', 'sector', { beforeData: entityBefore, afterData: entityAfter }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SECTOR_UPDATE', 'sector', { success: false, beforeData: entityBefore }),
      },
    ],
  },
  {
    id: 'WMj1pu9mllQsZk2x',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SECTOR_INACTIVATE', 'sector', {
          afterData: entityAfter,
          metadata: '={{ { softDelete: true } }}',
        }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SECTOR_INACTIVATE', 'sector', { success: false }),
      },
    ],
  },
  {
    id: '6ZZlCncPKX4fGVmI',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('CATEGORY_CREATE', 'category', { afterData: entityAfter }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('CATEGORY_CREATE', 'category', { success: false, afterData: entityBefore }),
      },
    ],
  },
  {
    id: '4BnWd26yROvl0Ots',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('CATEGORY_UPDATE', 'category', { beforeData: entityBefore, afterData: entityAfter }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('CATEGORY_UPDATE', 'category', { success: false, beforeData: entityBefore }),
      },
    ],
  },
  {
    id: 'FaSIMuXIHeiVJe29',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('CATEGORY_INACTIVATE', 'category', {
          afterData: entityAfter,
          metadata: '={{ { softDelete: true } }}',
        }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('CATEGORY_INACTIVATE', 'category', { success: false }),
      },
    ],
  },
  {
    id: 'ZckYIZpMtw6HEtIs',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SUBCATEGORY_CREATE', 'subcategory', { afterData: subAfter }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SUBCATEGORY_CREATE', 'subcategory', { success: false, afterData: subAfter }),
      },
    ],
  },
  {
    id: 'T6CGZB4oxlzXlTQZ',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SUBCATEGORY_UPDATE', 'subcategory', { beforeData: subAfter, afterData: subAfter }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SUBCATEGORY_UPDATE', 'subcategory', { success: false }),
      },
    ],
  },
  {
    id: '0ieW448wLfITZSlD',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SUBCATEGORY_INACTIVATE', 'subcategory', {
          afterData: subAfter,
          metadata: '={{ { softDelete: true } }}',
        }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SUBCATEGORY_INACTIVATE', 'subcategory', { success: false }),
      },
    ],
  },
  {
    id: 'ukDndCZDzemWsOMk',
    paths: [
      {
        prep: 'Preparar sucesso',
        respond: 'Respond to Webhook',
        reg: 'Registrar auditoria',
        rep: 'Repassar resposta',
        regPos: [1060, -40],
        repPos: [1280, -40],
        inputs: baseAuditInputs('SETTINGS_UPDATE', 'settings', {
          beforeData: settingsBefore,
          afterData: settingsAfter,
          resourceId: "={{ $json.response?.data?.id || $('Webhook').first().json.body?.id || '' }}",
        }),
      },
      {
        prep: 'Preparar erro 403',
        respond: 'Respond 403',
        reg: 'Registrar auditoria 403',
        rep: 'Repassar resposta 403',
        regPos: [1180, 120],
        repPos: [1400, 120],
        inputs: baseAuditInputs('SETTINGS_UPDATE', 'settings', {
          success: false,
          beforeData: settingsBefore,
        }),
      },
    ],
  },
];

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'audit-instrument');
mkdirSync(outDir, { recursive: true });

const batches = [];
for (const wf of WORKFLOWS) {
  const ops = [];
  for (const p of wf.paths) {
    wireAuditPath(ops, {
      prepNode: p.prep,
      respondNode: p.respond,
      registrarName: p.reg,
      repassarName: p.rep,
      regPos: p.regPos,
      repPos: p.repPos,
      inputs: p.inputs,
    });
  }
  const payload = { workflowId: wf.id, operations: ops };
  writeFileSync(join(outDir, `${wf.id}.json`), JSON.stringify(payload, null, 2));
  batches.push({ id: wf.id, opCount: ops.length });
}

writeFileSync(join(outDir, 'index.json'), JSON.stringify(batches, null, 2));
console.log(JSON.stringify(batches, null, 2));
