#!/usr/bin/env node
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;

for (const n of nodes) {
  const code = n.parameters?.jsCode || '';
  if (!code) continue;
  if (/_partial|contextWindow|components\s*[:=]|secretsMatchPublished|lastValidationScore/.test(code)) {
    console.log('---', n.name, 'len', code.length);
    if (n.name !== 'Aggregate health' && n.name !== 'Prepare checks') {
      writeFileSync(new URL(`./_c212-hn-${n.name.replace(/\W+/g, '_')}.js`, import.meta.url), code);
    }
  }
}

// Show end of Aggregate where components assembled
const agg = nodes.find((n) => n.name === 'Aggregate health');
writeFileSync(new URL('./_c212-agg-full.js', import.meta.url), agg.parameters.jsCode);
const idx = agg.parameters.jsCode.lastIndexOf('components');
console.log('\nAGG tail components:\n', agg.parameters.jsCode.slice(idx, idx + 800));

// Search all for whitelist of contextWindow keys
for (const n of nodes) {
  const code = n.parameters?.jsCode || '';
  if (/activeVersion.*context-v1|draftCount/.test(code) && n.name !== 'Aggregate health') {
    console.log('whitelist candidate', n.name);
  }
}

await client.end();
