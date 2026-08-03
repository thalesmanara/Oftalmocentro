#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='NhWUkmzGhlttJC9S'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => x.parameters?.jsCode);
writeFileSync(new URL('./_validar-full.js', import.meta.url), n.parameters.jsCode);
console.log(n.name);

// Fix: only validate versionLabel format when non-empty
let js = n.parameters.jsCode;
const old = js;
// Pattern used in consolidacao-part1
js = js.replace(
  /if\s*\(\s*versionLabel\s*&&\s*!LABEL_RE\.test\(versionLabel\)\s*\)/,
  'if (versionLabel && !LABEL_RE.test(versionLabel))',
);
if (js === old) {
  js = js.replace(
    /if\s*\(\s*!LABEL_RE\.test\(versionLabel\)\s*\)/,
    'if (versionLabel && !LABEL_RE.test(versionLabel))',
  );
}
if (js === old && js.includes('formato inválido')) {
  // Find line and wrap
  js = js.replace(
    /(errors\.push\(\{\s*field:\s*['"]versionLabel['"][\s\S]*?FORMAT['"]\s*\}\);)/,
    'if (versionLabel) $1',
  );
}

if (js !== old) {
  n.parameters.jsCode = js;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='NhWUkmzGhlttJC9S'`, [
    JSON.stringify(nodes),
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='NhWUkmzGhlttJC9S' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
  console.log('VALIDAR versionLabel optional when empty — updated');
} else {
  console.log('No change applied — inspect _validar-full.js');
  // show relevant lines
  const lines = js.split('\n').filter((l) => /versionLabel|LABEL|formato/.test(l));
  console.log(lines.join('\n'));
}

// Cleanup test drafts
const cleaned = await client.query(
  `UPDATE ai_retrieval_config_versions
   SET status='REJECTED', notes=COALESCE(notes,'') || ' [optest-cleanup]'
   WHERE version_label LIKE 'tmp-%' AND status IN ('DRAFT','VALIDATING','ARCHIVED')
   RETURNING id, version_label, status`,
);
console.log('cleaned', cleaned.rows);
await client.end();
