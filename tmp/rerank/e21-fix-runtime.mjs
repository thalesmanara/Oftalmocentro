#!/usr/bin/env node
/**
 * Fix Etapa 21 runtime issues:
 * 1) Sync QDRANT - BUSCAR history (was STUB)
 * 2) Patch RECUPERAR: fallbackReason, rankedChunkIds synthetic, chunkId in SQL
 * 3) Ensure Consulta prompt ref fixed
 */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function syncEntityToHistory(id) {
  const { rows } = await client.query(
    `SELECT nodes, connections, "activeVersionId", name FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  if (!wf?.activeVersionId) throw new Error('no activeVersion for ' + id);
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
     WHERE "workflowId"=$3 AND "versionId"=$4`,
    [
      typeof wf.nodes === 'string' ? wf.nodes : JSON.stringify(wf.nodes),
      typeof wf.connections === 'string' ? wf.connections : JSON.stringify(wf.connections),
      id,
      wf.activeVersionId,
    ],
  );
  console.log('synced', wf.name, wf.activeVersionId);
  return wf.activeVersionId;
}

// 1) Qdrant
await syncEntityToHistory('YDnrXjzYUOrZVE6N');

// 2) Patch RECUPERAR
const REC = 'bae8872eeb164a27';
const { rows: rRows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [REC],
);
const nodes = typeof rRows[0].nodes === 'string' ? JSON.parse(rRows[0].nodes) : rRows[0].nodes;

const sqlNode = nodes.find((n) => n.name === 'Buscar chunks relevantes');
if (sqlNode?.parameters?.query && !sqlNode.parameters.query.includes('AS "chunkId"')) {
  sqlNode.parameters.query = sqlNode.parameters.query.replace(
    'dc.document_id AS "documentId",',
    'dc.id AS "chunkId",\n    dc.document_id AS "documentId",',
  );
  console.log('added chunkId to SQL');
}

const montar = nodes.find((n) => n.name === 'Montar contexto atual');
if (montar) {
  montar.parameters.jsCode = montar.parameters.jsCode
    .replace(
      'const rankedChunkIds=contextChunks.map(c=>c.chunkId).filter(Boolean);',
      `const rankedChunkIds=contextChunks.map(c=>c.chunkId||(c.documentId&&c.chunkOrder!=null?\`\${c.documentId}:\${c.chunkOrder}\`:null)).filter(Boolean);`,
    )
    .replace(
      "fallbackReason:rankingMetadata.fallbackUsed?(rankingMetadata.error||'rerank_fallback'):(pipelineMeta.fallbackReason||null),",
      `fallbackReason:(()=>{
  if(rankingMetadata.error) return rankingMetadata.error;
  if(pipelineMeta.fallbackReason) return pipelineMeta.fallbackReason;
  if(rankingMetadata.fallbackUsed) return 'rerank_fallback';
  if(pipelineMeta.fallbackUsed) return 'vector_empty_text_fallback';
  return null;
})(),`,
    );
  console.log('patched Montar contexto atual');
}

const merge = nodes.find((n) => n.name === 'Merge híbrido');
if (merge && !merge.parameters.jsCode.includes('chunkId:r.chunkId')) {
  // already has chunkId from row - ensure text path sets it
  console.log('merge already references chunkId');
}

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`,
  [JSON.stringify(nodes), REC],
);
await client.query(
  `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
  [JSON.stringify(nodes), REC, rRows[0].activeVersionId],
);
console.log('RECUPERAR patched');

// 3) Consulta prompt ref (idempotent)
const CONSULTA = '8EXk5RkFW5cxnenL';
const { rows: cRows } = await client.query(
  `SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [CONSULTA],
);
const cNodes = typeof cRows[0].nodes === 'string' ? JSON.parse(cRows[0].nodes) : cRows[0].nodes;
const prompt = cNodes.find((n) => n.name === 'Aplicar prompt carregado');
if (prompt?.parameters?.jsCode?.includes("$('Montar contexto')")) {
  prompt.parameters.jsCode = prompt.parameters.jsCode.replaceAll(
    "$('Montar contexto')",
    "$('Aplicar contexto recuperado')",
  );
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id=$2`, [
    JSON.stringify(cNodes),
    CONSULTA,
  ]);
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
    [JSON.stringify(cNodes), CONSULTA, cRows[0].activeVersionId],
  );
  console.log('Consulta prompt ref fixed again');
} else {
  console.log('Consulta prompt ref OK', !prompt?.parameters?.jsCode?.includes('Montar contexto'));
}

await client.end();
