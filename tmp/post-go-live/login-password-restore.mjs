import pg from 'pg';
import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const NEW_PASS = '12345678';

const emails = [
  'rodrigocmidia@gmail.com',
  'thalesmanara@gmail.com',
  'oftalmocentro@oftalmocentrouberaba.com.br',
  'faturamento@oftalmocentrouberaba.com.br',
  'enfermagem@oftalmocentrouberaba.com.br',
  'compras@oftalmocentrouberaba.com.br',
];

const c = new pg.Client({ connectionString: PG });
await c.connect();

const updated = (
  await c.query(
    `UPDATE users
     SET password_hash = crypt($2, gen_salt('bf')),
         updated_at = NOW()
     WHERE email = ANY($1::text[])
     RETURNING id, name, email`,
    [emails, NEW_PASS],
  )
).rows;

const checks = [];
for (const u of updated) {
  const res = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: NEW_PASS }),
  });
  const json = await res.json().catch(() => ({}));
  checks.push({
    email: u.email,
    name: u.name,
    loginOk: res.status === 200 && !!json?.data?.token,
    status: res.status,
  });
}

const out = {
  at: new Date().toISOString(),
  passwordSetTo: NEW_PASS,
  updated,
  checks,
  allLoginOk: checks.every((x) => x.loginOk),
};
writeFileSync('tmp/post-go-live/login-password-restore.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await c.end();
