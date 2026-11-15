#!/usr/bin/env node
import pg from 'pg'
import { writeFileSync } from 'fs'

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

const { rows } = await c.query(`SELECT nodes FROM workflow_entity WHERE id='vNDpCzOdR7ATnHDP'`)
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes

const interesting = nodes.filter((n) =>
  /Atualizar texto|Preparar texto|Deletar chunks|Salvar chunks|Code|OCR|Avaliar Tika|Gerar|embedding|Qdrant|chunk/i.test(
    n.name || '',
  ),
)

const summary = interesting.map((n) => ({
  name: n.name,
  type: n.type,
  id: n.id,
  query: n.parameters?.query ?? null,
  jsCode: n.parameters?.jsCode ? String(n.parameters.jsCode).slice(0, 400) : null,
  keys: Object.keys(n.parameters || {}),
}))

writeFileSync(new URL('./process-nodes-summary.json', import.meta.url), JSON.stringify(summary, null, 2))
console.log(summary.map((s) => `${s.name} | ${s.type} | keys=${s.keys.join(',')}`).join('\n'))

const atualizar = nodes.find((n) => n.name === 'Atualizar texto extraído')
writeFileSync(
  new URL('./atualizar-texto-node.json', import.meta.url),
  JSON.stringify(atualizar, null, 2),
)
console.log('\nAtualizar query type:', typeof atualizar?.parameters?.query)
console.log('Atualizar query:', atualizar?.parameters?.query)

const preparar = nodes.find((n) => n.name === 'Preparar texto extraído')
writeFileSync(
  new URL('./preparar-texto-node.json', import.meta.url),
  JSON.stringify(preparar, null, 2),
)

await c.end()
