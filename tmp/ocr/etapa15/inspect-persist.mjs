import fs from 'fs';

const path =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/2ee19f3e-8cc1-4d61-a1c9-65442cab3359.txt';
const raw = JSON.parse(fs.readFileSync(path, 'utf8'));
const w = raw?.data?.workflow || raw.workflow || raw;

for (const n of w.nodes) {
  if (!/qualidade|HQ|MANUAL|falha|Persistir|Atualizar vers|Auditoria/i.test(n.name)) continue;
  const p = n.parameters || {};
  const q = p.query || p.jsCode || '';
  console.log('====', n.name, n.type, '====');
  console.log(String(q || JSON.stringify(p)).slice(0, 1200));
  console.log('');
}
