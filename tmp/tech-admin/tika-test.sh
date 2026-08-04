#!/bin/sh
# Run inside n8n container
set -e
cd /home/node/files/documents
for pat in 'a2d13fce*' 'b23f6c91*' 'e4e8cf29*.pdf'; do
  f=$(ls -1 $pat 2>/dev/null | head -1)
  echo "FILE=$f"
  if [ -n "$f" ] && [ -f "$f" ]; then
    ls -la "$f"
    # busybox wget PUT via post-file trick won't work for PUT; use node
  fi
done
node <<'NODE'
const fs = require('fs');
const http = require('http');
const path = require('path');
const dir = '/home/node/files/documents';
const files = fs.readdirSync(dir).filter(f =>
  /a2d13fce|b23f6c91|e4e8cf29/.test(f) && f.endsWith('.pdf') && !f.includes('.ocr.')
);
(async () => {
  for (const f of files) {
    const full = path.join(dir, f);
    const buf = fs.readFileSync(full);
    console.log('PUT', f, 'bytes', buf.length);
    const text = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'tika', port: 9998, path: '/tika', method: 'PUT',
        headers: { 'Accept': 'text/plain', 'Content-Type': 'application/pdf', 'Content-Length': buf.length },
        timeout: 120000,
      }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
      req.write(buf);
      req.end();
    });
    console.log('  status', text.status, 'textLen', text.body.length, 'preview', JSON.stringify(text.body.slice(0, 180)));
  }
})().catch(e => { console.error(e); process.exit(1); });
NODE
