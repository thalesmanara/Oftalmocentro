import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const ids = {
  consulta: '8EXk5RkFW5cxnenL',
  dataset: '12t0Ol6zWQJgAKPC',
  teste: 'KdpEmEGHNlPICOa4',
  health: 'qAyYc9DrHIqe4L9i',
  getHealth: '2UPHcxASp2PboC9M',
  backup: 'A16PhhWFr0Za9X3B',
  runCase: 'qVH5qtBf8IY32uiH',
  runDataset: 'wTH2YV6pIlhzWDiY',
};

for (const [k, id] of Object.entries(ids)) {
  const { rows } = await c.query(`SELECT name, nodes::text AS n, connections::text AS c FROM workflow_entity WHERE id=$1`, [id]);
  const r = rows[0];
  if (!r) {
    console.log(k, 'MISSING');
    continue;
  }
  console.log(k, {
    name: r.name,
    hasCarregar: /Carregar prompt/i.test(r.n) || /Carregar prompt/i.test(r.c),
    hasPromptVersionId: /promptVersionId/i.test(r.n),
    hasAiPrompts: /aiPrompts/i.test(r.n) || /ai_prompt/i.test(r.n),
    hasSystemContent: /systemContent/i.test(r.n),
  });
}

const { rows: apis } = await c.query(
  `SELECT id, name, active FROM workflow_entity WHERE name ILIKE '%AI Prompt%' OR path IS NOT NULL AND false ORDER BY name`,
);
// also search webhook paths via nodes
const { rows: all } = await c.query(
  `SELECT id, name, active FROM workflow_entity WHERE nodes::text ILIKE '%system/ai-prompts%' ORDER BY name`,
);
console.log('webhooks with system/ai-prompts:', all);

await c.end();
