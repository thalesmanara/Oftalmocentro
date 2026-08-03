import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const DOC_ID = '71e5029f-4881-4fe4-9dc9-048f178b1165';
const dir = 'C:/Revita/Oftalmocentro/tmp/etapa13/fixtures';
fs.mkdirSync(dir, { recursive: true });

// Load trigger path from workflow details if available
const detailsPath =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/72f97f34-c8c4-42c5-a90b-cdc06869adec.txt';
const details = JSON.parse(fs.readFileSync(detailsPath, 'utf8'));
console.log('triggerInfo keys', Object.keys(details.triggerInfo || {}));
console.log(JSON.stringify(details.triggerInfo, null, 2).slice(0, 2000));

// Create fixtures
fs.writeFileSync(path.join(dir, 'empty.pdf'), Buffer.alloc(0));
fs.writeFileSync(path.join(dir, 'doc.pdf.exe'), Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'));
fs.writeFileSync(path.join(dir, 'x.js'), Buffer.from('console.log(1)\n'));
fs.writeFileSync(
  path.join(dir, 'tiny.pdf'),
  Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'),
);
const bigPath = path.join(dir, 'big.pdf');
if (!fs.existsSync(bigPath) || fs.statSync(bigPath).size < 26 * 1024 * 1024) {
  const fd = fs.openSync(bigPath, 'w');
  fs.writeSync(fd, Buffer.from('%PDF-1.4\n'));
  const chunk = Buffer.alloc(1024 * 1024, 0x41);
  for (let i = 0; i < 26; i++) fs.writeSync(fd, chunk);
  fs.closeSync(fd);
}

// Login
const loginRes = execFileSync(
  'curl',
  [
    '-sS',
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
  ],
  { encoding: 'utf8' },
);
console.log('login raw', loginRes.slice(0, 500));
const login = JSON.parse(loginRes);
const token = login?.data?.token || login?.token;
if (!token) {
  console.error('No token');
  process.exit(1);
}
console.log('token ok', token.slice(0, 20) + '...');

// Discover webhook path from trigger
const trigger = (details.workflow.nodes || []).find((n) => n.name === 'Trigger');
console.log('trigger params', JSON.stringify(trigger?.parameters, null, 2));
const webhookPath =
  trigger?.parameters?.path ||
  trigger?.webhookId ||
  'files/validar-upload';
const url = `${BASE}/webhook/${String(webhookPath).replace(/^\//, '')}`;
console.log('upload url', url);

function upload(fileName, filePath, withAuth = true) {
  const args = [
    '-sS',
    '-w',
    '\n__HTTP__:%{http_code}',
    '-X',
    'POST',
    url,
    '-F',
    `file0=@${filePath};filename=${fileName}`,
    '-F',
    `documentId=${DOC_ID}`,
  ];
  if (withAuth) {
    args.push('-H', `Authorization: Bearer ${token}`);
  }
  const out = execFileSync('curl', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const m = out.match(/\n__HTTP__:(\d+)\s*$/);
  const http = m ? Number(m[1]) : null;
  const body = m ? out.slice(0, m.index) : out;
  let json;
  try {
    json = JSON.parse(body);
  } catch {
    json = { raw: body.slice(0, 500) };
  }
  return { http, json, body: body.slice(0, 800) };
}

const cases = [
  { name: 'empty.pdf', file: 'empty.pdf', expectHttp: 400, expectCode: 'FILE_EMPTY' },
  {
    name: 'doc.pdf.exe',
    file: 'doc.pdf.exe',
    expectHttp: 400,
    expectCode: 'FILE_EXTENSION_MISMATCH',
  },
  {
    name: 'x.js',
    file: 'x.js',
    expectHttp: 400,
    expectCode: 'FILE_EXTENSION_NOT_ALLOWED',
  },
  { name: 'tiny.pdf', file: 'tiny.pdf', expectOkish: true },
  { name: 'big.pdf', file: 'big.pdf', expectHttp: 413, expectCode: 'FILE_TOO_LARGE' },
  { name: 'no-auth', file: 'tiny.pdf', withAuth: false, expectHttp: 401 },
];

const results = [];
for (const c of cases) {
  const r = upload(c.file, path.join(dir, c.file), c.withAuth !== false);
  const code = r.json?.code || r.json?.validationErrorCode || null;
  const statusCode = r.json?.statusCode ?? r.http;
  let pass = false;
  if (c.expectOkish) {
    pass =
      (r.http === 200 || statusCode === 200 || code === 'DUPLICATE_FILE' || r.json?.checksum) &&
      !!r.json?.checksum;
  } else if (c.expectHttp === 401) {
    pass = r.http === 401 || statusCode === 401 || code === 'UNAUTHORIZED' || /401|unauthorized/i.test(JSON.stringify(r.json));
  } else {
    pass =
      (r.http === c.expectHttp || statusCode === c.expectHttp) &&
      (!c.expectCode || code === c.expectCode);
  }
  results.push({
    case: c.name,
    pass,
    http: r.http,
    statusCode,
    code,
    checksum: r.json?.checksum || null,
    message: r.json?.message || null,
    snippet: r.body.slice(0, 300),
  });
  console.log(JSON.stringify(results[results.length - 1], null, 2));
}

fs.writeFileSync(
  'C:/Revita/Oftalmocentro/tmp/etapa13/verify-results.json',
  JSON.stringify({ activeVersionId: '45a95a31-6c15-49ea-ad52-0e78e6b52563', url, results }, null, 2),
);
console.log('\nSUMMARY');
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.case} http=${r.http} code=${r.code}`);
}
