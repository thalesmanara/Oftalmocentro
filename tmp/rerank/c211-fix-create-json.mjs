#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
import { randomUUID, createHash } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// 1) Fix VALIDAR success payload
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='0289408b8d774379'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  let target = null;
  for (const n of nodes) {
    if (n.parameters?.jsCode && (!target || n.parameters.jsCode.length > target.parameters.jsCode.length)) {
      target = n;
    }
  }
  writeFileSync(new URL('./_c211-validar-before.js', import.meta.url), target.parameters.jsCode);
  let code = target.parameters.jsCode;

  // Append serializer helper if missing
  if (!code.includes('function buildConfigArtifacts')) {
    code =
      `function buildConfigArtifacts(configuration){
  const cfg = configuration && typeof configuration === 'object' ? configuration : {};
  const configurationJson = JSON.stringify(cfg);
  let h = 0;
  for (let i = 0; i < configurationJson.length; i++) {
    h = ((h << 5) - h) + configurationJson.charCodeAt(i);
    h |= 0;
  }
  const contentHash = 'shaish-' + Math.abs(h).toString(16) + '-' + configurationJson.length;
  return { configuration: cfg, configurationJson, contentHash };
}
` + code;
  }

  // Replace success returns that have ok:true and configuration but missing configurationJson
  // Strategy: find final success assignment patterns
  if (!code.includes('configurationJson')) {
    // Common pattern from etapa 21: return [{json:{ ok:true, ..., configuration: normalized, ...
    code = code.replace(
      /configuration\s*:\s*(normalized|cfg|configuration|config)\b/g,
      (m, v) =>
        `configuration: buildConfigArtifacts(${v}).configuration, configurationJson: buildConfigArtifacts(${v}).configurationJson, contentHash: buildConfigArtifacts(${v}).contentHash`,
    );
  }

  // If still no configurationJson, force-patch any `ok: true` object literal near end
  if (!code.includes('configurationJson')) {
    const idx = code.lastIndexOf('ok: true');
    if (idx < 0) {
      const idx2 = code.lastIndexOf('ok:true');
      if (idx2 >= 0) {
        code =
          code.slice(0, idx2) +
          'ok:true, configurationJson: buildConfigArtifacts(configuration || {}).configurationJson, contentHash: buildConfigArtifacts(configuration || {}).contentHash, ' +
          code.slice(idx2 + 'ok:true'.length);
      }
    } else {
      code =
        code.slice(0, idx) +
        'ok: true, configurationJson: buildConfigArtifacts(configuration || {}).configurationJson, contentHash: buildConfigArtifacts(configuration || {}).contentHash, ' +
        code.slice(idx + 'ok: true'.length);
    }
  }

  target.parameters.jsCode = code;
  writeFileSync(new URL('./_c211-validar-after.js', import.meta.url), code);
  console.log('VALIDAR patched', {
    hasJson: code.includes('configurationJson'),
    hasHash: code.includes('contentHash'),
    hasBuilder: code.includes('buildConfigArtifacts'),
  });

  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'VALIDAR emit configurationJson+hash',false,NOW(),NOW())`,
    [versionId, '0289408b8d774379', nodesJson, connJson, rows[0].name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
    [nodesJson, versionId, '0289408b8d774379'],
  );
  await client.query('COMMIT');
  console.log('VALIDAR version', versionId);
}

// 2) Also harden CREATE Inserir DRAFT to fall back to Preparar create.configurationJson
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='5fbdabb413c3405d'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const n = nodes.find((x) => x.name === 'Inserir DRAFT');
  let q = n.parameters.query;
  q = q.replace(
    `'{{ $('Chamar VALIDAR').first().json.configurationJson }}'::jsonb`,
    `COALESCE(NULLIF('{{ $('Chamar VALIDAR').first().json.configurationJson || "" }}',''), '{{ $('Preparar create').first().json.configurationJson || "{}" }}')::jsonb`,
  );
  q = q.replace(
    `'{{ $('Chamar VALIDAR').first().json.contentHash }}'`,
    `COALESCE(NULLIF('{{ $('Chamar VALIDAR').first().json.contentHash || "" }}',''), md5(COALESCE(NULLIF('{{ $('Chamar VALIDAR').first().json.configurationJson || "" }}',''), '{{ $('Preparar create').first().json.configurationJson || "{}" }}')))`,
  );
  n.parameters.query = q;
  const versionId = randomUUID();
  const nodesJson = JSON.stringify(nodes);
  const connJson = JSON.stringify(connections);
  await client.query('BEGIN');
  await client.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'CREATE fallback configurationJson',false,NOW(),NOW())`,
    [versionId, '5fbdabb413c3405d', nodesJson, connJson, rows[0].name],
  );
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
    [nodesJson, versionId, '5fbdabb413c3405d'],
  );
  await client.query('COMMIT');
  console.log('CREATE version', versionId);
  console.log('query snippet', q.slice(q.indexOf('configuration'), q.indexOf('configuration') + 280));
}

await client.end();
