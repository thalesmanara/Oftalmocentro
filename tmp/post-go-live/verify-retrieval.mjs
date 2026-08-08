import { readFileSync } from 'fs';

const applied = JSON.parse(
  readFileSync('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/59b27826-7a1f-442e-8d41-dcb6bc8b84c5.txt', 'utf8'),
).workflow;
const got = String(applied.nodes.find((n) => n.name === 'Buscar chunks relevantes').parameters.query);
const want = readFileSync('tmp/post-go-live/_expected-retrieval-query.txt', 'utf8');

if (got === want) {
  console.log('MATCH: applied query is byte-identical to the intended patch');
  process.exit(0);
}

console.log('MISMATCH');
console.log('got length', got.length, 'want length', want.length);
const gl = got.split('\n');
const wl = want.split('\n');
for (let i = 0; i < Math.max(gl.length, wl.length); i++) {
  if (gl[i] !== wl[i]) {
    console.log(`line ${i + 1}`);
    console.log('  got : ' + JSON.stringify(gl[i]));
    console.log('  want: ' + JSON.stringify(wl[i]));
  }
}
process.exit(1);
