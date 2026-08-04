import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

const ex = await c.query(
  `SELECT id, status, "startedAt" FROM execution_entity WHERE "workflowId"='c24QualityDetail001' ORDER BY "startedAt" DESC LIMIT 5`,
);
console.log('execs', ex.rows);

if (ex.rows[0]) {
  const data = await c.query(`SELECT data FROM execution_data WHERE "executionId"=$1`, [
    String(ex.rows[0].id),
  ]);
  // n8n may store compressed - try
  const raw = data.rows[0]?.data;
  const text = typeof raw === 'string' ? raw : JSON.stringify(raw || {}).slice(0, 2000);
  console.log('data sample', text.slice(0, 1500));
}

const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='c24QualityDetail001'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const restore = nodes.find((n) => n.name === 'Restaurar request');
console.log('\nRESTORE CODE:\n', restore?.parameters?.jsCode);

// Check health aggregate for responseQuality
const h = await c.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const hn = typeof h.rows[0].nodes === 'string' ? JSON.parse(h.rows[0].nodes) : h.rows[0].nodes;
const agg = hn.find((n) => n.name === 'Aggregate health');
console.log('\nhas responseQuality in agg', agg?.parameters?.jsCode?.includes('responseQuality'));
const probe = hn.find((n) => n.name === 'Probe database');
console.log('has rq_stats', String(probe?.parameters?.query || '').includes('rq_stats'));
const prep = hn.find((n) => n.name === 'Prepare checks');
console.log('has rqDb', prep?.parameters?.jsCode?.includes('rqDb'));

await c.end();
