#!/usr/bin/env node
import pg from 'pg';
import zlib from 'zlib';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const execId = 11043; // longer one
const data = await client.query(`SELECT data FROM execution_data WHERE "executionId"=$1`, [
  String(execId),
]);
const raw = data.rows[0].data;
console.log('typeof', typeof raw, Array.isArray(raw), raw?.constructor?.name);

function tryDecode(raw) {
  if (Buffer.isBuffer(raw)) {
    try {
      return zlib.gunzipSync(raw).toString('utf8');
    } catch {
      return raw.toString('utf8');
    }
  }
  if (typeof raw === 'string') {
    // maybe base64 gzip
    try {
      const buf = Buffer.from(raw, 'base64');
      return zlib.gunzipSync(buf).toString('utf8');
    } catch {
      return raw;
    }
  }
  if (raw && typeof raw === 'object') {
    // n8n format: { data: "gzip base64" } or nested
    if (raw.data) return tryDecode(raw.data);
    return JSON.stringify(raw);
  }
  return String(raw);
}

const s = tryDecode(raw);
console.log('decoded len', s.length);
console.log(s.slice(0, 500));

// Find last node errors
const errors = [...s.matchAll(/"error"\s*:\s*\{[^}]{0,800}/g)].slice(0, 10);
console.log('errors', errors.map((e) => e[0].slice(0, 400)));

const msgs = [...s.matchAll(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/g)]
  .map((m) => m[1])
  .filter((m) => /error|fail|column|syntax|null|undefined|is not/i.test(m));
console.log('filtered msgs', [...new Set(msgs)].slice(0, 20));

// Look for Avaliar / Inserir result node names near errors
for (const needle of ['Avaliar', 'Inserir resultado', 'INSERT INTO ai_test_results', 'conflict_type', 'relevant_context']) {
  const i = s.indexOf(needle);
  console.log(needle, i);
  if (i >= 0) console.log(s.slice(i, i + 300));
}

await client.end();
