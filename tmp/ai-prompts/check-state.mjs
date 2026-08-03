import pg from 'pg';
const c = new pg.Client({
  connectionString:
    process.env.PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes, name FROM workflow_entity WHERE id = $1`, [
  '8EXk5RkFW5cxnenL',
]);
const nodes = rows[0].nodes;
const names = nodes.map((n) => n.name);
console.log('nodes:', names.join(' | '));
const msg = nodes.find((n) => n.name === 'Message a model');
const sys = (msg?.parameters?.responses?.values || []).find((v) => v.role === 'system');
const content = String(sys?.content || '');
console.log('hardcoded PT?', content.includes('Você é a IA interna'));
console.log('uses systemContent?', content.includes('systemContent') || content.includes('$json'));
console.log(
  'has Carregar?',
  names.some((n) => /carregar prompt/i.test(n)),
);
console.log('system preview:', content.slice(0, 160));

const { rows: wh } = await c.query(
  `SELECT id, name, active FROM workflow_entity WHERE name ILIKE '%AI Prompt%' OR name ILIKE '%ai-prompt%' OR name ILIKE '%PROMPT%' ORDER BY name`,
);
console.log('prompt workflows:', JSON.stringify(wh, null, 2));

const { rows: cols } = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name='ai_test_runs' AND column_name LIKE '%prompt%'`,
);
console.log('ai_test_runs prompt cols:', cols);

await c.end();
