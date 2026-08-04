#!/usr/bin/env node
import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
// toggle active to force reload
await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id='c22CacheRuntime0001'`);
await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id='c22CacheRuntime0001'`);
await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id='c221InvalidateEvent01'`);
await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id='c221InvalidateEvent01'`);
// also consulta
await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id='8EXk5RkFW5cxnenL'`);
await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id='8EXk5RkFW5cxnenL'`);
console.log('toggled active');
const v = await c.query(`SELECT id, "versionId", "activeVersionId", active FROM workflow_entity WHERE id IN ('c22CacheRuntime0001','c221InvalidateEvent01')`);
console.log(v.rows);
await c.end();
