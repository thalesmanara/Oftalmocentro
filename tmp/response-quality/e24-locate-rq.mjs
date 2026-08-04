import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const agg = nodes.find((n) => n.name === 'Aggregate health');
const ac = agg.parameters.jsCode;
const rq = ac.indexOf('responseQuality');
const comp = ac.search(/components\s*=\s*\{/);
const sem = ac.indexOf('semanticCache:');
const ev = ac.indexOf('evidenceLayer:');
console.log({ rq, comp, sem, ev, len: ac.length });
console.log('around responseQuality:\n', ac.slice(rq - 100, rq + 200));
console.log('\n--- end of components keys search ---');
// Find closing of components - look for evidenceLayer and what follows
console.log(ac.slice(ev, ev + 200));
console.log('...');
const afterEv = ac.indexOf('})(),', ev);
console.log(ac.slice(afterEv, afterEv + 120));

const w = await c.query(`SELECT nodes FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const wn = typeof w.rows[0].nodes === 'string' ? JSON.parse(w.rows[0].nodes) : w.rows[0].nodes;
const m = wn.find((n) => n.name === 'Montar resposta admin');
let code = m.parameters.jsCode;
// Force allowlist fix
if (!code.includes("'responseQuality'")) {
  code = code.replace("'evidenceLayer']", "'evidenceLayer','responseQuality']");
  m.parameters.jsCode = code;
  console.log('will need save');
} else {
  console.log('already in allowlist string search', code.includes("evidenceLayer','responseQuality"));
}
// show exact allowlist line
const line = code.split('\n').find((l) => l.includes('semanticCache') && l.includes('['));
console.log('line', line);

await c.end();
