#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const n = nodes.find((x) => x.name === 'Montar resposta admin');
const old = `if (key === 'contextWindow') {
    out.activeMode = c.activeMode || null;
    out.activeVersion = c.activeVersion || null;
    out.modelName = c.modelName || null;
    out.avgAvailableTokens = c.avgAvailableTokens != null ? Number(c.avgAvailableTokens) : null;
    out.avgUsedTokens = c.avgUsedTokens != null ? Number(c.avgUsedTokens) : null;
    out.avgUtilizationRate = c.avgUtilizationRate != null ? Number(c.avgUtilizationRate) : null;
    out.avgIncludedChunks = c.avgIncludedChunks != null ? Number(c.avgIncludedChunks) : null;
    out.avgExcludedChunks = c.avgExcludedChunks != null ? Number(c.avgExcludedChunks) : null;
    out.overflowCount7d = Number(c.overflowCount7d || 0) || 0;
    out.fallbackCount7d = Number(c.fallbackCount7d || 0) || 0;
    out.failureCount7d = Number(c.failureCount7d || 0) || 0;
    out.insufficientContextCount7d = Number(c.insufficientContextCount7d || 0) || 0;
    out.avgBuildLatencyMs = c.avgBuildLatencyMs != null ? Number(c.avgBuildLatencyMs) : null;
    out.draftCount = Number(c.draftCount || 0) || 0;
    if (c.lastDatasetValidation) out.lastDatasetValidation = c.lastDatasetValidation;
  }`;

const neu = `if (key === 'contextWindow') {
    out.activeMode = c.activeMode || null;
    out.activeVersion = c.activeVersion || null;
    out.modelName = c.modelName || null;
    out.avgAvailableTokens = c.avgAvailableTokens != null ? Number(c.avgAvailableTokens) : null;
    out.avgUsedTokens = c.avgUsedTokens != null ? Number(c.avgUsedTokens) : null;
    out.avgUtilizationRate = c.avgUtilizationRate != null ? Number(c.avgUtilizationRate) : null;
    out.avgIncludedChunks = c.avgIncludedChunks != null ? Number(c.avgIncludedChunks) : null;
    out.avgExcludedChunks = c.avgExcludedChunks != null ? Number(c.avgExcludedChunks) : null;
    out.overflowCount7d = Number(c.overflowCount7d || 0) || 0;
    out.fallbackCount7d = Number(c.fallbackCount7d || 0) || 0;
    out.failureCount7d = Number(c.failureCount7d || 0) || 0;
    out.insufficientContextCount7d = Number(c.insufficientContextCount7d || 0) || 0;
    out.avgBuildLatencyMs = c.avgBuildLatencyMs != null ? Number(c.avgBuildLatencyMs) : null;
    out.draftCount = Number(c.draftCount || 0) || 0;
    if (c.lastDatasetValidation) out.lastDatasetValidation = c.lastDatasetValidation;
    out.lastValidationRun = c.lastValidationRun || c.lastDatasetValidation || null;
    out.lastValidationScore = c.lastValidationScore != null ? Number(c.lastValidationScore) : null;
    out.secretsMatchPublished = c.secretsMatchPublished !== false;
    out.multiplePublishedCount = Number(c.multiplePublishedCount || 0) || 0;
    out.invalidConfigCount = Number(c.invalidConfigCount || 0) || 0;
  }`;

if (!n.parameters.jsCode.includes(old)) {
  // try softer match
  if (!n.parameters.jsCode.includes("if (key === 'contextWindow')")) throw new Error('block missing');
  if (n.parameters.jsCode.includes('secretsMatchPublished')) {
    console.log('already patched');
  } else {
    n.parameters.jsCode = n.parameters.jsCode.replace(
      "if (c.lastDatasetValidation) out.lastDatasetValidation = c.lastDatasetValidation;\n  }\n  components[key] = out;",
      `if (c.lastDatasetValidation) out.lastDatasetValidation = c.lastDatasetValidation;
    out.lastValidationRun = c.lastValidationRun || c.lastDatasetValidation || null;
    out.lastValidationScore = c.lastValidationScore != null ? Number(c.lastValidationScore) : null;
    out.secretsMatchPublished = c.secretsMatchPublished !== false;
    out.multiplePublishedCount = Number(c.multiplePublishedCount || 0) || 0;
    out.invalidConfigCount = Number(c.invalidConfigCount || 0) || 0;
  }
  components[key] = out;`,
    );
    if (!n.parameters.jsCode.includes('secretsMatchPublished')) throw new Error('soft patch failed');
    console.log('soft patched');
  }
} else {
  n.parameters.jsCode = n.parameters.jsCode.replace(old, neu);
  console.log('exact patched');
}

const versionId = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.2',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
  [versionId, '2UPHcxASp2PboC9M', JSON.stringify(nodes), JSON.stringify(connections), rows[0].name, 'Expose contextWindow secrets/fallback fields'],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id=$4`,
  [JSON.stringify(nodes), JSON.stringify(connections), versionId, '2UPHcxASp2PboC9M'],
);
await client.query('COMMIT');
writeFileSync(new URL('./_c212-gethealth-vid.txt', import.meta.url), versionId);
console.log(versionId);
await client.end();
