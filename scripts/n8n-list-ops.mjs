#!/usr/bin/env node
/** Print ops JSON for MCP apply - one line per workflow: id<TAB>opsJson */
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const opsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'n8n-ops');
const ids = process.argv.slice(2);
const files = ids.length ? ids.map((id) => `${id}.json`) : readdirSync(opsDir).filter((f) => f.endsWith('.json'));

for (const f of files) {
  const data = JSON.parse(readFileSync(join(opsDir, f), 'utf8'));
  console.log(JSON.stringify({ workflowId: data.workflowId, opCount: data.operations.length }));
}
