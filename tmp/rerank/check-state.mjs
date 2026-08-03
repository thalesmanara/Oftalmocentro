import pg from 'pg';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const versions = await client.query(
  `SELECT version_number, version_label, status, mode, left(configuration::text,200) AS cfg
   FROM ai_retrieval_config_versions ORDER BY version_number`,
);
console.log('versions', versions.rows);
const secrets = await client.query(
  `SELECT key, value FROM app_secrets WHERE key LIKE 'retrieval%' ORDER BY key`,
);
console.log('secrets', secrets.rows);
const runs = await client.query(
  `SELECT id, status, overall_score, retrieval_mode, retrieval_config_version, started_at
   FROM ai_test_runs ORDER BY started_at DESC LIMIT 5`,
);
console.log('runs', runs.rows);
const nodes = await client.query(
  `SELECT name,
     (SELECT count(*) FROM jsonb_array_elements(nodes) n WHERE n->>'name' IN
       ('Carregar retrieval config','Chamar RE-RANQUEAR','Resolver ranking final','Merge híbrido')) AS hits
   FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
console.log('consulta hits', nodes.rows);
await client.end();
