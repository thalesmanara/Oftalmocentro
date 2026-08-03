#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT id, name, nodes, connections FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

for (const n of nodes) {
  const code = n.parameters?.jsCode || '';
  if (/contextWindow|components|draftCount/.test(code + n.name)) {
    console.log('---', n.name);
    writeFileSync(new URL(`./_c212-gethealth-${n.name.replace(/\W+/g, '_')}.js`, import.meta.url), code || JSON.stringify(n.parameters, null, 2));
    if (code) {
      const i = code.indexOf('contextWindow');
      if (i >= 0) console.log(code.slice(i, i + 900));
    }
  }
}

// Patch if whitelist found
let patched = false;
for (const n of nodes) {
  let code = n.parameters?.jsCode || '';
  if (!code.includes('contextWindow')) continue;
  if (code.includes('secretsMatchPublished')) {
    console.log(n.name, 'already has secretsMatchPublished');
    continue;
  }
  // Common pattern: copy fixed fields
  if (code.includes('draftCount') && code.includes('fallbackCount7d')) {
    const before = code;
    // Add fields after draftCount or lastDatasetValidation
    if (code.includes('lastDatasetValidation:')) {
      code = code.replace(
        /lastDatasetValidation:\s*[^,\n]+,?/,
        (m) =>
          `${m}
      lastValidationRun: cw.lastValidationRun ?? cw.lastDatasetValidation ?? null,
      lastValidationScore: cw.lastValidationScore ?? null,
      secretsMatchPublished: cw.secretsMatchPublished !== false,
      multiplePublishedCount: Number(cw.multiplePublishedCount ?? 0) || 0,
      invalidConfigCount: Number(cw.invalidConfigCount ?? 0) || 0,`,
      );
    } else if (code.includes('draftCount:')) {
      code = code.replace(
        /draftCount:\s*[^,\n]+,?/,
        (m) =>
          `${m}
      lastValidationRun: cw.lastValidationRun ?? cw.lastDatasetValidation ?? null,
      lastValidationScore: cw.lastValidationScore ?? null,
      secretsMatchPublished: cw.secretsMatchPublished !== false,
      multiplePublishedCount: Number(cw.multiplePublishedCount ?? 0) || 0,
      invalidConfigCount: Number(cw.invalidConfigCount ?? 0) || 0,`,
      );
    }
    if (code !== before) {
      n.parameters.jsCode = code;
      patched = true;
      console.log('patched', n.name);
    } else {
      console.log('could not auto-patch', n.name);
      console.log(code.slice(code.indexOf('contextWindow'), code.indexOf('contextWindow') + 700));
    }
  }
}

if (patched) {
  const versionId = randomUUID();
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, '2UPHcxASp2PboC9M', JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, 'Pass through contextWindow health fields'],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, '2UPHcxASp2PboC9M'],
  );
  await client.query('COMMIT');
  console.log('GET Health version', versionId);
  writeFileSync(new URL('./_c212-gethealth-vid.txt', import.meta.url), versionId);
}

await client.end();
