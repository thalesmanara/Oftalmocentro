import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows: v } = await c.query(
  `SELECT version_number, status, left(content_hash,12) AS h FROM ai_prompt_versions ORDER BY version_number`,
);
console.log('versions', v);
const { rows: n } = await c.query(
  `SELECT (nodes::text LIKE '%Você é a IA interna%') AS hardcoded FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
console.log('consulta hardcoded', n[0]);
const { rows: h } = await c.query(
  `SELECT (nodes::text LIKE '%aiPrompts%') AS has FROM workflow_entity WHERE id IN ('qAyYc9DrHIqe4L9i','2UPHcxASp2PboC9M')`,
);
console.log('health aiPrompts', h);
const { rows: b } = await c.query(
  `SELECT (nodes::text LIKE '%ai_prompt_definitions%') AS has FROM workflow_entity WHERE id='A16PhhWFr0Za9X3B'`,
);
console.log('backup prompts', b[0]);
await c.end();
