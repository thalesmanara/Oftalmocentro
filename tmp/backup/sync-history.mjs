import pg from 'pg'

const IDS = [
  '3YpzoNlVOe1DQIEn',
  'A16PhhWFr0Za9X3B',
  'EGqLTHIdFAgoOGFO',
  '4tQeihbOEv2qORFu',
  'ZsgGgMEPSQadSjv8',
  'P0tGkG6OZInMYO2g',
  'mlHyK7pgjpB073nL',
  'Ixvg9Dcqo8MnONq3',
  'qAyYc9DrHIqe4L9i',
]

const client = new pg.Client({
  connectionString:
    process.env.PGURL ||
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await client.connect()
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id = $1`,
    [id],
  )
  const row = rows[0]
  if (!row) {
    console.log('MISSING', id)
    continue
  }
  const res = await client.query(
    `UPDATE workflow_history SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW()
     WHERE "workflowId" = $3 AND "versionId" = $4`,
    [JSON.stringify(row.nodes), JSON.stringify(row.connections), id, row.activeVersionId],
  )
  console.log(`SYNC ${row.name} (${id}) rows=${res.rowCount}`)
}
await client.end()
