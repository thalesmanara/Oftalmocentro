#!/usr/bin/env node
/**
 * Etapa 28.1 — Administrador Técnico
 * Patch auth/users + VALIDAR PERMISSÃO + endpoints técnicos.
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
function note(msg, extra) {
  log.push({ msg, extra });
  console.log(msg, extra ?? '');
}

async function loadWf(id) {
  const { rows } = await c.query(
    `SELECT id, name, nodes, connections, active FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) throw new Error('missing ' + id);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes);
  const connections =
    typeof rows[0].connections === 'string'
      ? JSON.parse(rows[0].connections)
      : structuredClone(rows[0].connections);
  return { ...rows[0], nodes, connections };
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
  // bounce active
  await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [wf.id]);
  await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [wf.id]);
  await c.query('COMMIT');
  note('saved', { id: wf.id, name: wf.name, versionId });
  return versionId;
}

function findNode(nodes, nameRe) {
  return nodes.find((n) => nameRe.test(n.name));
}

function replaceAll(str, pairs) {
  let s = str;
  for (const [a, b] of pairs) s = s.split(a).join(b);
  return s;
}

// ---------- 1) VALIDAR PERMISSÃO ----------
{
  const wf = await loadWf('yXW3rW8EbHXuprRJ');
  const trigger = findNode(wf.nodes, /^Trigger$/);
  const checar = findNode(wf.nodes, /Checar permiss/i);
  if (!trigger || !checar) throw new Error('validatePerm structure');

  const values = trigger.parameters.workflowInputs.values || [];
  if (!values.some((v) => v.name === 'requiredTechnicalAdmin')) {
    values.push({ name: 'requiredTechnicalAdmin', type: 'boolean' });
  }
  if (!values.some((v) => v.name === 'isTechnicalAdmin')) {
    values.push({ name: 'isTechnicalAdmin', type: 'boolean' });
  }
  trigger.parameters.workflowInputs.values = values;

  checar.parameters.jsCode = `const item = $input.first().json;
const required = String(item.requiredPermission || '').trim();
const anyOf = Array.isArray(item.requiredAnyOf) ? item.requiredAnyOf.map(String).filter(Boolean) : [];
const requiredTechnicalAdmin = item.requiredTechnicalAdmin === true || item.requiredTechnicalAdmin === 'true';
const isMaster = item.isMaster === true || (item.user && (item.user.isMaster === true || item.user.is_master === true));
const isTechnicalAdmin =
  item.isTechnicalAdmin === true ||
  item.isTechnicalAdmin === 'true' ||
  (item.user && (item.user.isTechnicalAdmin === true || item.user.is_technical_admin === true));
const permissions = Array.isArray(item.permissions)
  ? item.permissions.map(String)
  : (item.user && Array.isArray(item.user.permissions) ? item.user.permissions.map(String) : []);

let allowed = false;
let denyCode = 'FORBIDDEN';
let denyMessage = 'Você não possui permissão para executar esta ação.';

if (requiredTechnicalAdmin) {
  const techOk = isMaster || isTechnicalAdmin;
  if (!techOk) {
    allowed = false;
    denyCode = 'TECHNICAL_ADMIN_REQUIRED';
    denyMessage = 'Acesso restrito a Administrador Técnico ou Master.';
  } else if (isMaster) {
    allowed = true;
  } else {
    // Administrador técnico: sem bypass geral — exige permissão funcional se informada
    if (required === '*' || (!required && anyOf.length === 0)) allowed = true;
    else if (required && permissions.includes(required)) allowed = true;
    else if (anyOf.length > 0 && anyOf.some((p) => permissions.includes(p))) allowed = true;
    else allowed = false;
  }
} else if (isMaster) {
  allowed = true;
} else if (required === '*') {
  allowed = true;
} else if (required && permissions.includes(required)) {
  allowed = true;
} else if (anyOf.length > 0 && anyOf.some((p) => permissions.includes(p))) {
  allowed = true;
}

return [{
  json: {
    ok: allowed,
    success: allowed,
    allowed,
    statusCode: allowed ? 200 : 403,
    requiredPermission: required || null,
    requiredAnyOf: anyOf,
    requiredTechnicalAdmin,
    isMaster,
    isTechnicalAdmin,
    message: allowed ? 'Permissão concedida.' : denyMessage,
    error: allowed ? null : { code: denyCode, message: denyMessage },
    auditAction: allowed ? null : 'TECHNICAL_ADMIN_ACCESS_DENIED',
    userId: item.userId || (item.user && item.user.id) || null,
    sessionId: item.sessionId || null,
    permissions,
    user: item.user || null,
    requestId: String(item.requestId || ''),
  },
}];`;

  await saveWf(wf, 'Add requiredTechnicalAdmin gate (master OR technical admin)');
}

// ---------- helpers for auth SQL / user object ----------
function patchUserSelectSql(sql) {
  let s = sql;
  // add column after is_master AS "isMaster" patterns
  if (!/is_technical_admin/i.test(s)) {
    s = s.replace(
      /u\.is_master\s+AS\s+"isMaster"/gi,
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin"',
    );
    s = s.replace(
      /u\.is_master(?!\s+AS)/g,
      (m, offset, whole) => {
        // only in SELECT lists that already have is_master without alias — careful
        return m;
      },
    );
    // login query uses m.is_master without alias in final SELECT
    if (/m\.is_master/.test(s) && !/m\.is_technical_admin/.test(s)) {
      s = s.replace(/m\.is_master,/g, 'm.is_master,\n  m.is_technical_admin,');
      s = s.replace(
        /u\.is_master,\n\s*u\.password_hash/g,
        'u.is_master,\n    u.is_technical_admin,\n    u.password_hash',
      );
    }
    // GROUP BY lists
    if (/GROUP BY[\s\S]*u\.is_master/.test(s) && !/u\.is_technical_admin/.test(s)) {
      s = s.replace(/u\.is_master,/g, 'u.is_master,\n    u.is_technical_admin,');
    }
  }
  return s;
}

function patchUserObjectExpr(expr) {
  if (/isTechnicalAdmin/.test(expr)) return expr;
  return expr.replace(
    /isMaster:\s*\$json\.isMaster/,
    'isMaster: $json.isMaster, isTechnicalAdmin: $json.isTechnicalAdmin === true',
  ).replace(
    /isMaster:\s*user\.is_master/,
    'isMaster: user.is_master === true, isTechnicalAdmin: user.is_technical_admin === true',
  );
}

// ---------- 2) AUTH - CARREGAR USUÁRIO ----------
{
  const wf = await loadWf('FJRbZWYX2pokOa0m');
  const load = findNode(wf.nodes, /Carregar usu/i);
  const ok = findNode(wf.nodes, /Usuário OK|Usuario OK/i);
  load.parameters.query = patchUserSelectSql(load.parameters.query);
  if (!/is_technical_admin/.test(load.parameters.query)) {
    load.parameters.query = load.parameters.query.replace(
      'u.is_master AS "isMaster",',
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin",',
    );
  }
  const assigns = ok.parameters.values.assignments;
  const userAssign = assigns.find((a) => a.name === 'user');
  if (userAssign && !/isTechnicalAdmin/.test(String(userAssign.value))) {
    userAssign.value =
      "={{ ({ id: $json.userId, name: $json.name, email: $json.email, sectorId: $json.sectorId, sectorName: $json.sectorName, active: $json.active, isMaster: $json.isMaster === true, isTechnicalAdmin: $json.isTechnicalAdmin === true, permissions: Array.isArray($json.permissions) ? $json.permissions : [] }) }}";
  }
  if (!assigns.some((a) => a.name === 'isTechnicalAdmin')) {
    assigns.push({
      id: randomUUID(),
      name: 'isTechnicalAdmin',
      value: '={{ $json.isTechnicalAdmin === true }}',
      type: 'boolean',
    });
  }
  if (!assigns.some((a) => a.name === 'isMaster')) {
    assigns.push({
      id: randomUUID(),
      name: 'isMaster',
      value: '={{ $json.isMaster === true }}',
      type: 'boolean',
    });
  }
  await saveWf(wf, 'Return isTechnicalAdmin on load user');
}

// ---------- 3) AUTH - VALIDAR TOKEN ----------
{
  const wf = await loadWf('P5E43ZXSJiI9wFYD');
  const sess = findNode(wf.nodes, /Validar sess/i);
  const ok = findNode(wf.nodes, /Auth OK/i);
  sess.parameters.query = patchUserSelectSql(sess.parameters.query);
  if (!/is_technical_admin/.test(sess.parameters.query)) {
    sess.parameters.query = sess.parameters.query.replace(
      'u.is_master AS "isMaster",',
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin",',
    );
  }
  const assigns = ok.parameters.values.assignments;
  const userAssign = assigns.find((a) => a.name === 'user');
  if (userAssign) {
    userAssign.value =
      "={{ ({ id: $json.userId, name: $json.name, email: $json.email, sectorId: $json.sectorId, sectorName: $json.sectorName, active: $json.active, isMaster: $json.isMaster === true, isTechnicalAdmin: $json.isTechnicalAdmin === true, permissions: Array.isArray($json.permissions) ? $json.permissions : [] }) }}";
  }
  if (!assigns.some((a) => a.name === 'isTechnicalAdmin')) {
    assigns.push({
      id: randomUUID(),
      name: 'isTechnicalAdmin',
      value: '={{ $json.isTechnicalAdmin === true }}',
      type: 'boolean',
    });
  }
  if (!assigns.some((a) => a.name === 'isMaster')) {
    assigns.push({
      id: randomUUID(),
      name: 'isMaster',
      value: '={{ $json.isMaster === true }}',
      type: 'boolean',
    });
  }
  await saveWf(wf, 'Return isTechnicalAdmin on validate token');
}

// ---------- 4) AUTH - LOGIN ----------
{
  const wf = await loadWf('Oyt4aCpmjStLdYvO');
  const buscar = findNode(wf.nodes, /Buscar usu/i);
  const assinar = findNode(wf.nodes, /Assinar JWT/i);
  let q = buscar.parameters.query;
  if (!/is_technical_admin/.test(q)) {
    q = q.replace(
      /u\.is_master,\n\s*u\.password_hash/,
      "u.is_master,\n    u.is_technical_admin,\n    u.password_hash",
    );
    q = q.replace(
      /m\.is_master,\n\s*m\.permissions/,
      "m.is_master,\n  m.is_technical_admin,\n  m.permissions",
    );
    // also in matched CTE select list
    if (!/u\.is_technical_admin/.test(q)) {
      q = q.replace(/u\.is_master,\n(\s*)u\.password_hash/, 'u.is_master,\n$1u.is_technical_admin,\n$1u.password_hash');
    }
    buscar.parameters.query = q;
  }
  let code = assinar.parameters.jsCode;
  if (!/isTechnicalAdmin/.test(code)) {
    code = code.replace(
      /isMaster:\s*user\.is_master,/,
      'isMaster: user.is_master === true,\n      isTechnicalAdmin: user.is_technical_admin === true,',
    );
    assinar.parameters.jsCode = code;
  }
  await saveWf(wf, 'Login returns isTechnicalAdmin');
}

// ---------- 5) GET Usuários ----------
{
  const wf = await loadWf('pkQiNqpkrRgSM4Wa');
  const sql = findNode(wf.nodes, /Execute a SQL|Listar|SELECT/i) || wf.nodes.find((n) => n.parameters?.query?.includes('FROM users'));
  let q = sql.parameters.query;
  if (!/is_technical_admin/.test(q)) {
    q = q.replace(
      /u\.is_master AS "isMaster",/,
      'u.is_master AS "isMaster",\n    u.is_technical_admin AS "isTechnicalAdmin",',
    );
    q = q.replace(/u\.is_master,\n(\s*)u\.created_at/, 'u.is_master,\n$1u.is_technical_admin,\n$1u.created_at');
    sql.parameters.query = q;
  }
  await saveWf(wf, 'GET users includes isTechnicalAdmin');
}

const PRIV_SANITIZE_CREATE = `const auth = $('Validar auth').first().json || {};
const body = $('Webhook').first().json.body || {};
const actor = auth.user || {};
const actorIsMaster = actor.isMaster === true || actor.is_master === true || auth.isMaster === true;
const wantMaster = body.isMaster === true || body.isMaster === 'true' || body.is_master === true;
const wantTech =
  body.isTechnicalAdmin === true ||
  body.isTechnicalAdmin === 'true' ||
  body.is_technical_admin === true ||
  body.is_technical_admin === 'true';

let code = null;
let message = null;
if (!actorIsMaster && (wantMaster || wantTech)) {
  code = 'PRIVILEGE_ESCALATION_DENIED';
  message = 'Somente usuário master pode definir Master ou Administrador Técnico.';
}

const isMaster = actorIsMaster && wantMaster;
const isTechnicalAdmin = actorIsMaster && wantTech;

return [{
  json: {
    ...($input.first().json || {}),
    privilegeOk: !code,
    privilegeError: code ? { code, message, statusCode: 403 } : null,
    sanitizedIsMaster: isMaster,
    sanitizedIsTechnicalAdmin: isTechnicalAdmin,
    privilegeAudit: wantTech
      ? { action: 'USER_TECHNICAL_ADMIN_GRANTED', newValue: isTechnicalAdmin, previousValue: false }
      : null,
    requestId: auth.requestId || $('Normalizar request').first().json.requestId || '',
  },
}];`;

const PRIV_SANITIZE_UPDATE = `const auth = $('Validar auth').first().json || {};
const body = $('Webhook').first().json.body || {};
const actor = auth.user || {};
const actorIsMaster = actor.isMaster === true || actor.is_master === true || auth.isMaster === true;
const target = $input.first().json || {};
const prevMaster = target.is_master === true || target.isMaster === true;
const prevTech = target.is_technical_admin === true || target.isTechnicalAdmin === true;

const bodyHasMaster = Object.prototype.hasOwnProperty.call(body, 'isMaster') || Object.prototype.hasOwnProperty.call(body, 'is_master');
const bodyHasTech =
  Object.prototype.hasOwnProperty.call(body, 'isTechnicalAdmin') ||
  Object.prototype.hasOwnProperty.call(body, 'is_technical_admin');

const wantMaster = body.isMaster === true || body.isMaster === 'true' || body.is_master === true;
const wantTech =
  body.isTechnicalAdmin === true ||
  body.isTechnicalAdmin === 'true' ||
  body.is_technical_admin === true ||
  body.is_technical_admin === 'true';

let code = null;
let message = null;

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

return [{
  json: {
    ...target,
    privilegeOk: !code,
    privilegeError: code ? { code, message, statusCode: 403 } : null,
    sanitizedIsMaster: isMaster,
    sanitizedIsTechnicalAdmin: isTechnicalAdmin,
    privilegeAudit,
    requestId: auth.requestId || $('Normalizar request').first().json.requestId || '',
  },
}];`;

// ---------- 6) POST Usuários ----------
{
  const wf = await loadWf('gCEgRsZzch3l7mfD');
  const sql = wf.nodes.find((n) => n.parameters?.query?.includes('INSERT INTO users'));
  if (!sql) throw new Error('POST insert missing');

  // Insert sanitize node before SQL if missing
  let sanitize = findNode(wf.nodes, /Sanitizar privil/i);
  if (!sanitize) {
    sanitize = {
      id: randomUUID(),
      name: 'Sanitizar privilégios',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [sql.position[0] - 220, sql.position[1]],
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: PRIV_SANITIZE_CREATE },
    };
    wf.nodes.push(sanitize);
  } else {
    sanitize.parameters.jsCode = PRIV_SANITIZE_CREATE;
  }

  // Wire: find who connected to SQL and reroute via sanitize
  // Also add IF privilegeOk
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
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.privilegeOk }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
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
      position: [sql.position[0] + 200, sql.position[1] + 160],
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
  auditAction: 'TECHNICAL_ADMIN_ACCESS_DENIED',
}}];`,
      },
    };
    wf.nodes.push(deny);
  }

  // Update SQL to use sanitized flags and include column
  let q = sql.parameters.query;
  if (!/is_technical_admin/.test(q)) {
    q = q.replace(
      /active,\n\s*is_master/,
      'active,\n    is_master,\n    is_technical_admin',
    );
    q = q.replace(
      /\{\{ \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === true \|\| \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === 'true' \? 'TRUE' : 'FALSE' \}\}/,
      `{{ $('Sanitizar privilégios').first().json.sanitizedIsMaster ? 'TRUE' : 'FALSE' }},\n    {{ $('Sanitizar privilégios').first().json.sanitizedIsTechnicalAdmin ? 'TRUE' : 'FALSE' }}`,
    );
    q = q.replace(
      /u\.is_master AS "isMaster",/,
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin",',
    );
    q = q.replace(
      /RETURNING id, name, email, sector_id, active, is_master, created_at, updated_at/,
      'RETURNING id, name, email, sector_id, active, is_master, is_technical_admin, created_at, updated_at',
    );
    sql.parameters.query = q;
  }

  // Rewire connections: find node that pointed to SQL
  const sqlName = sql.name;
  for (const [from, conn] of Object.entries(wf.connections)) {
    for (const outs of Object.values(conn)) {
      for (const branch of outs) {
        for (const link of branch) {
          if (link.node === sqlName) {
            link.node = 'Sanitizar privilégios';
          }
        }
      }
    }
  }
  wf.connections['Sanitizar privilégios'] = {
    main: [[{ node: 'Privilégio OK?', type: 'main', index: 0 }]],
  };
  wf.connections['Privilégio OK?'] = {
    main: [
      [{ node: sqlName, type: 'main', index: 0 }],
      [{ node: 'Negar escalonamento', type: 'main', index: 0 }],
    ],
  };

  // Connect deny to existing error path if possible - find Preparar erro / SYSTEM - PREPARAR ERRO
  const prepErr = wf.nodes.find((n) => /preparar erro|erro/i.test(n.name) && n.type.includes('executeWorkflow'));
  const montarErr = wf.nodes.find((n) => /montar.*erro|erro http/i.test(n.name));
  if (prepErr) {
    wf.connections['Negar escalonamento'] = {
      main: [[{ node: prepErr.name, type: 'main', index: 0 }]],
    };
  } else if (montarErr) {
    wf.connections['Negar escalonamento'] = {
      main: [[{ node: montarErr.name, type: 'main', index: 0 }]],
    };
  }

  // Audit afterData include isTechnicalAdmin
  const audit = findNode(wf.nodes, /Registrar auditoria/i);
  if (audit?.parameters?.workflowInputs?.value?.afterData) {
    audit.parameters.workflowInputs.value.afterData =
      "={{ (() => { const d = $json.response?.data || {}; return { name: d.name, email: d.email, sectorId: d.sectorId, active: d.active, isMaster: d.isMaster, isTechnicalAdmin: d.isTechnicalAdmin, permissions: d.permissions }; })() }}";
    audit.parameters.workflowInputs.value.metadata =
      "={{ (() => { const a = $('Sanitizar privilégios').first().json.privilegeAudit; if (!a) return {}; return { technicalAdminAction: a.action, previousValue: a.previousValue, newValue: a.newValue, changedByUserId: $('Validar auth').first().json.userId || null }; })() }}";
  }

  await saveWf(wf, 'POST users: isTechnicalAdmin + privilege sanitization');
}

// ---------- 7) PUT Usuários ----------
{
  const wf = await loadWf('z63rJlQKqheFBw4u');
  const sql = wf.nodes.find((n) => n.parameters?.query?.includes('UPDATE users'));
  if (!sql) throw new Error('PUT update missing');

  // Load target before sanitize
  let loadTarget = findNode(wf.nodes, /Carregar alvo/i);
  if (!loadTarget) {
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
      credentials: sql.credentials,
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
      parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: PRIV_SANITIZE_UPDATE },
    };
    wf.nodes.push(sanitize);
  } else {
    sanitize.parameters.jsCode = PRIV_SANITIZE_UPDATE;
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
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
          conditions: [
            {
              id: randomUUID(),
              leftValue: '={{ $json.privilegeOk }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
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
      position: [sql.position[0] + 200, sql.position[1] + 160],
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
  auditAction: 'TECHNICAL_ADMIN_ACCESS_DENIED',
}}];`,
      },
    };
    wf.nodes.push(deny);
  }

  let q = sql.parameters.query;
  if (!/is_technical_admin/.test(q) || !/Sanitizar privilégios/.test(q)) {
    q = q.replace(
      /is_master = \{\{ \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === true \|\| \$\(\"Webhook\"\)\.item\.json\.body\.isMaster === 'true' \? 'TRUE' : 'FALSE' \}\},/,
      `is_master = {{ $('Sanitizar privilégios').first().json.sanitizedIsMaster ? 'TRUE' : 'FALSE' }},
    is_technical_admin = {{ $('Sanitizar privilégios').first().json.sanitizedIsTechnicalAdmin ? 'TRUE' : 'FALSE' }},`,
    );
    sql.parameters.query = q;
  }

  // Salvar permissões SELECT needs isTechnicalAdmin
  const savePerms = findNode(wf.nodes, /Salvar permiss/i);
  if (savePerms?.parameters?.query && !/isTechnicalAdmin/.test(savePerms.parameters.query)) {
    savePerms.parameters.query = savePerms.parameters.query.replace(
      /u\.is_master AS "isMaster",/,
      'u.is_master AS "isMaster",\n  u.is_technical_admin AS "isTechnicalAdmin",',
    );
  }

  const sqlName = sql.name;
  for (const [from, conn] of Object.entries(wf.connections)) {
    for (const outs of Object.values(conn)) {
      for (const branch of outs) {
        for (const link of branch) {
          if (link.node === sqlName) {
            link.node = 'Carregar alvo';
          }
        }
      }
    }
  }
  wf.connections['Carregar alvo'] = {
    main: [[{ node: 'Sanitizar privilégios', type: 'main', index: 0 }]],
  };
  wf.connections['Sanitizar privilégios'] = {
    main: [[{ node: 'Privilégio OK?', type: 'main', index: 0 }]],
  };
  wf.connections['Privilégio OK?'] = {
    main: [
      [{ node: sqlName, type: 'main', index: 0 }],
      [{ node: 'Negar escalonamento', type: 'main', index: 0 }],
    ],
  };
  const prepErr = wf.nodes.find((n) => /preparar erro/i.test(n.name) && n.type.includes('executeWorkflow'));
  if (prepErr) {
    wf.connections['Negar escalonamento'] = {
      main: [[{ node: prepErr.name, type: 'main', index: 0 }]],
    };
  }

  const audit = findNode(wf.nodes, /Registrar auditoria/i);
  if (audit?.parameters?.workflowInputs?.value) {
    audit.parameters.workflowInputs.value.afterData =
      "={{ (() => { const d = $json.response?.data || {}; return { name: d.name, email: d.email, sectorId: d.sectorId, active: d.active, isMaster: d.isMaster, isTechnicalAdmin: d.isTechnicalAdmin, permissions: d.permissions }; })() }}";
    audit.parameters.workflowInputs.value.metadata =
      "={{ (() => { const a = $('Sanitizar privilégios').first().json.privilegeAudit; if (!a) return {}; return { technicalAdminAction: a.action, previousValue: a.previousValue, newValue: a.newValue, targetUserId: a.targetUserId, changedByUserId: $('Validar auth').first().json.userId || null }; })() }}";
    const actionExpr = audit.parameters.workflowInputs.value.action;
    if (typeof actionExpr === 'string' && actionExpr.includes('USER_UPDATE')) {
      audit.parameters.workflowInputs.value.action =
        "={{ $('Sanitizar privilégios').first().json.privilegeAudit?.action || 'USER_UPDATE' }}";
    }
  }

  await saveWf(wf, 'PUT users: isTechnicalAdmin + privilege sanitization');
}

// ---------- 8) Technical endpoints: add requiredTechnicalAdmin ----------
const EXCLUDE = new Set([
  'ukDndCZDzemWsOMk', // PUT Configurações
  'DYWXrIK8nGvzzWJ6', // GET Configurações
  '8EXk5RkFW5cxnenL', // Consulta IA
]);

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
    const req = String(val.requiredPermission || '');
    if (req !== 'editar_configuracoes') continue;
    if (val.requiredTechnicalAdmin === true || val.requiredTechnicalAdmin === '={{ true }}') continue;
    val.requiredTechnicalAdmin = true;
    // pass isTechnicalAdmin from auth context when available
    if (!val.isTechnicalAdmin) {
      val.isTechnicalAdmin =
        "={{ $json.isTechnicalAdmin === true || ($json.user && ($json.user.isTechnicalAdmin === true || $json.user.is_technical_admin === true)) }}";
    }
    changed = true;
  }
  if (changed) {
    await saveWf(wf, 'Require technical admin for editar_configuracoes technical endpoint');
    techPatched++;
  }
}
note('tech endpoints patched', techPatched);

// Backup DB export: ensure users query includes column if hardcoded
const { rows: backupWfs } = await c.query(`
  SELECT id, name FROM workflow_entity
  WHERE id IN ('A16PhhWFr0Za9X3B','ZsgGgMEPSQadSjv8') OR name ILIKE 'BACKUP - BANCO%'
`);
for (const row of backupWfs) {
  const wf = await loadWf(row.id);
  let changed = false;
  for (const n of wf.nodes) {
    const q = n.parameters?.query;
    if (typeof q === 'string' && /FROM users/i.test(q) && /is_master/i.test(q) && !/is_technical_admin/i.test(q)) {
      n.parameters.query = q.replace(/is_master/g, 'is_master, is_technical_admin');
      // may duplicate - fix naive double
      n.parameters.query = n.parameters.query.replace(
        /is_master, is_technical_admin, is_technical_admin/g,
        'is_master, is_technical_admin',
      );
      changed = true;
    }
  }
  if (changed) await saveWf(wf, 'Backup includes is_technical_admin');
}

writeFileSync(new URL('./patch-log.json', import.meta.url), JSON.stringify(log, null, 2));
console.log('DONE', log.length);
await c.end();
