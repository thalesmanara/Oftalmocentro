#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT connections, nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const connections = typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const names = new Set(nodes.map((n) => n.name));
const dangling = [];
for (const [from, ports] of Object.entries(connections)) {
  if (!names.has(from)) dangling.push(['from', from]);
  for (const mains of ports.main || []) {
    for (const link of mains || []) {
      if (!names.has(link.node)) dangling.push(['to', from, link.node]);
    }
  }
}
writeFileSync(new URL('./_health-conn.json', import.meta.url), JSON.stringify({ connections, dangling, names: [...names] }, null, 2));
console.log('dangling', dangling);

// Patch GET health allowlist to include retrieval
const g = await client.query(`SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`);
const gnodes = typeof g.rows[0].nodes === 'string' ? JSON.parse(g.rows[0].nodes) : g.rows[0].nodes;
let changed = false;
for (const n of gnodes) {
  if (n.parameters?.jsCode?.includes("allowedCompKeys") && !n.parameters.jsCode.includes("'retrieval'")) {
    n.parameters.jsCode = n.parameters.jsCode.replace(
      "'qdrant']",
      "'qdrant','retrieval']",
    );
    // add retrieval field mapping
    if (!n.parameters.jsCode.includes("key === 'retrieval'")) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        "if (key === 'qdrant') {",
        `if (key === 'retrieval') {
    out.mode = c.mode || null;
    out.activeVersion = c.activeVersion || null;
    out.draftsCount = Number(c.draftsCount || 0) || 0;
    out.avgDurationMs = c.avgDurationMs != null ? Number(c.avgDurationMs) : null;
    out.failures = Number(c.failures || 0) || 0;
    out.online = c.online !== false;
    if (c.lastRunAt) out.lastRunAt = c.lastRunAt;
  }
  if (key === 'qdrant') {`,
      );
    }
    changed = true;
  }
}
if (changed) {
  await client.query(`UPDATE workflow_entity SET nodes=$1::json, "updatedAt"=NOW() WHERE id='2UPHcxASp2PboC9M'`, [
    JSON.stringify(gnodes),
  ]);
  if (g.rows[0].activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, "updatedAt"=NOW() WHERE "workflowId"='2UPHcxASp2PboC9M' AND "versionId"=$2`,
      [JSON.stringify(gnodes), g.rows[0].activeVersionId],
    );
  }
  console.log('patched GET health allowlist');
}

// Also check Executar health check response handling for empty fallback
const execNode = gnodes.find((n) => n.name === 'Executar health check' || n.name.includes('health check'));
console.log('exec node', execNode?.name, execNode?.parameters?.workflowId);

await client.end();
