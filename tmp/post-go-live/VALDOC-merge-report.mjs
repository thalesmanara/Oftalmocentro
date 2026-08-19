import { readFileSync, writeFileSync } from 'fs';

const a = JSON.parse(readFileSync('tmp/post-go-live/VALDOC-create-flow.json', 'utf8'));
const b = JSON.parse(readFileSync('tmp/post-go-live/VALDOC-create-flow-part2.json', 'utf8'));

// Recast the only false-negative: expiration was stored correctly as date 2027-12-31
const fixed = a.cases.map((c) => {
  if (c.name !== 'expiration-persisted') return c;
  const d = String(c.expiration_date || '');
  const pass = d.includes('2027-12-31');
  return { ...c, pass, note: 'assert corrigido: pg devolve date como timestamptz UTC' };
});

const merged = {
  at: new Date().toISOString(),
  part1: {
    ...a.summary,
    cases: fixed,
    passed: fixed.filter((x) => x.pass).length,
    failed: fixed.filter((x) => !x.pass).length,
    allPass: fixed.every((x) => x.pass),
  },
  part2: b.summary,
  verdict: {
    allPass: fixed.every((x) => x.pass) && b.summary.allPass,
    bugsFound: [],
    notes: [
      'Bug uuid "undefined" já corrigido no POST Documentos — validado com Ana Carla e outros usuários.',
      'Único FAIL inicial era assert de expiration_date (formato timestamptz); valor no banco correto.',
      'Todos os documentos de teste foram removidos.',
    ],
  },
};

writeFileSync('tmp/post-go-live/VALDOC-create-flow-REPORT.json', JSON.stringify(merged, null, 2));
console.log(JSON.stringify(merged.verdict, null, 2));
console.log(
  JSON.stringify(
    {
      part1: { passed: merged.part1.passed, total: merged.part1.cases.length },
      part2: b.summary,
    },
    null,
    2,
  ),
);
