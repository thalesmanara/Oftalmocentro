import { readFileSync, writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const s = JSON.parse(readFileSync('tmp/post-go-live/28-final-smoke.json', 'utf8'));

const login = await fetch(`${BASE}/webhook/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'compras@oftalmocentrouberaba.com.br',
    password: '12345678',
  }),
}).then((r) => r.json());
const token = login.data.token;

const pubRes = await fetch(`${BASE}/webhook/system/ai-retrieval/publish`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    versionId: 'eb5779b1-b653-4679-b7ea-89b66accb279',
    reason: 'fechamento-final-auth-check',
  }),
});
const pj = await pubRes.json().catch(() => ({}));
const code = pj?.error?.code || pj?.code || '';
const chk = {
  name: 'technical-admin-required',
  ok: pubRes.status === 403 || String(code).includes('TECHNICAL_ADMIN'),
  detail: `status=${pubRes.status} code=${code}`,
};

s.checks = s.checks.map((c) => (c.name === 'technical-admin-required' ? chk : c));
s.pass = s.checks.filter((x) => x.ok).length;
s.total = s.checks.length;
s.allPass = s.checks.every((x) => x.ok);
writeFileSync('tmp/post-go-live/28-final-smoke.json', JSON.stringify(s, null, 2));
console.log(JSON.stringify({ chk, allPass: s.allPass, pass: s.pass, total: s.total }, null, 2));
