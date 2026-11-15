#!/usr/bin/env node
import pg from 'pg'

const WF = 'zBMDF4cbf7kMk7u2'
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

function fixConnections(conn) {
  const obj = typeof conn === 'string' ? JSON.parse(conn) : structuredClone(conn)
  let changed = 0
  if (obj['Restaurar request']?.main?.[0]) {
    for (const link of obj['Restaurar request'].main[0]) {
      if (link.node === 'Chamar REPROCESSAR') {
        link.node = 'Chamar QDRANT - REINDEXAR'
        changed++
      }
    }
  }
  // remove bogus source if any
  if (obj['Chamar REPROCESSAR']) {
    delete obj['Chamar REPROCESSAR']
    changed++
  }
  if (obj['Chamar QDRANT - REINDEXAR']?.main?.[0]) {
    // ensure it goes to Montar resposta
    const targets = obj['Chamar QDRANT - REINDEXAR'].main[0].map((x) => x.node)
    if (!targets.includes('Montar resposta')) {
      obj['Chamar QDRANT - REINDEXAR'].main[0].push({ node: 'Montar resposta', type: 'main', index: 0 })
      changed++
    }
  } else {
    obj['Chamar QDRANT - REINDEXAR'] = {
      main: [[{ node: 'Montar resposta', type: 'main', index: 0 }]],
    }
    changed++
  }
  return { obj, changed }
}

const ent = await c.query(`SELECT connections, "activeVersionId" FROM workflow_entity WHERE id=$1`, [WF])
const p = fixConnections(ent.rows[0].connections)
await c.query(`UPDATE workflow_entity SET connections=$1::jsonb, "updatedAt"=NOW() WHERE id=$2`, [
  JSON.stringify(p.obj),
  WF,
])
console.log('entity changed', p.changed)

const hist = await c.query(
  `SELECT "versionId", connections FROM workflow_history WHERE "workflowId"=$1 ORDER BY "updatedAt" DESC LIMIT 5`,
  [WF],
)
for (const row of hist.rows) {
  const hp = fixConnections(row.connections)
  if (hp.changed) {
    await c.query(
      `UPDATE workflow_history SET connections=$1::jsonb, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
      [JSON.stringify(hp.obj), WF, row.versionId],
    )
  }
  console.log('history', row.versionId, 'changed', hp.changed)
}

await c.end()
