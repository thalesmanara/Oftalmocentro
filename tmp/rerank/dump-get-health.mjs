#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
for (const n of nodes) {
  if (n.parameters?.jsCode) {
    writeFileSync(new URL(`./_gethealth-${n.name.replace(/\s+/g,'_')}.js`, import.meta.url), n.parameters.jsCode);
  }
}
console.log(nodes.map((n) => n.name));
await client.end();
