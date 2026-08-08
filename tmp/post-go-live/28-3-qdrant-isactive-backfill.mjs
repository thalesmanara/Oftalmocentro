#!/usr/bin/env node
/**
 * Etapa 28.3 — backfill Qdrant payload isActive from documents.is_active
 */
import pg from 'pg';
import { writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const N8N_CID = 'n8n-vrv8r1yp224hzobdqqcenajo';
const COLLECTION = 'oftalmocentro_chunks';
const QDRANT_URL = 'http://qdrant:6333';
const OUT = new URL('./28-3-qdrant-isactive-coverage.json', import.meta.url);

function qdrantPost(path, body) {
  const payload = JSON.stringify(body);
  const b64 = Buffer.from(payload).toString('base64');
  const nodeScript =
    "const http=require('http');const raw=Buffer.from(process.argv[2],'base64');const u=new URL(process.argv[1]);const req=http.request({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,method:'POST',headers:{'Content-Type':'application/json','Content-Length':raw.length},timeout:120000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(Buffer.concat(c).toString('utf8')));});req.on('error',e=>{console.error(String(e));process.exit(1);});req.write(raw);req.end();";
  const url = `${QDRANT_URL}${path}`;
  const cmd = `docker exec ${N8N_CID} node -e ${JSON.stringify(nodeScript)} ${JSON.stringify(url)} ${JSON.stringify(b64)}`;
  const out = execFileSync('ssh', ['oftalmocentro', cmd], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 180000,
  }).toString('utf8');
  try {
    return JSON.parse(out);
  } catch {
    throw new Error(`Qdrant response not JSON: ${out.slice(0, 400)}`);
  }
}

function qdrantGet(path) {
  const nodeScript =
    "const http=require('http');const u=new URL(process.argv[1]);http.get({hostname:u.hostname,port:u.port||80,path:u.pathname+u.search,timeout:120000},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>process.stdout.write(Buffer.concat(c).toString('utf8')));}).on('error',e=>{console.error(String(e));process.exit(1);});";
  const url = `${QDRANT_URL}${path}`;
  const cmd = `docker exec ${N8N_CID} node -e ${JSON.stringify(nodeScript)} ${JSON.stringify(url)}`;
  const out = execFileSync('ssh', ['oftalmocentro', cmd], {
    maxBuffer: 8 * 1024 * 1024,
    timeout: 180000,
  }).toString('utf8');
  return JSON.parse(out);
}

async function scrollAll() {
  const points = [];
  let offset = null;
  for (;;) {
    const body = { limit: 256, with_payload: true };
    if (offset) body.offset = offset;
    const resp = qdrantPost(`/collections/${COLLECTION}/points/scroll`, body);
    const batch = resp?.result?.points || [];
    points.push(...batch);
    offset = resp?.result?.next_page_offset;
    if (!offset || !batch.length) break;
  }
  return points;
}

const c = new pg.Client({ connectionString: PG });
await c.connect();

const { rows: docs } = await c.query(`
  SELECT id::text AS id, COALESCE(is_active, true) AS is_active
  FROM documents
  WHERE deleted_at IS NULL
  ORDER BY id
`);
console.log('documents', docs.length);

let updated = 0;
let updateErrors = 0;
for (const doc of docs) {
  const resp = qdrantPost(`/collections/${COLLECTION}/points/payload?wait=true`, {
    payload: { isActive: doc.is_active === true },
    filter: { must: [{ key: 'documentId', match: { value: doc.id } }] },
  });
  if (resp?.status === 'ok') {
    updated += 1;
    process.stdout.write(`ok ${doc.id} isActive=${doc.is_active}\n`);
  } else {
    updateErrors += 1;
    console.error('fail', doc.id, JSON.stringify(resp).slice(0, 200));
  }
}

const coll = qdrantGet(`/collections/${COLLECTION}`);
const totalPoints = Number(coll?.result?.points_count || 0);
const points = await scrollAll();

const docActive = new Map(docs.map((d) => [d.id, d.is_active === true]));
let pointsWithIsActive = 0;
let pointsWithoutIsActive = 0;
let activePoints = 0;
let inactivePoints = 0;
let orphanPoints = 0;

for (const p of points) {
  const payload = p.payload || {};
  const docId = payload.documentId ? String(payload.documentId) : null;
  const hasIsActive = Object.prototype.hasOwnProperty.call(payload, 'isActive');
  if (hasIsActive) pointsWithIsActive += 1;
  else pointsWithoutIsActive += 1;
  if (!docId || !docActive.has(docId)) {
    orphanPoints += 1;
    continue;
  }
  const active = payload.isActive !== false;
  if (active) activePoints += 1;
  else inactivePoints += 1;
}

const coverage = {
  at: new Date().toISOString(),
  collection: COLLECTION,
  documentsProcessed: docs.length,
  documentsUpdated: updated,
  updateErrors,
  totalPoints,
  scrolledPoints: points.length,
  pointsWithIsActive,
  pointsWithoutIsActive,
  activePoints,
  inactivePoints,
  orphanPoints,
  pointsWithIsActivePct:
    points.length > 0 ? Math.round((pointsWithIsActive / points.length) * 10000) / 100 : 0,
  fullCoverage: points.length > 0 && pointsWithoutIsActive === 0,
};

writeFileSync(OUT, JSON.stringify(coverage, null, 2));
console.log(JSON.stringify(coverage, null, 2));
await c.end();
