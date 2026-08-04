#!/usr/bin/env node
import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT id, name, active FROM workflow_entity
   WHERE name ILIKE '%documento%'
      OR name ILIKE '%document%'
      OR name ILIKE '%versão%'
      OR name ILIKE '%versao%'
      OR name ILIKE '%OCR%'
      OR name ILIKE '%tabular%'
      OR name ILIKE '%planilha%'
      OR name ILIKE '%embedding%'
      OR name ILIKE '%PROMPT%PUBLISH%'
      OR name ILIKE '%AI PROMPT%'
      OR name ILIKE '%RETRIEVAL%PUBLISH%'
      OR name ILIKE '%CONTEXT%PUBLISH%'
      OR name ILIKE '%CONTEXT%ROLLBACK%'
   ORDER BY name`,
);
for (const r of rows) console.log(r.active ? 'A' : '-', r.id, r.name);
await client.end();
