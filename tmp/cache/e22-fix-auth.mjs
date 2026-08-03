#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const r = await fetch(`${BASE}/webhook/system/ai-cache`);
console.log('noauth', r.status, (await r.text()).slice(0, 400));

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Inspect context list Auth ok? for reference
const ctx = await client.query(`SELECT nodes FROM workflow_entity WHERE id='7995896871ed4947'`);
const cnodes = typeof ctx.rows[0].nodes === 'string' ? JSON.parse(ctx.rows[0].nodes) : ctx.rows[0].nodes;
const authIf = cnodes.find((n) => /auth ok/i.test(n.name));
console.log('context Auth ok?', JSON.stringify(authIf?.parameters?.conditions, null, 2)?.slice(0, 800));

async function bump(id) {
  const { rows } = await client.query(`SELECT name, nodes, connections FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const a = nodes.find((n) => n.name === 'Auth ok?');
  const p = nodes.find((n) => n.name === 'Permissão ok?');
  if (a) {
    a.parameters.conditions = {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: randomUUID(),
          leftValue: '={{ $json.ok === true || $json.authenticated === true }}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'equals' },
        },
      ],
      combinator: 'and',
    };
  }
  if (p) {
    p.parameters.conditions = {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
      conditions: [
        {
          id: randomUUID(),
          leftValue: '={{ $json.ok === true || $json.allowed === true }}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'equals' },
        },
      ],
      combinator: 'and',
    };
  }
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa22',$3::json,$4::json,$5,'fix auth gate',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await client.query('COMMIT');
  console.log('fixed', rows[0].name);
}

const ids = [
  'c22CacheList0000001',
  'c22CacheDetail00001',
  'c22CacheCreate00001',
  'c22CacheValidate001',
  'c22CachePublish0001',
  'c22CacheRollback001',
  'c22CacheInvalidate01',
  'c22CacheCleanup0001',
  'c22CacheCompare0001',
  'c22CacheUpdate00001',
];
for (const id of ids) await bump(id);
await client.end();
