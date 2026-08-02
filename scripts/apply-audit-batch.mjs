#!/usr/bin/env node
/** Apply audit instrumentation payloads - outputs workflow IDs for MCP batch apply */
import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tmp', 'audit-instrument');
const ids = JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).map((x) => x.id);
const batchSize = Number(process.argv[2] || 3);
const batchIndex = Number(process.argv[3] || 0);
const slice = ids.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
const out = slice.map((id) => JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8')));
writeFileSync(join(dir, `batch-${batchIndex}.json`), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ batchIndex, ids: slice, count: out.length }));
