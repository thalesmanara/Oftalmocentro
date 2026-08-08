import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const row = (
  await c.query(`SELECT nodes, connections FROM workflow_entity WHERE id='Y0MuWEEdoMFts7ay'`)
).rows[0];
const nodes = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes;
const conns =
  typeof row.connections === 'string' ? JSON.parse(row.connections) : row.connections;

const names = nodes.map((n) => ({
  name: n.name,
  type: n.type,
  disabled: !!n.disabled,
}));

const invRelated = nodes.filter(
  (n) =>
    /cache|invalid|isActive|ativ/i.test(n.name) ||
    JSON.stringify(n.parameters || {}).includes('c221Invalidate'),
);

const invDetails = invRelated.map((n) => ({
  name: n.name,
  type: n.type,
  disabled: !!n.disabled,
  params: n.parameters,
}));

// Find connections involving invalidate nodes
const invNames = new Set(invRelated.map((n) => n.name));
const relatedConns = {};
for (const [from, v] of Object.entries(conns || {})) {
  if (invNames.has(from) || JSON.stringify(v).match(/Invalidar|isActive|Cache/i)) {
    relatedConns[from] = v;
  }
}

writeFileSync(
  'tmp/post-go-live/28-final-put-invalidate-wiring.json',
  JSON.stringify({ names, invDetails, relatedConns }, null, 2),
);
console.log(
  JSON.stringify(
    {
      nodeCount: names.length,
      invNames: invRelated.map((n) => `${n.name}|disabled=${!!n.disabled}|type=${n.type}`),
      relatedConns,
    },
    null,
    2,
  ),
);
await c.end();
