import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WF_DIR = join(__dirname, '..', 'tmp', 'n8n-workflows');
const MANIFEST = join(__dirname, '..', 'tmp', 'n8n-update-manifest.json');

const WEBHOOK_IDS = [
  'OJZNWxBCkVXaysmf', '8EXk5RkFW5cxnenL', 'ukDndCZDzemWsOMk', 'vymsco8fVdIvgW4b',
  'vNDpCzOdR7ATnHDP', 'sofpi7zCHMCJkvfI', 'Y0MuWEEdoMFts7ay', 'WLlD1eqbFmKDK9ow',
  '0ieW448wLfITZSlD', 'T6CGZB4oxlzXlTQZ', 'ZckYIZpMtw6HEtIs', 'FaSIMuXIHeiVJe29',
  '4BnWd26yROvl0Ots', '6ZZlCncPKX4fGVmI', 'WMj1pu9mllQsZk2x', 'eyRMMc4qCzGf9naj',
  'oyTndr1NgGRbbsTt', 'a7EsJH9zcj7SMEnM', 'z63rJlQKqheFBw4u', 'gCEgRsZzch3l7mfD',
  '2cfvB59nVeJ91wii', '0S1YXMDF4gHHrTbK', 'XTEYFVPc26o3loMu', 'T7nHP1laYHDqwSPm',
  'ziXSdzv5ySslNeos', '5VMmNgSU76d9gZye', 'WCwJqtFRROwoToik', 'pkQiNqpkrRgSM4Wa',
  'Oyt4aCpmjStLdYvO', 'DYWXrIK8nGvzzWJ6',
];

mkdirSync(WF_DIR, { recursive: true });

const manifest = [];

for (const id of WEBHOOK_IDS) {
  const file = join(WF_DIR, `${id}.json`);
  if (!existsSync(file)) {
    manifest.push({ id, name: null, ops: [], note: 'Workflow JSON file missing', skip: true });
    continue;
  }
  const raw = readFileSync(file, 'utf8');
  const result = JSON.parse(
    execSync(`node "${join(__dirname, 'n8n-tracking-ops.js')}" "${file}"`, { encoding: 'utf8' })
  );
  const wf = JSON.parse(raw);
  manifest.push({
    id,
    name: wf.workflow?.name || wf.name || id,
    ops: result.ops,
    note: result.note,
    opCount: result.ops.length,
    skip: result.ops.length === 0,
  });
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log(`Manifest written: ${manifest.length} workflows, ${manifest.filter((m) => !m.skip).length} with ops`);
for (const m of manifest) {
  console.log(`  ${m.id} ${m.name || '?'} ops=${m.opCount}${m.note ? ' NOTE:' + m.note : ''}`);
}
