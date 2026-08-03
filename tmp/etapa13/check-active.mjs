import fs from 'fs';

const p =
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/20e6ab30-945a-4a78-a157-03ffd0889de3.txt';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const wf = j.workflow;
console.log({
  versionId: wf.versionId,
  activeVersionId: wf.activeVersionId,
  active: wf.active,
  match: wf.versionId === wf.activeVersionId,
});
const draft = (wf.nodes || []).find((n) => n.name === 'Validar e normalizar');
const active = (wf.activeVersion?.nodes || []).find((n) => n.name === 'Validar e normalizar');
console.log('draft has getBinary', (draft?.parameters?.jsCode || '').includes('getBinaryDataBuffer'));
console.log('active has getBinary', (active?.parameters?.jsCode || '').includes('getBinaryDataBuffer'));
console.log('draft has metaSize', (draft?.parameters?.jsCode || '').includes('metaSize === 0'));
console.log('active has metaSize', (active?.parameters?.jsCode || '').includes('metaSize === 0'));
