#!/usr/bin/env node
/**
 * Apply one workflow via MCP payload file + record result.
 * Usage: node scripts/n8n-mcp-apply-record.mjs <workflowId> <status> [versionId] [error]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resultsPath = join(root, 'tmp', 'n8n-apply-results-final.json');
mkdirSync(join(root, 'tmp'), { recursive: true });

const [workflowId, status, versionId, error] = process.argv.slice(2);
const queue = JSON.parse(readFileSync(join(root, 'tmp', 'n8n-apply-queue.json'), 'utf8'));
const name = queue.find((q) => q.workflowId === workflowId)?.name || workflowId;
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
results.push({ workflowId, name, status, versionId: versionId || null, error: error || null, at: new Date().toISOString() });
writeFileSync(resultsPath, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ workflowId, name, status, versionId: versionId || null }));
