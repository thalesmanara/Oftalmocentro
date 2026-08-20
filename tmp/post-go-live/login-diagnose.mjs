import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const c = new pg.Client({ connectionString: PG });
await c.connect();

const affectedEmails = [
  'rodrigocmidia@gmail.com',
  'thalesmanara@gmail.com',
  'oftalmocentro@oftalmocentrouberaba.com.br',
  'faturamento@oftalmocentrouberaba.com.br',
  'enfermagem@oftalmocentrouberaba.com.br',
  'compras@oftalmocentrouberaba.com.br',
];

async function tryLogin(email, password) {
  const res = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => ({}));
  return {
    email,
    passwordLabel: password === 'ValDocTest#2026' ? 'TEMP_VALDOC' : password === '12345678' ? '12345678' : 'other',
    status: res.status,
    code: json?.error?.code || null,
    ok: res.status === 200 && !!json?.data?.token,
  };
}

const users = (
  await c.query(
    `SELECT id, name, email, active,
            left(password_hash, 7) AS hash_prefix,
            length(password_hash) AS hash_len,
            updated_at
     FROM users
     WHERE email = ANY($1::text[])
     ORDER BY email`,
    [affectedEmails],
  )
).rows;

const trials = [];
for (const email of affectedEmails) {
  trials.push(await tryLogin(email, 'ValDocTest#2026'));
  trials.push(await tryLogin(email, '12345678'));
}

const fails = (
  await c.query(
    `SELECT action, created_at, success, left(COALESCE(metadata::text,''), 300) AS meta
     FROM audit_logs
     WHERE created_at > NOW() - INTERVAL '24 hours'
       AND (action ILIKE '%LOGIN%' OR action ILIKE '%AUTH%')
     ORDER BY created_at DESC
     LIMIT 30`,
  )
).rows;

const out = { at: new Date().toISOString(), users, trials, fails };
writeFileSync('tmp/post-go-live/login-diagnose.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify({ users, trials: trials.filter(t=>t.ok || t.passwordLabel==='TEMP_VALDOC'), trialsAll: trials, failSample: fails.slice(0,8) }, null, 2));
await c.end();
