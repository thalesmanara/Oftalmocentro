import pg from 'pg';
import crypto from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const pub = (
  await c.query(
    `SELECT v.* FROM ai_prompt_versions v
     JOIN ai_prompt_definitions d ON d.id=v.prompt_definition_id
     WHERE d.code='AI_QUERY_MAIN' AND v.status='PUBLISHED' LIMIT 1`,
  )
).rows[0];

const completenessBlock = `

======================================================================
COMPLETUDE E FORMATO DA RESPOSTA
======================================================================

Adapte a extensão da resposta à pergunta:
- pergunta pontual (CPF, CNPJ, CRM, código, data, valor, sim/não): responda de forma objetiva e direta;
- pergunta ampla ou explicativa: responda de forma suficientemente detalhada, cobrindo os principais pontos presentes no contexto;
- quando houver múltiplos pontos relevantes no contexto, cubra os principais sem omitir informação importante apenas para encurtar a resposta.

Organize respostas mais longas com parágrafos, listas ou subtítulos curtos quando isso melhorar a clareza.
Não invente conteúdo fora dos documentos.
Não produza parede de texto repetitiva.
Preserve a citação de fontes ao final.
`;

const newContent = String(pub.content) + completenessBlock;
const contentHash = crypto.createHash('sha256').update(newContent).digest('hex');

// Update existing draft v2 OR insert v3
const draft = (
  await c.query(
    `SELECT id, version_number FROM ai_prompt_versions
     WHERE prompt_definition_id=$1 AND status='DRAFT'
     ORDER BY version_number DESC LIMIT 1`,
    [pub.prompt_definition_id],
  )
).rows[0];

if (draft) {
  const u = await c.query(
    `UPDATE ai_prompt_versions
     SET content=$2, content_hash=$3, max_tokens=1200,
         change_summary='Etapa 28.2: completude adaptativa + max_tokens 1200 (DRAFT A/B). Sem publish automático.',
         based_on_version_id=$4
     WHERE id=$1
     RETURNING id, version_number, max_tokens, status, length(content) AS len`,
    [draft.id, newContent, contentHash, pub.id],
  );
  console.log('updated draft', u.rows[0]);
} else {
  const ins = await c.query(
    `INSERT INTO ai_prompt_versions (
       id, prompt_definition_id, version_number, status, content, content_hash,
       model_name, temperature, top_p, max_tokens, response_format, parameters, metadata,
       change_summary, based_on_version_id, environment, created_at
     ) VALUES (
       gen_random_uuid(), $1,
       (SELECT COALESCE(MAX(version_number),0)+1 FROM ai_prompt_versions WHERE prompt_definition_id=$1),
       'DRAFT', $2, $3, $4, $5, $6, 1200, $7, $8, $9,
       'Etapa 28.2: completude adaptativa + max_tokens 1200',
       $10, $11, NOW()
     ) RETURNING id, version_number, max_tokens, status`,
    [
      pub.prompt_definition_id,
      newContent,
      contentHash,
      pub.model_name,
      pub.temperature,
      pub.top_p,
      pub.response_format,
      pub.parameters,
      pub.metadata,
      pub.id,
      pub.environment,
    ],
  );
  console.log('inserted', ins.rows[0]);
}

const check = await c.query(
  `SELECT version_number, status, max_tokens FROM ai_prompt_versions WHERE prompt_definition_id=$1 ORDER BY version_number`,
  [pub.prompt_definition_id],
);
console.log(check.rows);
await c.end();
