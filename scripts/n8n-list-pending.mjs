#!/usr/bin/env node
/** Print pending workflow IDs from apply queue */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const queue = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-apply-queue.json'), 'utf8'));
const pending = queue.filter((q) => q.status === 'pending');
console.log(JSON.stringify(pending.map((q) => q.workflowId)));
