#!/usr/bin/env node
/** Soften versionLabel: empty allowed on validate/update; required format only when provided. */
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(`SELECT nodes, "activeVersionId" FROM workflow_entity WHERE id='NhWUkmzGhlttJC9S'`);
let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const code = nodes.find((n) => n.name === 'Validar schema');
if (!code) {
  console.log('node missing', nodes.map((n) => n.name));
  process.exit(1);
}
let js = code.parameters.jsCode;
const before = js.includes('versionLabel');
// Make empty versionLabel skip format check
if (js.includes("versionLabel") && !js.includes('if (versionLabel)')) {
  // common pattern: always validate label
  js = js.replace(
    /if\s*\(\s*!LABEL_RE\.test\(versionLabel\)\s*\)/g,
    'if (versionLabel && !LABEL_RE.test(versionLabel))',
  );
  js = js.replace(
    /if\s*\(\s*!\/\^[\\]?\[.*?\]\.test\(String\(versionLabel/g,
    'if (versionLabel && !/',
  );
}
// Broader: if we push FORMAT for empty, guard with versionLabel truthy
js = js.replace(
  /errors\.push\(\s*\{\s*field:\s*['"]versionLabel['"]/g,
  "if (versionLabel) errors.push({ field: 'versionLabel'",
);
// That might break braces — safer approach: replace the block that validates label
const marker = 'versionLabel';
if (js.includes("formato inválido")) {
  js = js.replace(
    /if\s*\([^)]*versionLabel[^)]*\)\s*\{\s*errors\.push\(\{[^}]*versionLabel[^}]*\}\);\s*\}/s,
    (m) => m.replace(/^if\s*\(/, 'if (versionLabel && ('),
  );
  // Alternative simple: only validate when non-empty
  if (!js.includes('versionLabel &&') && js.includes('formato inválido')) {
    js = js.replace(
      /(const versionLabel\s*=\s*[^;]+;)/,
      "$1\n  // empty label allowed for validate-only payloads\n",
    );
    js = js.replace(
      /(![A-Za-z_][\w.]*\.test\(\s*versionLabel\s*\))/,
      '(versionLabel && !$1)'.replace('!$1', '!'),
    );
  }
}

// Direct surgical fix based on known VALIDAR code patterns from earlier build
const snip = js.slice(0, 2500);
writeFileSync = null;

await import('fs').then(({ writeFileSync }) => {
  writeFileSync(new URL('./_validar-code-snip.js', import.meta.url), js);
});

console.log('saved snip, len', js.length, 'beforeHadLabel', before);
await client.end();
