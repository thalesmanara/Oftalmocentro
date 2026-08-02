#!/usr/bin/env node
/** Save workflow get_workflow_details JSON blob to tmp/n8n-workflows/{id}.json */
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, '..', 'tmp', 'n8n-workflows');
mkdirSync(dir, { recursive: true });

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('Usage: node n8n-save-wf-file.mjs <json-file>');
  process.exit(1);
}

import { readFileSync } from 'fs';
const raw = readFileSync(fileArg, 'utf8');
const j = JSON.parse(raw);
const id = j.workflow?.id || j.id;
writeFileSync(join(dir, `${id}.json`), raw);
console.log(id);
