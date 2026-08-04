import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
  ssl: false,
});
await c.connect();

const r = await c.query(`
  SELECT id, name, active,
    (
      SELECT string_agg(DISTINCT n->>'name', ', ')
      FROM jsonb_array_elements(nodes) n
      WHERE n->>'type' ILIKE '%webhook%'
         OR n->>'name' ILIKE '%webhook%'
    ) AS webhook_nodes
  FROM workflow_entity
  WHERE name ILIKE '%document%'
     OR nodes::text ILIKE '%"path":"documents"%'
     OR nodes::text ILIKE '%path": "documents"%'
  ORDER BY name
`);

for (const row of r.rows) {
  console.log(`${row.active ? 'ON ' : 'off'} ${row.id} | ${row.name}`);
}

// Find exact GET documents webhook path
const r2 = await c.query(`
  SELECT id, name, active,
    jsonb_path_query_array(nodes, '$[*] ? (@.type like_regex "webhook" flag "i").parameters.path') AS paths
  FROM workflow_entity
  WHERE nodes::text ILIKE '%documents%'
  ORDER BY updatedAt DESC
  LIMIT 80
`);
console.log('\n--- paths ---');
for (const row of r2.rows) {
  const paths = row.paths;
  if (JSON.stringify(paths).includes('"documents"') || JSON.stringify(paths).includes('documents')) {
    console.log(`${row.active ? 'ON ' : 'off'} ${row.id} | ${row.name} | paths=${JSON.stringify(paths)}`);
  }
}

await c.end();
