#!/usr/bin/env node
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const login = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    email: 'compras@oftalmocentrouberaba.com.br',
    password: '12345678',
  }),
});
const loginJson = await login.json();
const token = loginJson?.data?.accessToken || loginJson?.data?.token;

async function probe(label, path, method, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const headers = Object.fromEntries(res.headers.entries());
  return {
    label,
    status: res.status,
    headers,
    byteLength: buf.length,
    text: buf.toString('utf8').slice(0, 1500),
  };
}

const results = [];
results.push(
  await probe('validate', '/webhook/system/ai-retrieval/validate', 'POST', {
    mode: 'HYBRID',
    configuration: {
      candidateLimit: 10,
      finalLimit: 5,
      maxChunksPerDocument: 2,
      weights: { semantic: 0.5, lexical: 0.5 },
    },
  }),
);
results.push(
  await probe('list', '/webhook/system/ai-retrieval', 'GET'),
);
results.push(
  await probe('create', '/webhook/system/ai-retrieval/create', 'POST', {
    mode: 'HYBRID_RERANK',
    versionLabel: `tmp-c-${Date.now().toString(36)}`,
    configuration: {
      mode: 'HYBRID_RERANK',
      candidateLimit: 20,
      finalLimit: 8,
      maxChunksPerDocument: 2,
      enableNeighbors: false,
      weights: { semantic: 0.45, lexical: 0.25, hybridPrior: 0.15 },
      boosts: { exactIdentifier: 0.2 },
      penalties: { redundancyPerExtraChunk: 0.1 },
    },
  }),
);

writeFileSync(new URL('./_probe2.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
