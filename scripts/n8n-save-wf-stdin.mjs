#!/usr/bin/env node
/** Save get_workflow_details JSON from stdin to tmp/n8n-workflows/{id}.json */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'tmp', 'n8n-workflows');
mkdirSync(dir, { recursive: true });

const data = await new Promise((res, rej) => {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => { buf += c; });
  process.stdin.on('end', () => res(buf));
  process.stdin.on('error', rej);
});

const j = JSON.parse(data);
const id = j.workflow?.id || j.id;
if (!id) {
  console.error('No workflow id in JSON');
  process.exit(1);
}
writeFileSync(join(dir, `${id}.json`), data);
console.log(id);
