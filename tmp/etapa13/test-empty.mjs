import { execFileSync } from 'child_process';
import fs from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const DOC_ID = '71e5029f-4881-4fe4-9dc9-048f178b1165';

function curl(args) {
  const out = execFileSync('curl.exe', ['-sS', '-w', '\n__HTTP__:%{http_code}', ...args], {
    encoding: 'utf8',
  });
  const m = out.match(/\n__HTTP__:(\d+)\s*$/);
  return { http: m ? Number(m[1]) : null, body: m ? out.slice(0, m.index) : out };
}

const login = curl([
  '-X',
  'POST',
  `${BASE}/webhook/auth/login`,
  '-H',
  'Content-Type: application/json',
  '-d',
  JSON.stringify({
    email: 'compras@oftalmocentrouberaba.com.br',
    password: '12345678',
  }),
]);
const token = JSON.parse(login.body).data.token;
console.log('login', login.http);

const emptyPath = 'C:/Revita/Oftalmocentro/tmp/etapa13/fixtures/empty.pdf';
fs.writeFileSync(emptyPath, Buffer.alloc(0));

for (const field of ['file0', 'file']) {
  const r = curl([
    '-X',
    'POST',
    `${BASE}/webhook/documents/upload`,
    '-H',
    `Authorization: Bearer ${token}`,
    '-F',
    `${field}=@${emptyPath};filename=empty.pdf;type=application/pdf`,
    '-F',
    `documentId=${DOC_ID}`,
  ]);
  console.log(field, r.http, r.body.slice(0, 400));
}
