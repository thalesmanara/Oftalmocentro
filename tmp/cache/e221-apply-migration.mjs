#!/usr/bin/env node
import pg from 'pg';
import { readFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const sql = readFileSync(new URL('./migration-22.1.sql', import.meta.url), 'utf8');
try {
  await client.query(sql);
  console.log('migration 22.1 OK');
} catch (e) {
  console.error('FAIL', e.message);
  // try FUNCTION keyword if PROCEDURE failed
  if (/EXECUTE PROCEDURE|syntax/i.test(e.message)) {
    const alt = sql.replace(/EXECUTE PROCEDURE/g, 'EXECUTE FUNCTION');
    await client.query(alt);
    console.log('migration 22.1 OK with EXECUTE FUNCTION');
  } else throw e;
}
const cols = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ai_semantic_cache_dependencies' ORDER BY 1`,
);
console.log('deps cols', cols.rows.map((r) => r.column_name));
const trig = await client.query(
  `SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_ai_cache%'`,
);
console.log('triggers', trig.rows);
await client.end();
