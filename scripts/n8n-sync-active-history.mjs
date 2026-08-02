#!/usr/bin/env node
/** Copy draft nodes from workflow_entity into active workflow_history row */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const IDS = [
  'WCwJqtFRROwoToik', 'XTEYFVPc26o3loMu', 'OJZNWxBCkVXaysmf', 'sofpi7zCHMCJkvfI',
  'ukDndCZDzemWsOMk', 'vNDpCzOdR7ATnHDP', 'vymsco8fVdIvgW4b', 'gCEgRsZzch3l7mfD',
  'jtQvQlqRZ5X5WF9I', 'TBxcSoSPwcMUZQ6m', 'dDpiJOVqncw14Wtf',
  // Document mutation workflows (audit instrumentation)
  'WLlD1eqbFmKDK9ow', 'Y0MuWEEdoMFts7ay', '8EXk5RkFW5cxnenL',
  // User/sector/category/settings mutation workflows (audit instrumentation)
  'z63rJlQKqheFBw4u', 'a7EsJH9zcj7SMEnM', 'oyTndr1NgGRbbsTt', 'eyRMMc4qCzGf9naj',
  'WMj1pu9mllQsZk2x', '6ZZlCncPKX4fGVmI', '4BnWd26yROvl0Ots', 'FaSIMuXIHeiVJe29',
  'ZckYIZpMtw6HEtIs', 'T6CGZB4oxlzXlTQZ', '0ieW448wLfITZSlD',
  // Health checks (etapa 10)
  'qAyYc9DrHIqe4L9i', 'eov4wXax0YMySu8E', '2UPHcxASp2PboC9M',
];
const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

const results = [];
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  const res = await client.query(
    `UPDATE workflow_history SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW()
     WHERE "workflowId" = $3 AND "versionId" = $4`,
    [JSON.stringify(row.nodes), JSON.stringify(row.connections), id, row.activeVersionId]
  );
  results.push({ id, name: row.name, activeVersionId: row.activeVersionId, historyRowsUpdated: res.rowCount });
  console.log(`SYNC history ${row.name} (${id}) v=${row.activeVersionId}`);
}
await client.end();
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-sync-history-results.json'), JSON.stringify(results, null, 2));
