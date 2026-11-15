#!/usr/bin/env node
import pg from 'pg'
import { writeFileSync } from 'fs'

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

const { rows } = await c.query(`
  SELECT n->'parameters'->>'jsCode' AS js
  FROM workflow_entity w, jsonb_array_elements(w.nodes::jsonb) n
  WHERE w.id='LNrJ5VDUttKJe0Nr' AND n->>'name'='Avaliar'
`)

let js = rows[0].js
const replacements = [
  ["ocrStatus: 'NOT_APPLICABLE'", "ocrStatus: 'NOT_REQUIRED'"],
  ["ocrStatus: 'SKIPPED'", "ocrStatus: 'NOT_REQUIRED'"],
]

let count = 0
for (const [from, to] of replacements) {
  while (js.includes(from)) {
    js = js.replace(from, to)
    count++
  }
}

writeFileSync(new URL('./avaliar-fixed.js', import.meta.url), js)
console.log(JSON.stringify({
  replacements: count,
  stillBad: js.includes('NOT_APPLICABLE') || /ocrStatus:\s*'SKIPPED'/.test(js),
  length: js.length,
}))

await c.end()
