import fs from 'fs';

const path =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/2ee19f3e-8cc1-4d61-a1c9-65442cab3359.txt';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const w = raw?.data?.workflow || raw.workflow || raw;

const want = [
  'Avaliar',
  'Avaliar texto pós-OCR',
  'Avaliar texto pós-OCR HQ',
  'Marcar OCR iniciado',
  'Persistir qualidade sucesso',
  'Marcar revisão manual pós-OCR',
  'Texto pós-OCR suficiente?',
  'É retry HQ?',
  'Auditoria qualidade avaliada',
  'Auditoria retry HQ',
];

for (const name of want) {
  const n = w.nodes.find((x) => x.name === name);
  if (!n) {
    console.log('MISSING', name);
    continue;
  }
  const p = n.parameters || {};
  console.log('\n====', name, 'id=', n.id, '====');
  console.log(String(p.query || p.jsCode || JSON.stringify(p)).slice(0, 2500));
}

// connections around Avaliar texto pós-OCR
const c = w.connections || {};
for (const src of [
  'Avaliar texto pós-OCR',
  'Texto pós-OCR suficiente?',
  'É retry HQ?',
  'Marcar retry HQ',
  'Avaliar texto pós-OCR HQ',
  'Persistir qualidade sucesso',
]) {
  console.log('\nCONN from', src, '=>', JSON.stringify(c[src]?.main || []).slice(0, 800));
}
