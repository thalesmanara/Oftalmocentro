#!/usr/bin/env node
import pg from 'pg'

const FIXES = {
  A3ps15dPHWoN2LZf: 'system/embeddings/reprocess',
  zBMDF4cbf7kMk7u2: 'system/qdrant/reindex',
}

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

for (const [wfId, path] of Object.entries(FIXES)) {
  const { rows } = await c.query(`SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id=$1`, [wfId])
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes)
  let changed = 0
  for (const n of nodes) {
    if (String(n.type || '').includes('webhook') && n.parameters) {
      const before = n.parameters.path
      if (before !== path) {
        n.parameters.path = path
        changed++
        console.log(wfId, 'node', n.name, before, '=>', path)
      }
    }
  }
  if (changed) {
    await c.query(`UPDATE workflow_entity SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE id=$2`, [
      JSON.stringify(nodes),
      wfId,
    ])
  }

  // history active + recent
  const hist = await c.query(
    `SELECT "versionId", nodes FROM workflow_history WHERE "workflowId"=$1 ORDER BY "updatedAt" DESC LIMIT 5`,
    [wfId],
  )
  for (const row of hist.rows) {
    const arr = typeof row.nodes === 'string' ? JSON.parse(row.nodes) : structuredClone(row.nodes)
    let hChanged = 0
    for (const n of arr) {
      if (String(n.type || '').includes('webhook') && n.parameters && n.parameters.path !== path) {
        n.parameters.path = path
        hChanged++
      }
    }
    if (hChanged) {
      await c.query(
        `UPDATE workflow_history SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
        [JSON.stringify(arr), wfId, row.versionId],
      )
      console.log('history patched', wfId, row.versionId)
    }
  }

  // Fix webhook_entity registration table
  await c.query(`DELETE FROM webhook_entity WHERE "workflowId"=$1`, [wfId])
  await c.query(
    `INSERT INTO webhook_entity ("workflowId", "webhookPath", method, node, "pathLength")
     VALUES ($1, $2, 'POST', 'Webhook', $3)
     ON CONFLICT DO NOTHING`,
    [wfId, path, path.split('/').length],
  )
  console.log('webhook_entity set', wfId, path)
}

await c.end()
console.log('done')
