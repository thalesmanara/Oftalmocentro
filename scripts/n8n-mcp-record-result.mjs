#!/usr/bin/env node
/** Apply update+publish for one workflow; prints JSON result line for agent parsing. */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resultsPath = join(root, 'tmp', 'n8n-apply-results-final.json');
mkdirSync(join(root, 'tmp'), { recursive: true });

const id = process.argv[2];
const status = process.argv[3] || 'ok';
const versionId = process.argv[4] || null;
const error = process.argv[5] || null;

const queue = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-apply-queue.json'), 'utf8'));
const name = queue.find((q) => q.workflowId === id)?.name || id;
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
const entry = { workflowId: id, name, status, versionId, error, at: new Date().toISOString() };
results.push(entry);
writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify(entry));
