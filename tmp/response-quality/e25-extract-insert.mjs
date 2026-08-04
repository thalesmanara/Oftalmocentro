#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

{
  const { rows } = await c.query(
    `SELECT nodes FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  writeFileSync(
    new URL('./_e25-avaliar-insert.js', import.meta.url),
    n.parameters.jsCode,
  );
  console.log('avaliar len', n.parameters.jsCode.length);
  // find quality / policy mentions
  const code = n.parameters.jsCode;
  for (const k of [
    'quality_score',
    'response_quality',
    'policyMeta',
    'response_policy',
    'INSERT INTO ai_test_results',
  ]) {
    console.log(k, code.includes(k), code.indexOf(k));
  }
}

{
  const { rows } = await c.query(
    `SELECT nodes FROM workflow_entity WHERE id='1uITQcJ5jSNXErOM'`,
  );
  if (rows[0]) {
    const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
    console.log(
      'metrics nodes',
      nodes.map((n) => n.name),
    );
    for (const n of nodes) {
      const q = n.parameters?.query || n.parameters?.jsCode || '';
      if (/INSERT INTO ai_test_metrics|quality_score|response_quality/i.test(String(q))) {
        writeFileSync(
          new URL(`./_e25-metrics-${n.name.replace(/\s+/g, '_')}.txt`, import.meta.url),
          String(q),
        );
        console.log('wrote metrics', n.name, String(q).length);
      }
    }
  } else console.log('metrics WF missing');
}

// backup has quality tables?
{
  const { rows } = await c.query(
    `SELECT nodes::text AS n FROM workflow_entity WHERE id='A16PhhWFr0Za9X3B'`,
  );
  console.log(
    'backup has ai_response_quality_configs',
    rows[0].n.includes('ai_response_quality_configs'),
  );
  console.log(
    'backup has ai_cache_configs',
    rows[0].n.includes('ai_cache_configs'),
  );
}

await c.end();
