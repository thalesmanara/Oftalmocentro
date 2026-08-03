#!/usr/bin/env node
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const ID = 'KdpEmEGHNlPICOa4';
const { rows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [ID],
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
let code = n.parameters.jsCode;

const oldVals = `"  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +
  "  " + String(K) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\\n" +`;

const newVals = `"  " + (retrievalLatencyMs == null ? 'NULL' : String(Math.round(retrievalLatencyMs))) + ", " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +
  "  " + (finalContextCount == null ? 'NULL' : String(finalContextCount)) + ", " + (retrievalConfigVersion ? ("'" + esc(retrievalConfigVersion) + "'") : 'NULL') + ", " + (fallbackUsed ? 'true' : 'false') + ", NULL, " + (retrievalMode ? ("'" + esc(retrievalMode) + "'") : 'NULL') + ",\\n" +`;

if (!code.includes(oldVals)) {
  // try without escaped newlines as actual newlines
  const old2 = `  "  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +
  "  " + String(K) + ", "`;
  // actual content in js string uses real \n in source as line breaks inside template... the code is a JS string with literal + "\n" +
}

if (code.includes(`"  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs)))`)) {
  code = code.replace(
    `"  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +\n  "  " + String(K) + ", "`,
    `"  " + (retrievalLatencyMs == null ? 'NULL' : String(Math.round(retrievalLatencyMs))) + ", " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\\n" +\n  "  " + (finalContextCount == null ? 'NULL' : String(finalContextCount)) + ", "`,
  );
  if (!code.includes('retrievalLatencyMs == null ? \'NULL\'')) {
    // try with actual newline characters in the jsCode
    code = code.replace(
      `"  NULL, " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\n" +\n  "  " + String(K) + ", "`,
      `"  " + (retrievalLatencyMs == null ? 'NULL' : String(Math.round(retrievalLatencyMs))) + ", " + (rerankLatencyMs == null ? 'NULL' : String(Math.round(rerankLatencyMs))) + ",\n" +\n  "  " + (finalContextCount == null ? 'NULL' : String(finalContextCount)) + ", "`,
    );
  }
  console.log('replaced latency/final values', code.includes('retrievalLatencyMs == null'));
} else {
  console.log('pattern not found');
}

code = code.replace(
  'candidatesRetrieved, candidatesReranked, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode,',
  'candidatesRetrieved, candidatesReranked, finalContextCount, retrievalLatencyMs, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode, rankedChunkIds,',
);

n.parameters.jsCode = code;
await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
  JSON.stringify(nodes),
  ID,
]);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(nodes), ID, rows[0].activeVersionId],
  );
}

// verify
const verify = n.parameters.jsCode;
console.log({
  sqlUsesRetrievalLatency: verify.includes('retrievalLatencyMs == null ? \'NULL\''),
  sqlUsesFinalContext: verify.includes('finalContextCount == null ? \'NULL\''),
  stillNullLatency: verify.includes(`"  NULL, " + (rerankLatencyMs`),
  stillStringK: /String\(K\) \+ ", " \+ \(retrievalConfigVersion/.test(verify),
});
await client.end();
