#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Patch UPDATE SQL similarly
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='68acc8f5d57d4fac'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const n = nodes.find((x) => x.name === 'Executar update');
  let q = n.parameters.query;
  q = q.replace(
    `configuration='{{ $('Chamar VALIDAR').first().json.configurationJson }}'::jsonb`,
    `configuration=COALESCE(NULLIF('{{ $('Chamar VALIDAR').first().json.configurationJson || "" }}',''), '{{ $('Preparar update').first().json.configurationJson || "{}" }}')::jsonb`,
  );
  q = q.replace(
    `content_hash='{{ $('Chamar VALIDAR').first().json.contentHash }}'`,
    `content_hash=COALESCE(NULLIF('{{ $('Chamar VALIDAR').first().json.contentHash || "" }}',''), md5(COALESCE(NULLIF('{{ $('Chamar VALIDAR').first().json.configurationJson || "" }}',''), '{{ $('Preparar update').first().json.configurationJson || "{}" }}')))`,
  );
  n.parameters.query = q;
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'UPDATE fallback configurationJson',false,NOW(),NOW())`,
    [versionId, '68acc8f5d57d4fac', nodesJson, connJson, rows[0].name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
    [nodesJson, versionId, '68acc8f5d57d4fac'],
  );
  await client.query('COMMIT');
  console.log('UPDATE version', versionId);
}

await client.end();

// Live create/update/validate test
const login = await (
  await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'compras@oftalmocentrouberaba.com.br',
      password: '12345678',
    }),
  })
).json();
const token = login?.data?.accessToken || login?.data?.token;
const cfg = {
  mode: 'BUDGETED',
  modelName: 'gpt-4.1-mini',
  contextLimitTokens: 16000,
  reservedResponseTokens: 800,
  reservedSystemTokens: 1500,
  safetyMarginTokens: 400,
  maxChunks: 8,
  maxChunksPerDocument: 2,
  minChunkScore: 0.05,
  enableNeighbors: false,
  maxNeighborsPerChunk: 0,
  enableRedundancyRemoval: true,
  redundancyThreshold: 0.9,
  enableConflictPreservation: true,
};

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch {
    j = { raw: text };
  }
  return { status: r.status, j, textLen: text.length };
}

const created = await api('POST', '/webhook/system/ai-context/create', {
  mode: 'BUDGETED',
  versionLabel: `ok-${Date.now()}`,
  configuration: cfg,
  notes: 'create ok 21.1',
});
console.log('CREATE', created.status, created.textLen, JSON.stringify(created.j).slice(0, 500));
const vid = created.j?.data?.version?.id || created.j?.version?.id || created.j?.data?.id;
console.log('vid', vid);

if (vid) {
  const upd = await api('PUT', '/webhook/system/ai-context/update', {
    versionId: vid,
    mode: 'BUDGETED',
    configuration: { ...cfg, maxChunks: 7 },
  });
  console.log('UPDATE', upd.status, JSON.stringify(upd.j).slice(0, 400));
  const val = await api('POST', '/webhook/system/ai-context/validate', {
    versionId: vid,
    mode: 'BUDGETED',
    configuration: { ...cfg, maxChunks: 7 },
  });
  console.log('VALIDATE', val.status, JSON.stringify(val.j).slice(0, 400));
  const pub = await api('POST', '/webhook/system/ai-context/publish', { versionId: vid });
  console.log('PUBLISH no run', pub.status, JSON.stringify(pub.j).slice(0, 400));

  // archive via SQL
  const c2 = new (await import('pg')).default.Client({
    connectionString:
      'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
  });
  await c2.connect();
  await c2.query(`UPDATE ai_context_config_versions SET status='ARCHIVED' WHERE id=$1`, [vid]);
  const pubd = await c2.query(
    `SELECT version_label, status FROM ai_context_config_versions WHERE status='PUBLISHED'`,
  );
  console.log('still published', pubd.rows);
  await c2.end();
}
