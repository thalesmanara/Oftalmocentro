import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const DOC_ID = '71e5029f-4881-4fe4-9dc9-048f178b1165';
const UPLOAD = `${BASE}/webhook/documents/upload`;
const dir = 'C:/Revita/Oftalmocentro/tmp/etapa13/fixtures';
fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'empty.pdf'), Buffer.alloc(0));
fs.writeFileSync(path.join(dir, 'doc.pdf.exe'), Buffer.from('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'));
fs.writeFileSync(path.join(dir, 'x.js'), Buffer.from('console.log(1)\n'));
const tinyPdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
fs.writeFileSync(path.join(dir, 'tiny.pdf'), tinyPdf);
const bigPath = path.join(dir, 'big.pdf');
if (!fs.existsSync(bigPath) || fs.statSync(bigPath).size <= 26214400) {
  const fd = fs.openSync(bigPath, 'w');
  fs.writeSync(fd, Buffer.from('%PDF-1.4\n'));
  const chunk = Buffer.alloc(1024 * 1024, 0x41);
  for (let i = 0; i < 26; i++) fs.writeSync(fd, chunk);
  fs.closeSync(fd);
}
console.log('fixtures ready', {
  empty: fs.statSync(path.join(dir, 'empty.pdf')).size,
  big: fs.statSync(bigPath).size,
  tiny: tinyPdf.length,
});

function curlJson(args) {
  const out = execFileSync('curl', ['-sS', '-w', '\n__HTTP__:%{http_code}', ...args], {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
  const m = out.match(/\n__HTTP__:(\d+)\s*$/);
  const http = m ? Number(m[1]) : null;
  const body = m ? out.slice(0, m.index) : out;
  let json = null;
  try {
    json = body ? JSON.parse(body) : null;
  } catch {
    json = { raw: body.slice(0, 600) };
  }
  return { http, json, body };
}

const login = curlJson([
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
const token = login.json?.data?.token || login.json?.data?.accessToken || login.json?.token;
console.log('login', login.http, !!token);
if (!token) {
  console.error(login.body.slice(0, 500));
  process.exit(1);
}

function upload(fileName, filePath, withAuth = true) {
  const args = [
    '-X',
    'POST',
    UPLOAD,
    '-F',
    `file0=@${filePath};filename=${fileName}`,
    '-F',
    `documentId=${DOC_ID}`,
  ];
  if (withAuth) args.push('-H', `Authorization: Bearer ${token}`);
  return curlJson(args);
}

function extractCode(json) {
  if (!json) return null;
  return (
    json?.error?.code ||
    json?.code ||
    json?.data?.code ||
    json?.validationErrorCode ||
    null
  );
}

function extractChecksum(json) {
  return (
    json?.checksum ||
    json?.data?.checksum ||
    json?.data?.data?.checksum ||
    null
  );
}

const cases = [
  {
    name: 'empty.pdf',
    file: 'empty.pdf',
    expectHttp: 400,
    expectCode: 'FILE_EMPTY',
  },
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
  {
    name: 'tiny.pdf',
    file: 'tiny.pdf',
    expectOkish: true,
  },
  {
    name: 'big.pdf',
    file: 'big.pdf',
    expectHttp: 413,
    expectCode: 'FILE_TOO_LARGE',
  },
  {
    name: 'no-auth',
    file: 'tiny.pdf',
    withAuth: false,
    expectHttp: 401,
  },
];

const results = [];
for (const c of cases) {
  console.log('\n>>>', c.name);
  const r = upload(c.file, path.join(dir, c.file), c.withAuth !== false);
  const code = extractCode(r.json);
  const statusFromBody = r.json?.statusCode ?? r.json?.error?.statusCode ?? null;
  const checksum = extractChecksum(r.json);
  let pass = false;
  let note = '';
  if (c.expectOkish) {
    const okHttp = r.http === 200 || r.http === 409 || statusFromBody === 200 || statusFromBody === 409;
    const hasChecksum = !!checksum;
    const dup = code === 'DUPLICATE_FILE';
    pass = okHttp && (hasChecksum || dup || r.json?.success === true);
    note = `checksum=${checksum || '-'} code=${code}`;
  } else if (c.expectHttp === 401) {
    pass = r.http === 401 || statusFromBody === 401 || code === 'UNAUTHORIZED';
    note = `code=${code}`;
  } else {
    const httpMatch = r.http === c.expectHttp || statusFromBody === c.expectHttp;
    const codeMatch = !c.expectCode || code === c.expectCode;
    pass = httpMatch && codeMatch;
    note = `http=${r.http} bodyStatus=${statusFromBody} code=${code}`;
  }
  const row = {
    case: c.name,
    pass,
    http: r.http,
    statusFromBody,
    code,
    checksum,
    note,
    bodySnippet: JSON.stringify(r.json)?.slice(0, 400),
  };
  results.push(row);
  console.log(pass ? 'PASS' : 'FAIL', note);
  if (!pass) console.log(row.bodySnippet);
}

const summary = {
  publishedVersionId: '4403294d-f768-4b60-821d-725d4b6c1267',
  uploadUrl: UPLOAD,
  field: 'file0',
  results,
  allPassed: results.every((r) => r.pass),
};
fs.writeFileSync(
  'C:/Revita/Oftalmocentro/tmp/etapa13/verify-results.json',
  JSON.stringify(summary, null, 2),
);
console.log('\n=== SUMMARY ===');
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.case} — ${r.note}`);
console.log('allPassed', summary.allPassed);
console.log('versionId', summary.publishedVersionId);
