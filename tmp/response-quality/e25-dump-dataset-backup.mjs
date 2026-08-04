#!/usr/bin/env node
import pg from 'pg';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

for (const id of ['12t0Ol6zWQJgAKPC', 'KdpEmEGHNlPICOa4', 'A16PhhWFr0Za9X3B']) {
  const { rows } = await c.query(`SELECT id, name, nodes FROM workflow_entity WHERE id=$1`, [id]);
  if (!rows[0]) continue;
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  console.log('\n########', rows[0].id, rows[0].name, '########');
  for (const n of nodes) {
    const blob = JSON.stringify(n.parameters || {});
    if (
      /response_quality|quality_score|ai_test_metrics|ai_response_quality|INSERT INTO ai_test/i.test(
        blob,
      ) ||
      /response_policy|Avaliar|métric|metric|backup|invent/i.test(n.name)
    ) {
      console.log('---', n.name, '---');
      const q = n.parameters?.query || n.parameters?.jsCode || blob;
      console.log(String(q).slice(0, 3200));
      console.log('...len', String(q).length);
    }
  }
}

await c.end();
