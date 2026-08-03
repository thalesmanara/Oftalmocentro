#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT connections, nodes FROM workflow_entity WHERE id='12t0Ol6zWQJgAKPC'`);
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
writeFileSync(new URL('./_c212-dataset-connections.json', import.meta.url), JSON.stringify(connections, null, 2));
console.log(JSON.stringify(connections, null, 2).slice(0, 4000));
await client.end();
