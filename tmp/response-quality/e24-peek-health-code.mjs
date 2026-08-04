import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const prep = nodes.find((n) => n.name === 'Prepare checks');
const code = prep.parameters.jsCode;
const idx = code.indexOf('rqDb');
console.log('rqDb contexts:');
let i = 0;
while ((i = code.indexOf('rqDb', i)) !== -1) {
  console.log('---', code.slice(Math.max(0, i - 40), i + 80).replace(/\n/g, ' '));
  i += 4;
}
const agg = nodes.find((n) => n.name === 'Aggregate health');
const a = agg.parameters.jsCode;
const j = a.indexOf('responseQuality');
console.log('\nagg snippet', a.slice(j, j + 500));

const w = await c.query(`SELECT nodes FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const wn = typeof w.rows[0].nodes === 'string' ? JSON.parse(w.rows[0].nodes) : w.rows[0].nodes;
const m = wn.find((n) => n.name === 'Montar resposta admin');
console.log('\nallowlist has responseQuality', m.parameters.jsCode.includes("'responseQuality'"));
await c.end();
