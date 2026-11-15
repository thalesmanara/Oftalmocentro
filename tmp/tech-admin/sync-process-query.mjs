#!/usr/bin/env node
import pg from 'pg'
import { readFileSync } from 'fs'

const FIXED = readFileSync(new URL('./atualizar-query-fixed.txt', import.meta.url), 'utf8').trimEnd()
const WF = 'vNDpCzOdR7ATnHDP'
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

function patch(nodes) {
  const arr = typeof nodes === 'string' ? JSON.parse(nodes) : structuredClone(nodes)
  let changed = 0
  for (const n of arr) {
    if (n.name === 'Atualizar texto extraído' && n.parameters?.query !== FIXED) {
      n.parameters.query = FIXED
      changed++
    }
  }
  return { arr, changed }
}

const ent = await c.query(`SELECT nodes, "activeVersionId", "versionId" FROM workflow_entity WHERE id=$1`, [WF])
const p = patch(ent.rows[0].nodes)
await c.query(`UPDATE workflow_entity SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE id=$2`, [
  JSON.stringify(p.arr),
  WF,
])
console.log('entity', {
  changed: p.changed,
  activeVersionId: ent.rows[0].activeVersionId,
  versionId: ent.rows[0].versionId,
})

const hist = await c.query(
  `SELECT "versionId", nodes FROM workflow_history WHERE "workflowId"=$1 ORDER BY "updatedAt" DESC LIMIT 8`,
  [WF],
)
for (const row of hist.rows) {
  const hp = patch(row.nodes)
  if (hp.changed) {
    await c.query(
      `UPDATE workflow_history SET nodes=$1::jsonb, "updatedAt"=NOW() WHERE "workflowId"=$2 AND "versionId"=$3`,
      [JSON.stringify(hp.arr), WF, row.versionId],
    )
  }
  const q = hp.arr.find((n) => n.name === 'Atualizar texto extraído')?.parameters?.query || ''
  console.log({
    versionId: row.versionId,
    changed: hp.changed,
    hasBufferGuard: q.includes('typeof Buffer'),
    hasB64Fallback: q.includes('encodeURIComponent'),
  })
}

await c.end()
