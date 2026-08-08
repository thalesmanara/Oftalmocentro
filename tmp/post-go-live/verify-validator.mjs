import { readFileSync } from 'fs';
import pg from 'pg';

const local = readFileSync(new URL('./validator-patched.js', import.meta.url), 'utf8');
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT n->'parameters'->>'jsCode' AS code
     FROM workflow_entity w, LATERAL jsonb_array_elements(w.nodes::jsonb) n
    WHERE w.id='NhWUkmzGhlttJC9S' AND n->>'name'='Validar'`,
);
await c.end();
const remote = rows[0].code;

if (remote === local) {
  console.log('IDENTICAL: deployed validator matches locally tested code (%d chars)', local.length);
  process.exit(0);
}
console.log('MISMATCH local=%d remote=%d', local.length, remote.length);
const a = local.split('\n');
const b = remote.split('\n');
for (let i = 0; i < Math.max(a.length, b.length); i++) {
  if (a[i] !== b[i]) console.log(`line ${i + 1}\n  local : ${a[i]}\n  remote: ${b[i]}`);
}
process.exit(1);
