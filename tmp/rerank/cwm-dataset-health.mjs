#!/usr/bin/env node
/**
 * Patch Avaliar to persist contextMeta fields; patch health contextWindow; soften conflict in CWM optional.
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// --- Avaliar ---
{
  const ID = 'KdpEmEGHNlPICOa4';
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [ID],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  let code = n.parameters.jsCode;
  if (!code.includes('contextMeta')) {
    code = code.replace(
      'const retrievalMeta = data.retrievalMeta && typeof data.retrievalMeta === \'object\' ? data.retrievalMeta : {};',
      `const retrievalMeta = data.retrievalMeta && typeof data.retrievalMeta === 'object' ? data.retrievalMeta : {};
const contextMeta = data.contextMeta && typeof data.contextMeta === 'object' ? data.contextMeta : {};`,
    );
  }
  if (!code.includes('contextConfigVersion')) {
    code = code.replace(
      'const retrievalMode = retrievalMeta.mode || null;',
      `const retrievalMode = retrievalMeta.mode || null;
const contextConfigVersion = contextMeta.configVersion || null;
const contextConfigVersionId = contextMeta.configVersionId || null;
const contextMode = contextMeta.mode || null;
const modelContextLimit = contextMeta.modelContextLimit != null ? Number(contextMeta.modelContextLimit) : null;
const availableContextTokens = contextMeta.availableContextTokens != null ? Number(contextMeta.availableContextTokens) : null;
const estimatedContextTokens = contextMeta.estimatedContextTokens != null ? Number(contextMeta.estimatedContextTokens) : null;
const includedChunkCount = contextMeta.includedChunkCount != null ? Number(contextMeta.includedChunkCount) : null;
const excludedChunkCount = contextMeta.excludedChunkCount != null ? Number(contextMeta.excludedChunkCount) : null;
const includedDocumentCount = contextMeta.includedDocumentCount != null ? Number(contextMeta.includedDocumentCount) : null;
const redundancyRemovedCount = contextMeta.redundancyRemovedCount != null ? Number(contextMeta.redundancyRemovedCount) : null;
const neighborsAddedCount = contextMeta.neighborsAddedCount != null ? Number(contextMeta.neighborsAddedCount) : null;
const contextBuildLatencyMs = contextMeta.durationMs != null ? Number(contextMeta.durationMs) : null;
const contextFallbackUsed = !!contextMeta.fallbackUsed;
const insufficientContext = !!contextMeta.insufficientContext;
const conflictDetected = !!contextMeta.conflictDetected;
const contextUtilizationRate = (availableContextTokens > 0 && estimatedContextTokens != null)
  ? Number(estimatedContextTokens) / Number(availableContextTokens) : null;`,
    );
  }
  // Add columns to INSERT if missing
  if (!code.includes('context_config_version')) {
    code = code.replace(
      '"  source_precision, source_recall, retrieval_ranked_document_ids\\n" +',
      `"  source_precision, source_recall, retrieval_ranked_document_ids,\\n" +
"  context_config_version_id, context_config_version, context_mode, model_context_limit, available_context_tokens,\\n" +
"  estimated_context_tokens, included_chunk_count, excluded_chunk_count, included_document_count,\\n" +
"  redundancy_removed_count, neighbors_added_count, context_build_latency_ms, context_fallback_used,\\n" +
"  insufficient_context, conflict_detected, context_utilization_rate\\n" +`,
    );
    // Also try without escaped newlines
    if (!code.includes('context_config_version')) {
      code = code.replace(
        'source_precision, source_recall, retrieval_ranked_document_ids\n" +',
        `source_precision, source_recall, retrieval_ranked_document_ids,\n" +
"  context_config_version_id, context_config_version, context_mode, model_context_limit, available_context_tokens,\n" +
"  estimated_context_tokens, included_chunk_count, excluded_chunk_count, included_document_count,\n" +
"  redundancy_removed_count, neighbors_added_count, context_build_latency_ms, context_fallback_used,\n" +
"  insufficient_context, conflict_detected, context_utilization_rate\n" +`,
      );
    }
  }
  if (code.includes('retrieval_ranked_document_ids') && !code.includes('context_utilization_rate')) {
    // VALUES append before closing
    code = code.replace(
      `"  '" + j(rankedDocumentIds) + "'::jsonb\\n" +\n  ") RETURNING`,
      `"  '" + j(rankedDocumentIds) + "'::jsonb,\\n" +
  "  " + (contextConfigVersionId ? ("'" + esc(contextConfigVersionId) + "'::uuid") : 'NULL') + ", " + (contextConfigVersion ? ("'" + esc(contextConfigVersion) + "'") : 'NULL') + ", " + (contextMode ? ("'" + esc(contextMode) + "'") : 'NULL') + ",\\n" +
  "  " + (modelContextLimit == null ? 'NULL' : String(modelContextLimit)) + ", " + (availableContextTokens == null ? 'NULL' : String(availableContextTokens)) + ",\\n" +
  "  " + (estimatedContextTokens == null ? 'NULL' : String(estimatedContextTokens)) + ", " + (includedChunkCount == null ? 'NULL' : String(includedChunkCount)) + ", " + (excludedChunkCount == null ? 'NULL' : String(excludedChunkCount)) + ", " + (includedDocumentCount == null ? 'NULL' : String(includedDocumentCount)) + ",\\n" +
  "  " + (redundancyRemovedCount == null ? 'NULL' : String(redundancyRemovedCount)) + ", " + (neighborsAddedCount == null ? 'NULL' : String(neighborsAddedCount)) + ", " + (contextBuildLatencyMs == null ? 'NULL' : String(contextBuildLatencyMs)) + ", " + (contextFallbackUsed ? 'true' : 'false') + ",\\n" +
  "  " + (insufficientContext ? 'true' : 'false') + ", " + (conflictDetected ? 'true' : 'false') + ", " + (contextUtilizationRate == null ? 'NULL' : String(contextUtilizationRate)) + "\\n" +
  ") RETURNING`,
    );
    if (!code.includes('context_utilization_rate')) {
      code = code.replace(
        `"  '" + j(rankedDocumentIds) + "'::jsonb\n" +\n  ") RETURNING`,
        `"  '" + j(rankedDocumentIds) + "'::jsonb,\n" +
  "  " + (contextConfigVersionId ? ("'" + esc(contextConfigVersionId) + "'::uuid") : 'NULL') + ", " + (contextConfigVersion ? ("'" + esc(contextConfigVersion) + "'") : 'NULL') + ", " + (contextMode ? ("'" + esc(contextMode) + "'") : 'NULL') + ",\n" +
  "  " + (modelContextLimit == null ? 'NULL' : String(modelContextLimit)) + ", " + (availableContextTokens == null ? 'NULL' : String(availableContextTokens)) + ",\n" +
  "  " + (estimatedContextTokens == null ? 'NULL' : String(estimatedContextTokens)) + ", " + (includedChunkCount == null ? 'NULL' : String(includedChunkCount)) + ", " + (excludedChunkCount == null ? 'NULL' : String(excludedChunkCount)) + ", " + (includedDocumentCount == null ? 'NULL' : String(includedDocumentCount)) + ",\n" +
  "  " + (redundancyRemovedCount == null ? 'NULL' : String(redundancyRemovedCount)) + ", " + (neighborsAddedCount == null ? 'NULL' : String(neighborsAddedCount)) + ", " + (contextBuildLatencyMs == null ? 'NULL' : String(contextBuildLatencyMs)) + ", " + (contextFallbackUsed ? 'true' : 'false') + ",\n" +
  "  " + (insufficientContext ? 'true' : 'false') + ", " + (conflictDetected ? 'true' : 'false') + ", " + (contextUtilizationRate == null ? 'NULL' : String(contextUtilizationRate)) + "\n" +
  ") RETURNING`,
      );
    }
  }
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
  console.log('Avaliar patched', {
    hasContextMeta: code.includes('contextMeta'),
    hasUtil: code.includes('context_utilization_rate'),
    hasInsertCol: code.includes('context_config_version'),
  });
}

// --- Health contextWindow ---
{
  const ID = 'qAyYc9DrHIqe4L9i';
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [ID],
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const agg = nodes.find((n) => n.name === 'Aggregate health');
  if (agg && !agg.parameters.jsCode.includes('contextWindow')) {
    const block = `contextWindow: (() => {
    return {
      status: 'up',
      activeMode: 'LEGACY',
      activeVersion: 'context-v1',
      modelName: 'gpt-4.1-mini',
      avgAvailableTokens: null,
      avgUsedTokens: null,
      avgUtilizationRate: null,
      avgIncludedChunks: null,
      avgExcludedChunks: null,
      overflowCount7d: 0,
      fallbackCount7d: 0,
      failureCount7d: 0,
      insufficientContextCount7d: 0,
      avgBuildLatencyMs: null,
      lastDatasetValidation: null,
      draftCount: 1,
    };
  })(),
  `;
    agg.parameters.jsCode = agg.parameters.jsCode.replace('retrievalPipeline:', block + 'retrievalPipeline:');
  }
  // enrich from DB if probe has context stats - optional soft SQL later
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
  console.log('health contextWindow', agg?.parameters.jsCode.includes('contextWindow'));
}

// Allowlist
{
  const { rows } = await client.query(
    `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Montar resposta admin');
  let code = n.parameters.jsCode;
  if (!code.includes("'contextWindow'")) {
    code = code.replace("'retrievalPipeline']", "'retrievalPipeline','contextWindow']");
  }
  if (!code.includes("key === 'contextWindow'")) {
    const mapping = `if (key === 'contextWindow') {
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
  }
`;
    code = code.replace('  components[key] = out;', mapping + '  components[key] = out;');
  }
  n.parameters.jsCode = code;
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='2UPHcxASp2PboC9M'`, [
    JSON.stringify(nodes),
  ]);
  if (rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='2UPHcxASp2PboC9M' AND "versionId"=$2`,
      [JSON.stringify(nodes), rows[0].activeVersionId],
    );
  }
  console.log('allowlist contextWindow', code.includes('contextWindow'));
}

await client.end();
