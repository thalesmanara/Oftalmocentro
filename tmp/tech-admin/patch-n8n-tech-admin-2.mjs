#!/usr/bin/env node
/**
 * Continuação do patch tech-admin (auth users + endpoints).
 * VALIDAR PERMISSÃO já foi atualizado.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const log = [];
const note = (msg, extra) => {
  log.push({ msg, extra });
  console.log(msg, extra ?? '');
};

async function loadWf(id) {
  const { rows } = await c.query(
    `SELECT id, name, nodes, connections, active FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) throw new Error('missing ' + id);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes),
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : structuredClone(rows[0].connections),
  };
}

async function saveWf(wf, description) {
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(wf.nodes);
  const connJson = JSON.stringify(wf.connections);
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa28.1-tech-admin',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, wf.id, nodesJson, connJson, wf.name, description],
  );
  await c.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [nodesJson, connJson, versionId, wf.id],
  );
  await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [wf.id]);
  await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [wf.id]);
  await c.query('COMMIT');
  note('saved', { id: wf.id, name: wf.name, versionId });
}

function findNode(nodes, re) {
  return nodes.find((n) => re.test(n.name));
}

function getAssignList(node) {
  if (!node?.parameters) return null;
  if (node.parameters.assignments?.assignments) return node.parameters.assignments.assignments;
  if (node.parameters.values?.assignments) return node.parameters.values.assignments;
  return null;
}

function ensureAssign(list, name, value, type = 'boolean') {
  const existing = list.find((a) => a.name === name);
  if (existing) {
    existing.value = value;
    existing.type = type;
  } else {
    list.push({ id: randomUUID(), name, value, type });
  }
}

function patchIsMasterSelect(q) {
  if (/is_technical_admin/.test(q)) return q;
  return q
    .replace(
      /u\.is_master AS "isMaster",/g,
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin",',
    )
    .replace(
      /u\.is_master,\n(\s*)u\.created_at/g,
      'u.is_master,\n$1u.is_technical_admin,\n$1u.created_at',
    )
    .replace(
      /u\.is_master,\n(\s*)u\.password_hash/g,
      'u.is_master,\n$1u.is_technical_admin,\n$1u.password_hash',
    )
    .replace(
      /m\.is_master,\n(\s*)m\.permissions/g,
      'm.is_master,\n$1m.is_technical_admin,\n$1m.permissions',
    );
}

const USER_OBJ =
  "={{ ({ id: $json.userId, name: $json.name, email: $json.email, sectorId: $json.sectorId, sectorName: $json.sectorName, active: $json.active, isMaster: $json.isMaster === true, isTechnicalAdmin: $json.isTechnicalAdmin === true, permissions: Array.isArray($json.permissions) ? $json.permissions : [] }) }}";

// CARREGAR USUÁRIO
{
  const wf = await loadWf('FJRbZWYX2pokOa0m');
  const load = findNode(wf.nodes, /Carregar usu/i);
  const ok = findNode(wf.nodes, /Usuário OK/i);
  load.parameters.query = patchIsMasterSelect(load.parameters.query);
  const assigns = getAssignList(ok);
  const userA = assigns.find((a) => a.name === 'user');
  if (userA) userA.value = USER_OBJ;
  ensureAssign(assigns, 'isMaster', '={{ $json.isMaster === true }}', 'boolean');
  ensureAssign(assigns, 'isTechnicalAdmin', '={{ $json.isTechnicalAdmin === true }}', 'boolean');
  await saveWf(wf, 'Return isTechnicalAdmin');
}

// VALIDAR TOKEN
{
  const wf = await loadWf('P5E43ZXSJiI9wFYD');
  const sess = findNode(wf.nodes, /Validar sess/i);
  const ok = findNode(wf.nodes, /^Auth OK$/i);
  sess.parameters.query = patchIsMasterSelect(sess.parameters.query);
  const assigns = getAssignList(ok);
  const userA = assigns.find((a) => a.name === 'user');
  if (userA) userA.value = USER_OBJ;
  ensureAssign(assigns, 'isMaster', '={{ $json.isMaster === true }}', 'boolean');
  ensureAssign(assigns, 'isTechnicalAdmin', '={{ $json.isTechnicalAdmin === true }}', 'boolean');
  await saveWf(wf, 'Return isTechnicalAdmin on token');
}

// LOGIN
{
  const wf = await loadWf('Oyt4aCpmjStLdYvO');
  const buscar = findNode(wf.nodes, /Buscar usu/i);
  const assinar = findNode(wf.nodes, /Assinar JWT/i);
  buscar.parameters.query = patchIsMasterSelect(buscar.parameters.query);
  if (!/isTechnicalAdmin/.test(assinar.parameters.jsCode)) {
    assinar.parameters.jsCode = assinar.parameters.jsCode.replace(
      /isMaster:\s*user\.is_master,/,
      'isMaster: user.is_master === true,\n      isTechnicalAdmin: user.is_technical_admin === true,',
    );
  }
  await saveWf(wf, 'Login returns isTechnicalAdmin');
}

// GET Usuários
{
  const wf = await loadWf('pkQiNqpkrRgSM4Wa');
  const sql = wf.nodes.find((n) => n.parameters?.query?.includes('FROM users'));
  sql.parameters.query = patchIsMasterSelect(sql.parameters.query);
  await saveWf(wf, 'GET users isTechnicalAdmin');
}

const PRIV_CREATE = `const auth = $('Validar auth').first().json || {};
const body = $('Webhook').first().json.body || {};
const actor = auth.user || {};
const actorIsMaster = actor.isMaster === true || actor.is_master === true || auth.isMaster === true;
const wantMaster = body.isMaster === true || body.isMaster === 'true' || body.is_master === true;
const wantTech = body.isTechnicalAdmin === true || body.isTechnicalAdmin === 'true' || body.is_technical_admin === true || body.is_technical_admin === 'true';
let code = null; let message = null;
if (!actorIsMaster && (wantMaster || wantTech)) {
  code = 'PRIVILEGE_ESCALATION_DENIED';
  message = 'Somente usuário master pode definir Master ou Administrador Técnico.';
}
const isMaster = actorIsMaster && wantMaster;
const isTechnicalAdmin = actorIsMaster && wantTech;
return [{ json: {
  ...($input.first().json || {}),
  privilegeOk: !code,
  privilegeError: code ? { code, message, statusCode: 403 } : null,
  sanitizedIsMaster: isMaster,
  sanitizedIsTechnicalAdmin: isTechnicalAdmin,
  privilegeAudit: (actorIsMaster && wantTech) ? { action: 'USER_TECHNICAL_ADMIN_GRANTED', previousValue: false, newValue: true } : null,
}}];`;

const PRIV_UPDATE = `const auth = $('Validar auth').first().json || {};
const body = $('Webhook').first().json.body || {};
const actor = auth.user || {};
const actorIsMaster = actor.isMaster === true || actor.is_master === true || auth.isMaster === true;
const target = $input.first().json || {};
const prevMaster = target.is_master === true || target.isMaster === true;
const prevTech = target.is_technical_admin === true || target.isTechnicalAdmin === true;
const bodyHasMaster = Object.prototype.hasOwnProperty.call(body, 'isMaster') || Object.prototype.hasOwnProperty.call(body, 'is_master');
const bodyHasTech = Object.prototype.hasOwnProperty.call(body, 'isTechnicalAdmin') || Object.prototype.hasOwnProperty.call(body, 'is_technical_admin');
const wantMaster = body.isMaster === true || body.isMaster === 'true' || body.is_master === true;
const wantTech = body.isTechnicalAdmin === true || body.isTechnicalAdmin === 'true' || body.is_technical_admin === true || body.is_technical_admin === 'true';
let code = null; let message = null;
if (!actorIsMaster) {
  if (bodyHasMaster && wantMaster !== prevMaster) {
    code = 'PRIVILEGE_ESCALATION_DENIED';
    message = 'Somente usuário master pode alterar o status Master.';
  } else if (bodyHasTech && wantTech !== prevTech) {
    code = 'PRIVILEGE_ESCALATION_DENIED';
    message = 'Somente usuário master pode alterar Administrador Técnico.';
  }
}
const isMaster = actorIsMaster ? (bodyHasMaster ? wantMaster : prevMaster) : prevMaster;
const isTechnicalAdmin = actorIsMaster ? (bodyHasTech ? wantTech : prevTech) : prevTech;
let privilegeAudit = null;
if (actorIsMaster && bodyHasTech && wantTech !== prevTech) {
  privilegeAudit = {
    action: wantTech ? 'USER_TECHNICAL_ADMIN_GRANTED' : 'USER_TECHNICAL_ADMIN_REVOKED',
    previousValue: prevTech,
    newValue: wantTech,
    targetUserId: target.id,
  };
}
return [{ json: {
  ...target,
  privilegeOk: !code,
  privilegeError: code ? { code, message, statusCode: 403 } : null,
  sanitizedIsMaster: isMaster,
  sanitizedIsTechnicalAdmin: isTechnicalAdmin,
  privilegeAudit,
}}];`;

function ensurePrivilegeNodes(wf, sql, mode) {
  const creds = sql.credentials;
  let loadTarget = findNode(wf.nodes, /Carregar alvo/i);
  if (mode === 'update' && !loadTarget) {
    loadTarget = {
      id: randomUUID(),
      name: 'Carregar alvo',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.5,
      position: [sql.position[0] - 420, sql.position[1]],
      parameters: {
        operation: 'executeQuery',
        query: `SELECT id, is_master, is_technical_admin FROM users WHERE id = '{{ $("Webhook").item.json.body.id }}'::uuid LIMIT 1;`,
        options: {},
      },
      credentials: creds,
    };
    wf.nodes.push(loadTarget);
  }

  let sanitize = findNode(wf.nodes, /Sanitizar privil/i);
  if (!sanitize) {
    sanitize = {
      id: randomUUID(),
      name: 'Sanitizar privilégios',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [sql.position[0] - 220, sql.position[1]],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: mode === 'create' ? PRIV_CREATE : PRIV_UPDATE,
      },
    };
    wf.nodes.push(sanitize);
  } else {
    sanitize.parameters.jsCode = mode === 'create' ? PRIV_CREATE : PRIV_UPDATE;
  }

  let gate = findNode(wf.nodes, /Privilégio OK/i);
  if (!gate) {
    gate = {
      id: randomUUID(),
      name: 'Privilégio OK?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [sql.position[0] - 40, sql.position[1]],
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.privilegeOk === true }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        looseTypeValidation: true,
      },
    };
    wf.nodes.push(gate);
  }

  let deny = findNode(wf.nodes, /Negar escalonamento/i);
  if (!deny) {
    deny = {
      id: randomUUID(),
      name: 'Negar escalonamento',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [sql.position[0] + 180, sql.position[1] + 180],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: `const e = $input.first().json.privilegeError || {};
const norm = $('Normalizar request').first().json;
return [{ json: {
  code: e.code || 'FORBIDDEN',
  message: e.message || 'Acesso negado.',
  statusCode: 403,
  requestId: norm.requestId,
  requestStartedAtMs: norm.requestStartedAtMs,
  method: norm.method,
  path: norm.path,
  userId: '',
  sessionId: '',
}}];`,
      },
    };
    wf.nodes.push(deny);
  }

  // Rewire incoming to sql
  const sqlName = sql.name;
  for (const conn of Object.values(wf.connections)) {
    for (const outs of Object.values(conn)) {
      for (const branch of outs) {
        for (const link of branch) {
          if (link.node === sqlName) {
            link.node = mode === 'update' ? 'Carregar alvo' : 'Sanitizar privilégios';
          }
        }
      }
    }
  }
  if (mode === 'update') {
    wf.connections['Carregar alvo'] = { main: [[{ node: 'Sanitizar privilégios', type: 'main', index: 0 }]] };
  }
  wf.connections['Sanitizar privilégios'] = { main: [[{ node: 'Privilégio OK?', type: 'main', index: 0 }]] };
  wf.connections['Privilégio OK?'] = {
    main: [
      [{ node: sqlName, type: 'main', index: 0 }],
      [{ node: 'Negar escalonamento', type: 'main', index: 0 }],
    ],
  };

  const prepErr = wf.nodes.find(
    (n) => n.type.includes('executeWorkflow') && /PREPARAR ERRO|Preparar erro/i.test(n.name),
  );
  if (prepErr) {
    wf.connections['Negar escalonamento'] = {
      main: [[{ node: prepErr.name, type: 'main', index: 0 }]],
    };
  }
}

// POST Usuários
{
  const wf = await loadWf('gCEgRsZzch3l7mfD');
  const sql = wf.nodes.find((n) => n.parameters?.query?.includes('INSERT INTO users'));
  ensurePrivilegeNodes(wf, sql, 'create');
  let q = sql.parameters.query;
  if (!/is_technical_admin/.test(q)) {
    q = q.replace(/active,\n\s*is_master/, 'active,\n    is_master,\n    is_technical_admin');
    q = q.replace(
      /\{\{ \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === true \|\| \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === 'true' \? 'TRUE' : 'FALSE' \}\}/,
      `{{ $('Sanitizar privilégios').first().json.sanitizedIsMaster ? 'TRUE' : 'FALSE' }},\n    {{ $('Sanitizar privilégios').first().json.sanitizedIsTechnicalAdmin ? 'TRUE' : 'FALSE' }}`,
    );
    q = q.replace(
      /RETURNING id, name, email, sector_id, active, is_master, created_at, updated_at/,
      'RETURNING id, name, email, sector_id, active, is_master, is_technical_admin, created_at, updated_at',
    );
    q = q.replace(
      /u\.is_master AS "isMaster",/,
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin",',
    );
    sql.parameters.query = q;
  } else if (!/Sanitizar privilégios/.test(q)) {
    q = q.replace(
      /\{\{ \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === true \|\| \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === 'true' \? 'TRUE' : 'FALSE' \}\}/,
      `{{ $('Sanitizar privilégios').first().json.sanitizedIsMaster ? 'TRUE' : 'FALSE' }}`,
    );
    sql.parameters.query = q;
  }
  const audit = findNode(wf.nodes, /Registrar auditoria/i);
  if (audit?.parameters?.workflowInputs?.value) {
    audit.parameters.workflowInputs.value.afterData =
      "={{ (() => { const d = $json.response?.data || {}; return { name: d.name, email: d.email, sectorId: d.sectorId, active: d.active, isMaster: d.isMaster, isTechnicalAdmin: d.isTechnicalAdmin, permissions: d.permissions }; })() }}";
    audit.parameters.workflowInputs.value.metadata =
      "={{ (() => { const a = $('Sanitizar privilégios').first().json.privilegeAudit; if (!a) return {}; return { technicalAdminAction: a.action, previousValue: a.previousValue, newValue: a.newValue, changedByUserId: $('Validar auth').first().json.userId || null }; })() }}";
  }
  await saveWf(wf, 'POST users technical admin');
}

// PUT Usuários
{
  const wf = await loadWf('z63rJlQKqheFBw4u');
  const sql = wf.nodes.find((n) => n.parameters?.query?.includes('UPDATE users'));
  ensurePrivilegeNodes(wf, sql, 'update');
  let q = sql.parameters.query;
  if (!/Sanitizar privilégios/.test(q)) {
    q = q.replace(
      /is_master = \{\{ \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === true \|\| \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === 'true' \? 'TRUE' : 'FALSE' \}\},/,
      `is_master = {{ $('Sanitizar privilégios').first().json.sanitizedIsMaster ? 'TRUE' : 'FALSE' }},
    is_technical_admin = {{ $('Sanitizar privilégios').first().json.sanitizedIsTechnicalAdmin ? 'TRUE' : 'FALSE' }},`,
    );
    sql.parameters.query = q;
  }
  const savePerms = findNode(wf.nodes, /Salvar permiss/i);
  if (savePerms?.parameters?.query) {
    savePerms.parameters.query = patchIsMasterSelect(savePerms.parameters.query);
  }
  const audit = findNode(wf.nodes, /Registrar auditoria/i);
  if (audit?.parameters?.workflowInputs?.value) {
    audit.parameters.workflowInputs.value.afterData =
      "={{ (() => { const d = $json.response?.data || {}; return { name: d.name, email: d.email, sectorId: d.sectorId, active: d.active, isMaster: d.isMaster, isTechnicalAdmin: d.isTechnicalAdmin, permissions: d.permissions }; })() }}";
    audit.parameters.workflowInputs.value.metadata =
      "={{ (() => { const a = $('Sanitizar privilégios').first().json.privilegeAudit; if (!a) return {}; return { technicalAdminAction: a.action, previousValue: a.previousValue, newValue: a.newValue, targetUserId: a.targetUserId, changedByUserId: $('Validar auth').first().json.userId || null }; })() }}";
    audit.parameters.workflowInputs.value.action =
      "={{ $('Sanitizar privilégios').first().json.privilegeAudit?.action || 'USER_UPDATE' }}";
  }
  await saveWf(wf, 'PUT users technical admin');
}

// Technical endpoints
const EXCLUDE = new Set(['ukDndCZDzemWsOMk', 'DYWXrIK8nGvzzWJ6', '8EXk5RkFW5cxnenL']);
const { rows: techWfs } = await c.query(`
  SELECT id, name FROM workflow_entity
  WHERE active = true
    AND nodes::text ILIKE '%requiredPermission%'
    AND nodes::text ILIKE '%editar_configuracoes%'
`);
let techPatched = 0;
for (const row of techWfs) {
  if (EXCLUDE.has(row.id)) continue;
  const wf = await loadWf(row.id);
  let changed = false;
  for (const n of wf.nodes) {
    if (n.type !== 'n8n-nodes-base.executeWorkflow') continue;
    const val = n.parameters?.workflowInputs?.value;
    if (!val) continue;
    if (String(val.requiredPermission || '') !== 'editar_configuracoes') continue;
    if (val.requiredTechnicalAdmin === true) continue;
    val.requiredTechnicalAdmin = true;
    val.isTechnicalAdmin =
      "={{ $json.isTechnicalAdmin === true || ($json.user && ($json.user.isTechnicalAdmin === true || $json.user.is_technical_admin === true)) }}";
    changed = true;
  }
  if (changed) {
    await saveWf(wf, 'Require technical admin');
    techPatched++;
  }
}
note('techPatched', techPatched);

writeFileSync(new URL('./patch-log-2.json', import.meta.url), JSON.stringify(log, null, 2));
console.log('DONE');
await c.end();
