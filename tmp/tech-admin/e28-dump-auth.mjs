#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync, mkdirSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
mkdirSync(new URL('./_wf', import.meta.url), { recursive: true });

const IDS = {
  login: 'Oyt4aCpmjStLdYvO',
  validateToken: 'P5E43ZXSJiI9wFYD',
  loadUser: 'FJRbZWYX2pokOa0m',
  validatePerm: 'yXW3rW8EbHXuprRJ',
  getUsers: 'pkQiNqpkrRgSM4Wa',
  postUsers: 'gCEgRsZzch3l7mfD',
  putUsers: 'z63rJlQKqheFBw4u',
  validateWh: '0S1YXMDF4gHHrTbK',
};

for (const [key, id] of Object.entries(IDS)) {
  const { rows } = await c.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
  const summary = nodes.map((n) => ({
    name: n.name,
    type: n.type,
    paramsKeys: Object.keys(n.parameters || {}),
    hasQuery: !!(n.parameters?.query || n.parameters?.jsCode),
  }));
  writeFileSync(
    new URL(`./_wf/${key}-summary.json`, import.meta.url),
    JSON.stringify(summary, null, 2),
  );

  // dump code/sql nodes with is_master or user fields
  const interesting = nodes
    .filter((n) => {
      const blob = JSON.stringify(n.parameters || {});
      return /is_master|isMaster|SELECT.*FROM users|permissions|jsCode|query/i.test(blob);
    })
    .map((n) => ({
      name: n.name,
      type: n.type,
      query: n.parameters?.query || null,
      jsCode: n.parameters?.jsCode || null,
      workflowInputs: n.parameters?.workflowInputs || null,
      values: n.parameters?.values || n.parameters?.assignments || null,
    }));
  writeFileSync(
    new URL(`./_wf/${key}-interesting.json`, import.meta.url),
    JSON.stringify(interesting, null, 2),
  );
  console.log(key, nodes.length, 'interesting', interesting.length);
}

await c.end();
