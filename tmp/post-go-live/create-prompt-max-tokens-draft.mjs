import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const pub = await c.query(
  `SELECT pv.*
   FROM ai_prompt_versions pv
   JOIN ai_prompt_definitions pd ON pd.id = pv.prompt_definition_id
   WHERE pd.code = 'AI_QUERY_MAIN' AND pv.status = 'PUBLISHED'
   ORDER BY pv.version_number DESC LIMIT 1`,
);
if (!pub.rows.length) {
  console.error('no published prompt');
  process.exit(1);
}
const src = pub.rows[0];
const nextNum = Number(src.version_number) + 1;

// If draft v2 already exists with 800, update it to 1500 or insert v3
const existingDraft = await c.query(
  `SELECT id, version_number, max_tokens FROM ai_prompt_versions
   WHERE prompt_definition_id = $1 AND status = 'DRAFT'
   ORDER BY version_number DESC LIMIT 1`,
  [src.prompt_definition_id],
);

if (existingDraft.rows.length) {
  const d = existingDraft.rows[0];
  await c.query(
    `UPDATE ai_prompt_versions
     SET max_tokens = 1500,
         change_summary = COALESCE(change_summary,'') || ' | Etapa 28.1: candidato max_tokens 1500 para respostas mais completas (DRAFT, sem publish)',
         based_on_version_id = COALESCE(based_on_version_id, $2)
     WHERE id = $1
     RETURNING id, version_number, max_tokens, status`,
    [d.id, src.id],
  );
  const after = await c.query(`SELECT id, version_number, max_tokens, status FROM ai_prompt_versions WHERE id=$1`, [d.id]);
  console.log('updated draft', after.rows[0]);
} else {
  const ins = await c.query(
    `INSERT INTO ai_prompt_versions (
       id, prompt_definition_id, version_number, status, content, content_hash,
       model_name, temperature, top_p, max_tokens, response_format, parameters, metadata,
       change_summary, based_on_version_id, environment, created_at
     ) VALUES (
       gen_random_uuid(), $1, $2, 'DRAFT', $3, $4,
       $5, $6, $7, 1500, $8, $9, $10,
       'Etapa 28.1: candidato max_tokens 1500 para respostas mais completas (DRAFT)',
       $11, $12, NOW()
     ) RETURNING id, version_number, max_tokens, status`,
    [
      src.prompt_definition_id,
      nextNum,
      src.content,
      src.content_hash,
      src.model_name,
      src.temperature,
      src.top_p,
      src.response_format,
      src.parameters,
      src.metadata,
      src.id,
      src.environment,
    ],
  );
  console.log('inserted draft', ins.rows[0]);
}

const check = await c.query(
  `SELECT version_number, status, max_tokens FROM ai_prompt_versions
   WHERE prompt_definition_id=$1 ORDER BY version_number`,
  [src.prompt_definition_id],
);
console.log(check.rows);
await c.end();
