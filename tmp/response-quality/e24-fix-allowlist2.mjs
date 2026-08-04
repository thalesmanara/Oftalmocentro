import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT name, nodes, connections FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes);
const m = nodes.find((n) => n.name === 'Montar resposta admin');
let code = m.parameters.jsCode;

const idx = code.indexOf('allowedCompKeys');
console.log('BEFORE:', code.slice(idx, idx + 280));

if (!code.includes("responseQuality")) {
  // no-op check - key handler may already mention it
}
if (!/allowedCompKeys\s*=\s*\[[^\]]*responseQuality/.test(code)) {
  code = code.replace(
    /allowedCompKeys\s*=\s*\[([^\]]*)\]/,
    (full, inner) => {
      if (inner.includes('responseQuality')) return full;
      const trimmed = inner.replace(/\s+$/, '');
      return `allowedCompKeys = [${trimmed},'responseQuality']`;
    },
  );
}
m.parameters.jsCode = code;
console.log('AFTER:', code.slice(code.indexOf('allowedCompKeys'), code.indexOf('allowedCompKeys') + 300));

const versionId = randomUUID();
await c.query('BEGIN');
await c.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa24',$3::json,$4::json,$5,'allowlist rq2',false,NOW(),NOW())`,
  [versionId, '2UPHcxASp2PboC9M', JSON.stringify(nodes), JSON.stringify(rows[0].connections), rows[0].name],
);
await c.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, active=true, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(nodes), versionId, '2UPHcxASp2PboC9M'],
);
await c.query('COMMIT');
await c.query(`UPDATE workflow_entity SET active=false WHERE id='2UPHcxASp2PboC9M'`);
await c.query(`UPDATE workflow_entity SET active=true WHERE id='2UPHcxASp2PboC9M'`);
console.log('ok', versionId);
await c.end();
