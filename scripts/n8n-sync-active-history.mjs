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
  // Backup (etapa 11)
  '3YpzoNlVOe1DQIEn', 'A16PhhWFr0Za9X3B', 'EGqLTHIdFAgoOGFO', '4tQeihbOEv2qORFu',
  'ZsgGgMEPSQadSjv8', 'P0tGkG6OZInMYO2g', 'mlHyK7pgjpB073nL', 'Ixvg9Dcqo8MnONq3',
  // Document versioning (etapa 12)
  'rHDMICvU4BPvduhf', '34CCXomZXldQ9vJR', 'zWxaHmq8RYOCdTag', 'BP5ofN6BV3l3mryJ',
  // File validation (etapa 13)
  'xSEbtkxFXCxlHO2s',
  // OCR corporativo (etapa 14)
  'LNrJ5VDUttKJe0Nr', 'QFZ2PRTlGV7umesd',
  // Tabular / spreadsheets (etapa 15)
  'WWVUnGLC3Ot1vh4x', 'S3xcC9hndv750kOa',
  // AI Eval (etapa 16)
  'KdpEmEGHNlPICOa4', '1uITQcJ5jSNXErOM', 'DoaDLe6P5BtJhDXb', '12t0Ol6zWQJgAKPC',
  'MTRkT5PyJUwbMwl7', 'RKhoSMKPfqdxrGNI', 'aL2tTx9V4zFJUfPx', 'jqISJzbOGRjArLbz',
  'qVH5qtBf8IY32uiH', 'wTH2YV6pIlhzWDiY',
  // AI Prompt governance (etapa 17)
  'OSopSf635RVwD65J', 'HT0aD7hn73HybpFT', 'L8FL9uMkcqiVpskV', 'dziymkwKvfYJmBUp', 'YvAfAD0LSYFEqCqp',
  'CkX6dJ0bYtow2nU6', 'gXQKbCaCpXSoIq08',
  'q9U9E1gz8LbjrbBE', 'JZxiFaHPoH8Sn2M0', '1dNNsNKevnH6RRiR', 'sHlvvNBw1uTCtS3P', 'lWMX8ESUgPOuPd8T', '57LavvypSSuZvoHb',
  'qAyYc9DrHIqe4L9i', '2UPHcxASp2PboC9M', 'A16PhhWFr0Za9X3B', '8EXk5RkFW5cxnenL',
  // Embeddings corporativos (etapa 18)
  'D1bbCBEdKuNQc9F5', 'Feli8ssd2KggST6N', 'LJQZ2HrG6qJGN0Q2', 'x4bw9IQ5vwJSFh0y',
  '3BkmtrasXs1lORtL', 'HympisbYzMo0mQYP', 'A3ps15dPHWoN2LZf',
  'vNDpCzOdR7ATnHDP', 'qAyYc9DrHIqe4L9i', '2UPHcxASp2PboC9M', 'A16PhhWFr0Za9X3B', '12t0Ol6zWQJgAKPC',
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
