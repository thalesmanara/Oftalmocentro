#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const { rows } = await c.query(`
  SELECT id, name
  FROM workflow_entity
  WHERE active = true
    AND nodes::text ILIKE '%editar_configuracoes%'
  ORDER BY name`);
writeFileSync(new URL('./_wf-editar-config.json', import.meta.url), JSON.stringify(rows, null, 2));
console.log('count', rows.length);
rows.forEach((r) => console.log(r.id, r.name));

// Settings / health / backup / ai / qdrant names
const techish = await c.query(`
  SELECT id, name FROM workflow_entity
  WHERE active AND (
    name ILIKE '%health%' OR name ILIKE '%backup%' OR name ILIKE '%qdrant%'
    OR name ILIKE '%prompt%' OR name ILIKE '%retrieval%' OR name ILIKE '%context%'
    OR name ILIKE '%cache%' OR name ILIKE '%evidence%' OR name ILIKE '%response quality%'
    OR name ILIKE '%validacao%' OR name ILIKE '%validação%' OR name ILIKE '%ai eval%'
    OR name ILIKE '%ai-%' OR name ILIKE 'IA -%' OR name ILIKE '%system%ai%'
  )
  ORDER BY name`);
console.log('\ntechish', techish.rows.length);
techish.rows.forEach((r) => console.log(r.id, r.name));

await c.end();
