#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE name ILIKE '%GET Document%' OR name = 'GET Documentos' OR name ILIKE 'Listar documento%' LIMIT 5`);
// find by webhook
const w = await c.query(`SELECT id, name FROM workflow_entity WHERE active AND (name ILIKE '%documento%' OR name ILIKE '%document%') AND name ILIKE 'GET%' ORDER BY name`);
console.log(w.rows);
const list = w.rows.find((r) => /GET Documentos$/i.test(r.name) || /Listar/i.test(r.name));
const id = list?.id || w.rows.find((r) => r.name.includes('Documentos') && !r.name.includes('OCR'))?.id;
console.log('pick', id, list);
if (id) {
  const full = await c.query(`SELECT nodes FROM workflow_entity WHERE id=$1`, [id]);
  const nodes = typeof full.rows[0].nodes === 'string' ? JSON.parse(full.rows[0].nodes) : full.rows[0].nodes;
  const sql = nodes.find((n) => n.parameters?.query?.includes('FROM documents'));
  writeFileSync(new URL('./_list-docs-sql.txt', import.meta.url), sql?.parameters?.query || 'none');
  console.log('has deleted_at filter', /deleted_at/i.test(sql?.parameters?.query || ''));
}
await c.end();
