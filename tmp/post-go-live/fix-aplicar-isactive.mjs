import { readFileSync, writeFileSync } from 'fs';

const raw = readFileSync(
  'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/0070322e-b5b0-4dee-bbb0-a7220ab40f3f.txt',
  'utf8',
);
const w = JSON.parse(raw);
const n = w.workflow.nodes.find((x) => x.name === 'Aplicar isActive');
const q = n.parameters.query;
const needle = 'COALESCE(d.is_active, TRUE) AS "isActive"';
const replacement =
  'CASE WHEN i.is_active_provided THEN i.new_is_active ELSE COALESCE(d.is_active, TRUE) END AS "isActive"';
if (!q.includes(needle)) {
  console.error('needle not found');
  process.exit(1);
}
const fixed = q.replace(needle, replacement);
writeFileSync('tmp/post-go-live/aplicar-isactive-fixed.txt', fixed);
console.log('ok', fixed.length);
