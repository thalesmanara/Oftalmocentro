#!/usr/bin/env node
import pg from 'pg'
import { readFileSync } from 'fs'

const js = readFileSync(new URL('./avaliar-fixed.js', import.meta.url), 'utf8')
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

async function patchNodesJson(nodes) {
  const arr = typeof nodes === 'string' ? JSON.parse(nodes) : nodes
  let changed = 0
  for (const n of arr) {
    if (n?.name === 'Avaliar' && n?.parameters?.jsCode) {
      if (n.parameters.jsCode !== js) {
        n.parameters.jsCode = js
        changed++
      }
    }
  }
  return { nodes: arr, changed }
}

const ent = await c.query(`SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='LNrJ5VDUttKJe0Nr'`)
const patchedEnt = await patchNodesJson(ent.rows[0].nodes)
await c.query(`UPDATE workflow_entity SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE id='LNrJ5VDUttKJe0Nr'`, [
  JSON.stringify(patchedEnt.nodes),
])
console.log('entity changed', patchedEnt.changed, 'activeVersionId', ent.rows[0].activeVersionId)

const hist = await c.query(
  `SELECT "versionId", nodes FROM workflow_history WHERE "workflowId"='LNrJ5VDUttKJe0Nr' ORDER BY "updatedAt" DESC LIMIT 5`,
)
for (const row of hist.rows) {
  const p = await patchNodesJson(row.nodes)
  if (p.changed) {
    await c.query(
      `UPDATE workflow_history SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE "workflowId"='LNrJ5VDUttKJe0Nr' AND "versionId"=$2`,
      [JSON.stringify(p.nodes), row.versionId],
    )
  }
  const check = p.nodes.find((n) => n.name === 'Avaliar')
  console.log({
    versionId: row.versionId,
    changed: p.changed,
    hasBad: String(check?.parameters?.jsCode || '').includes('NOT_APPLICABLE'),
    doubleEsc: String(check?.parameters?.jsCode || '').includes('\\\\u0000'),
    len: check?.parameters?.jsCode?.length,
  })
}

await c.end()
