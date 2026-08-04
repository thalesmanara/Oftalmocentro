import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
  ssl: false,
});
await c.connect();

const r = await c.query(
  `SELECT id, name, active, "updatedAt",
          "activeVersionId",
          length(nodes::text) AS nodes_len
   FROM workflow_entity WHERE id = $1`,
  ['WCwJqtFRROwoToik'],
);
console.log(r.rows[0]);

const wf = await c.query(`SELECT nodes, connections FROM workflow_entity WHERE id = $1`, [
  'WCwJqtFRROwoToik',
]);
const nodes = typeof wf.rows[0].nodes === 'string' ? JSON.parse(wf.rows[0].nodes) : wf.rows[0].nodes;
const conns = typeof wf.rows[0].connections === 'string' ? JSON.parse(wf.rows[0].connections) : wf.rows[0].connections;

console.log('\nNodes:');
for (const n of nodes) {
  console.log(`- ${n.name} (${n.type}) disabled=${!!n.disabled}`);
}

const respond = nodes.find((n) => n.name === 'Respond to Webhook' || n.type === 'n8n-nodes-base.respondToWebhook');
const prep = nodes.find((n) => n.name === 'Preparar sucesso' || n.name?.includes('Preparar'));
console.log('\nRespond params:', JSON.stringify(respond?.parameters, null, 2)?.slice(0, 2000));
console.log('\nPrep params/code snippet:', JSON.stringify(prep?.parameters, null, 2)?.slice(0, 2000));

// Find Code nodes that mount response
for (const n of nodes.filter((x) => x.type === 'n8n-nodes-base.code')) {
  const code = n.parameters?.jsCode || '';
  console.log(`\n=== CODE: ${n.name} (${code.length} chars) ===`);
  console.log(code.slice(0, 800));
}

console.log('\nConnections keys:', Object.keys(conns));

// Recent executions
const ex = await c.query(
  `SELECT id, status, "startedAt", "stoppedAt", mode
   FROM execution_entity
   WHERE "workflowId" = $1
   ORDER BY "startedAt" DESC
   LIMIT 8`,
  ['WCwJqtFRROwoToik'],
);
console.log('\nExecutions:', ex.rows);

await c.end();
