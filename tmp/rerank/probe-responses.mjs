#!/usr/bin/env node
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASSWORD = '12345678';

async function req(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice?.(0, 2000) };
  }
  return { status: res.status, json, text: text?.slice?.(0, 2000) };
}

const login = await req('/webhook/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
});
const token = login.json?.data?.accessToken || login.json?.data?.token;

const goodCfg = {
  mode: 'HYBRID_RERANK',
  candidateLimit: 20,
  finalLimit: 8,
  maxChunksPerDocument: 2,
  enableNeighbors: false,
  weights: { semantic: 0.45, lexical: 0.25, hybridPrior: 0.15 },
  boosts: { exactIdentifier: 0.2, titleMatch: 0.1 },
  penalties: { redundancyPerExtraChunk: 0.1 },
};

const create = await req('/webhook/system/ai-retrieval/create', {
  method: 'POST',
  token,
  body: {
    mode: 'HYBRID_RERANK',
    versionLabel: `tmp-probe-${Date.now().toString(36)}`,
    configuration: goodCfg,
    notes: 'probe',
  },
});

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const pub = await client.query(
  `SELECT id FROM ai_retrieval_config_versions WHERE version_label='hybrid-v1' AND status='PUBLISHED' LIMIT 1`,
);
const updPub = await req('/webhook/system/ai-retrieval/update', {
  method: 'PUT',
  token,
  body: {
    versionId: pub.rows[0].id,
    mode: 'HYBRID',
    configuration: {
      mode: 'HYBRID',
      candidateLimit: 20,
      finalLimit: 8,
      maxChunksPerDocument: 2,
      enableNeighbors: false,
      weights: { semantic: 0.5, lexical: 0.5 },
    },
  },
});

const dataset = await req('/webhook/system/ai-eval/run-dataset', {
  method: 'POST',
  token,
  body: { groupName: 'Planilhas', includeMissingDocs: false },
});

const out = {
  createStatus: create.status,
  createJson: create.json,
  createText: create.text,
  updPubStatus: updPub.status,
  updPubJson: updPub.json,
  updPubText: updPub.text,
  datasetStatus: dataset.status,
  datasetJson: dataset.json,
  datasetText: dataset.text,
};
writeFileSync(new URL('./_probe-responses.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4000));
await client.end();
