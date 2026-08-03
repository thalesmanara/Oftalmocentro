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
if (!n) throw new Error('Avaliar missing');

const old = `const candidatesRetrieved = retrievalMeta.candidateCount != null ? Number(retrievalMeta.candidateCount) : K;
const candidatesReranked = retrievalMeta.selectedCount != null ? Number(retrievalMeta.selectedCount) : K;
const rerankLatencyMs = retrievalMeta.durationMs != null ? Number(retrievalMeta.durationMs) : null;
const fallbackUsed = !!retrievalMeta.fallbackUsed;
const retrievalConfigVersion = retrievalMeta.versionLabel || null;
const retrievalMode = retrievalMeta.mode || null;`;

const neu = `const candidatesRetrieved = retrievalMeta.candidateCount != null ? Number(retrievalMeta.candidateCount) : (retrievalMeta.deduplicatedCount != null ? Number(retrievalMeta.deduplicatedCount) : K);
const candidatesReranked = retrievalMeta.rerankedCount != null ? Number(retrievalMeta.rerankedCount) : 0;
const finalContextCount = retrievalMeta.selectedCount != null ? Number(retrievalMeta.selectedCount) : K;
const retrievalLatencyMs = retrievalMeta.retrievalLatencyMs != null ? Number(retrievalMeta.retrievalLatencyMs) : null;
const rerankLatencyMs = retrievalMeta.rerankLatencyMs != null ? Number(retrievalMeta.rerankLatencyMs) : (retrievalMeta.durationMs != null ? Number(retrievalMeta.durationMs) : null);
const fallbackUsed = !!retrievalMeta.fallbackUsed;
const retrievalConfigVersion = retrievalMeta.configVersion || retrievalMeta.versionLabel || null;
const retrievalMode = retrievalMeta.mode || null;
const rankedChunkIds = Array.isArray(retrievalMeta.rankedChunkIds) ? retrievalMeta.rankedChunkIds.map(String) : [];`;

if (!n.parameters.jsCode.includes(old.split('\n')[0])) {
  // try softer replace pieces
  console.log('exact block not found, applying piece fixes');
}

let code = n.parameters.jsCode;
if (code.includes(old)) {
  code = code.replace(old, neu);
  console.log('replaced metrics block');
} else {
  // piece by piece
  code = code
    .replace(
      /const candidatesReranked = retrievalMeta\.selectedCount != null \? Number\(retrievalMeta\.selectedCount\) : K;/,
      'const candidatesReranked = retrievalMeta.rerankedCount != null ? Number(retrievalMeta.rerankedCount) : 0;\nconst finalContextCount = retrievalMeta.selectedCount != null ? Number(retrievalMeta.selectedCount) : K;\nconst retrievalLatencyMs = retrievalMeta.retrievalLatencyMs != null ? Number(retrievalMeta.retrievalLatencyMs) : null;',
    )
    .replace(
      /const rerankLatencyMs = retrievalMeta\.durationMs != null \? Number\(retrievalMeta\.durationMs\) : null;/,
      'const rerankLatencyMs = retrievalMeta.rerankLatencyMs != null ? Number(retrievalMeta.rerankLatencyMs) : (retrievalMeta.durationMs != null ? Number(retrievalMeta.durationMs) : null);',
    )
    .replace(
      /const retrievalConfigVersion = retrievalMeta\.versionLabel \|\| null;/,
      'const retrievalConfigVersion = retrievalMeta.configVersion || retrievalMeta.versionLabel || null;\nconst rankedChunkIds = Array.isArray(retrievalMeta.rankedChunkIds) ? retrievalMeta.rankedChunkIds.map(String) : [];',
    );
  console.log('applied piece fixes');
}

// ensure return object includes finalContextCount / retrievalLatencyMs if columns exist in insert
if (!code.includes('finalContextCount') && code.includes('candidatesReranked')) {
  code = code.replace(
    'candidatesRetrieved, candidatesReranked, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode,',
    'candidatesRetrieved, candidatesReranked, finalContextCount, retrievalLatencyMs, rerankLatencyMs, fallbackUsed, retrievalConfigVersion, retrievalMode, rankedChunkIds,',
  );
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
console.log('Avaliar updated', {
  hasFinal: code.includes('finalContextCount'),
  hasRerankCount: code.includes('rerankedCount'),
  hasConfigVersion: code.includes('configVersion'),
  hasChunkIds: code.includes('rankedChunkIds'),
});
await client.end();
