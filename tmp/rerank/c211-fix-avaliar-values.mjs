#!/usr/bin/env node
/**
 * Fix Avaliar INSERT: columns list has context metrics but VALUES were never appended.
 * Insert workflow_history FIRST, then update entity (FK).
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
let code = n.parameters.jsCode;

if (!code.includes('(relevantContextRate == null')) {
  const needle = `'" + j(rankedDocumentIds) + "'::jsonb`;
  const idx = code.indexOf(needle);
  if (idx < 0) {
    console.error('needle not found');
    process.exit(1);
  }
  const after = code.slice(idx);
  const retIdx = after.indexOf(') RETURNING id');
  if (retIdx < 0) {
    console.error('RETURNING not found');
    process.exit(1);
  }
  const before = code.slice(0, idx);
  const rest = after.slice(retIdx);
  const valuesBlock =
    `"  '" + j(rankedDocumentIds) + "'::jsonb,\\n" +
  "  " + (contextConfigVersionId ? ("'" + esc(contextConfigVersionId) + "'::uuid") : 'NULL') + ", " + (contextConfigVersion ? ("'" + esc(contextConfigVersion) + "'") : 'NULL') + ", " + (contextMode ? ("'" + esc(contextMode) + "'") : 'NULL') + ",\\n" +
  "  " + (modelContextLimit == null ? 'NULL' : String(modelContextLimit)) + ", " + (availableContextTokens == null ? 'NULL' : String(availableContextTokens)) + ", " + (estimatedContextTokens == null ? 'NULL' : String(estimatedContextTokens)) + ",\\n" +
  "  " + (includedChunkCount == null ? 'NULL' : String(includedChunkCount)) + ", " + (excludedChunkCount == null ? 'NULL' : String(excludedChunkCount)) + ", " + (includedDocumentCount == null ? 'NULL' : String(includedDocumentCount)) + ",\\n" +
  "  " + (redundancyRemovedCount == null ? 'NULL' : String(redundancyRemovedCount)) + ", " + (neighborsAddedCount == null ? 'NULL' : String(neighborsAddedCount)) + ", " + (contextBuildLatencyMs == null ? 'NULL' : String(Math.round(contextBuildLatencyMs))) + ",\\n" +
  "  " + (contextFallbackUsed ? 'true' : 'false') + ", " + (insufficientContext ? 'true' : 'false') + ", " + (conflictDetected ? 'true' : 'false') + ",\\n" +
  "  " + (contextUtilizationRate == null ? 'NULL' : String(Math.min(1, Math.max(0, Number(contextUtilizationRate))))) + ",\\n" +
  "  " + (relevantContextRate == null ? 'NULL' : String(relevantContextRate)) + ", " + (sourceCoverage == null ? 'NULL' : String(sourceCoverage)) + ", " + (redundancyRate == null ? 'NULL' : String(redundancyRate)) + ",\\n" +
  "  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" +
  `;
  code = before + valuesBlock + rest;
  console.log('Patched VALUES');
} else {
  console.log('VALUES already OK');
}

// Ensure context var declarations exist
if (!code.includes('const contextConfigVersionId =')) {
  const marker = 'const conflictDetected = !!contextMeta.conflictDetected;';
  if (!code.includes(marker)) {
    console.error('conflictDetected marker missing');
    process.exit(1);
  }
  const decls = `
const contextConfigVersionId = contextMeta.contextConfigVersionId || contextMeta.versionId || null;
const contextConfigVersion = contextMeta.contextConfigVersion || contextMeta.versionLabel || null;
const contextMode = contextMeta.mode || contextMeta.contextMode || null;
const modelContextLimit = contextMeta.modelContextLimit != null ? Number(contextMeta.modelContextLimit) : (contextMeta.contextLimitTokens != null ? Number(contextMeta.contextLimitTokens) : null);
const availableContextTokens = contextMeta.availableContextTokens != null ? Number(contextMeta.availableContextTokens) : null;
const estimatedContextTokens = contextMeta.estimatedContextTokens != null ? Number(contextMeta.estimatedContextTokens) : null;
const includedChunkCount = contextMeta.includedChunkCount != null ? Number(contextMeta.includedChunkCount) : null;
const excludedChunkCount = contextMeta.excludedChunkCount != null ? Number(contextMeta.excludedChunkCount) : null;
const includedDocumentCount = contextMeta.includedDocumentCount != null ? Number(contextMeta.includedDocumentCount) : null;
const redundancyRemovedCount = contextMeta.redundancyRemovedCount != null ? Number(contextMeta.redundancyRemovedCount) : 0;
const neighborsAddedCount = contextMeta.neighborsAddedCount != null ? Number(contextMeta.neighborsAddedCount) : 0;
const contextBuildLatencyMs = contextMeta.contextBuildLatencyMs != null ? Number(contextMeta.contextBuildLatencyMs) : null;
const contextFallbackUsed = !!contextMeta.contextFallbackUsed || !!contextMeta.fallbackUsed;
const insufficientContext = !!contextMeta.insufficientContext;
`;
  // Only inject missing ones before conflictDetected if not present
  // Actually conflictDetected comes AFTER insufficientContext in current code - check order
  if (!code.includes('const modelContextLimit')) {
    code = code.replace(marker, decls + marker);
    console.log('Injected context var decls');
  }
}

n.parameters.jsCode = code;
const nodesJson = JSON.stringify(nodes);
const connJson = JSON.stringify(connections);
const versionId = randomUUID();

await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'Fix Avaliar context VALUES',false,NOW(),NOW())`,
  [versionId, 'KdpEmEGHNlPICOa4', nodesJson, connJson, rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, "updatedAt"=NOW() WHERE id='KdpEmEGHNlPICOa4'`,
  [nodesJson, connJson, versionId],
);
await client.query('COMMIT');

console.log('OK', versionId);
console.log('has relevant VALUES', code.includes('(relevantContextRate == null'));
console.log('has contextConfigVersionId decl', code.includes('const contextConfigVersionId'));
await client.end();
