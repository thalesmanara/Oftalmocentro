#!/usr/bin/env node
import pg from 'pg'
import { readFileSync } from 'fs'

const js = readFileSync(new URL('./avaliar-fixed.js', import.meta.url), 'utf8')
const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
})
await c.connect()

const before = await c.query(`
  SELECT length(n->'parameters'->>'jsCode') AS len,
         (n->'parameters'->>'jsCode') LIKE '%\\\\u0000%' AS double_esc,
         (n->'parameters'->>'jsCode') ILIKE '%NOT_APPLICABLE%' AS has_bad
  FROM workflow_entity w, jsonb_array_elements(w.nodes::jsonb) n
  WHERE w.id='LNrJ5VDUttKJe0Nr' AND n->>'name'='Avaliar'
`)
console.log('before', before.rows[0])

await c.query(
  `
  UPDATE workflow_entity w
  SET nodes = (
    SELECT jsonb_agg(
      CASE
        WHEN elem->>'name' = 'Avaliar'
          THEN jsonb_set(elem, '{parameters,jsCode}', to_jsonb($1::text), true)
        ELSE elem
      END
      ORDER BY ord
    )
    FROM jsonb_array_elements(w.nodes::jsonb) WITH ORDINALITY AS t(elem, ord)
  ),
  "updatedAt" = NOW()
  WHERE w.id = 'LNrJ5VDUttKJe0Nr'
  `,
  [js],
)

// Also patch active published version if present
const ver = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='workflow_published_version'
`)
console.log('published cols', ver.rows.map((r) => r.column_name))

const hist = await c.query(`
  SELECT "versionId", "updatedAt"
  FROM workflow_history
  WHERE "workflowId"='LNrJ5VDUttKJe0Nr'
  ORDER BY "updatedAt" DESC
  LIMIT 3
`)
console.log('history', hist.rows)

// Patch latest history nodes if column exists
const histCols = await c.query(`
  SELECT column_name FROM information_schema.columns
  WHERE table_name='workflow_history' ORDER BY 1
`)
console.log(
  'history cols',
  histCols.rows.map((r) => r.column_name),
)

if (histCols.rows.some((r) => r.column_name === 'nodes')) {
  await c.query(
    `
    UPDATE workflow_history wh
    SET nodes = (
      SELECT jsonb_agg(
        CASE
          WHEN elem->>'name' = 'Avaliar'
            THEN jsonb_set(elem, '{parameters,jsCode}', to_jsonb($1::text), true)
          ELSE elem
        END
        ORDER BY ord
      )
      FROM jsonb_array_elements(wh.nodes::jsonb) WITH ORDINALITY AS t(elem, ord)
    )
    WHERE wh."workflowId"='LNrJ5VDUttKJe0Nr'
      AND wh."versionId" = (
        SELECT "activeVersionId" FROM workflow_entity WHERE id='LNrJ5VDUttKJe0Nr'
      )
    `,
    [js],
  )
  console.log('patched active history version')
}

const after = await c.query(`
  SELECT length(n->'parameters'->>'jsCode') AS len,
         (n->'parameters'->>'jsCode') LIKE '%\\\\\\\\u0000%' AS double_esc,
         (n->'parameters'->>'jsCode') LIKE '%\\\\u0000%' AS single_esc,
         (n->'parameters'->>'jsCode') ILIKE '%NOT_APPLICABLE%' AS has_bad,
         substring(n->'parameters'->>'jsCode' from position('fileExtension !==' in n->'parameters'->>'jsCode') for 140) AS snip
  FROM workflow_entity w, jsonb_array_elements(w.nodes::jsonb) n
  WHERE w.id='LNrJ5VDUttKJe0Nr' AND n->>'name'='Avaliar'
`)
console.log('after', after.rows[0])

// Sync parent file paths
const sync = await c.query(`
  UPDATE documents d
  SET file_path = v.file_path,
      file_name = COALESCE(NULLIF(d.file_name,''), v.file_path),
      file_type = COALESCE(d.file_type, v.mime_type),
      file_size = COALESCE(d.file_size, v.file_size),
      updated_at = NOW()
  FROM document_versions v
  WHERE d.current_version_id = v.id
    AND d.deleted_at IS NULL
    AND d.processing_status = 'processing'
    AND (d.file_path IS NULL OR d.file_path = '')
    AND v.file_path IS NOT NULL AND v.file_path <> ''
  RETURNING d.id
`)
console.log('synced file_path rows', sync.rowCount)

await c.end()
