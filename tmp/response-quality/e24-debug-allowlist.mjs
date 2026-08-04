import pg from 'pg';
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const w = await c.query(
  `SELECT "versionId", "activeVersionId", active FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
);
console.log('wrapper versions', w.rows[0]);
const hist = await c.query(
  `SELECT "versionId", "createdAt" FROM workflow_history WHERE "workflowId"='2UPHcxASp2PboC9M' ORDER BY "createdAt" DESC LIMIT 3`,
);
console.log('hist', hist.rows);

const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const m = nodes.find((n) => n.name === 'Montar resposta admin');
const code = m.parameters.jsCode;
const allow = code.match(/\[[^\]]*(?:semanticCache|evidenceLayer|responseQuality)[^\]]*\]/);
console.log('allowlist match', allow?.[0]);
console.log('has key handler', code.includes("key === 'responseQuality'"));

// Check if Aggregate actually puts responseQuality into components object - search for "components =" or return
const h = await c.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const hn = typeof h.rows[0].nodes === 'string' ? JSON.parse(h.rows[0].nodes) : h.rows[0].nodes;
const agg = hn.find((n) => n.name === 'Aggregate health');
const ac = agg.parameters.jsCode;
// find how components is assembled
const m2 = ac.match(/components\s*[:=]\s*\{/);
console.log('components assign', !!m2);
console.log('count responseQuality', (ac.match(/responseQuality/g) || []).length);
// Maybe responseQuality is defined but components uses spread of known keys only
if (ac.includes('const components = {') || ac.includes('components: {') || ac.includes('components={')) {
  const start = ac.search(/components\s*[:=]\s*\{/);
  console.log(ac.slice(start, start + 800));
}
await c.end();
