import { writeFileSync } from 'fs';
import crypto from 'crypto';
import pg from 'pg';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
const { rows } = await client.query(
  `SELECT n->'parameters'->>'jsCode' AS code
     FROM workflow_entity w, LATERAL jsonb_array_elements(w.nodes::jsonb) n
    WHERE w.id='NhWUkmzGhlttJC9S' AND n->>'name'='Validar'`,
);
await client.end();
const original = rows[0].code;

const OLD_ALLOWED =
  "const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes']);";
const NEW_ALLOWED =
  "const ALLOWED_ROOT=new Set(['mode','candidateLimit','finalLimit','maxChunksPerDocument','enableNeighbors','weights','boosts','penalties','normalization','notes','lexicalExpansion']);";

const OLD_TAIL = `  notes: typeof body.notes==='string'?body.notes.slice(0,500):'',
};
const crypto=require('crypto');`;

const NEW_TAIL = `  notes: typeof body.notes==='string'?body.notes.slice(0,500):'',
};
if(lexicalExpansion!==null) normalized.lexicalExpansion=lexicalExpansion;
const crypto=require('crypto');`;

// Validation block inserted right before the versionLabel format check.
const OLD_ANCHOR = `if(versionLabel!=null){
  const vl=versionLabel.trim();`;

const NEW_ANCHOR = `let lexicalExpansion=null;
if(body.lexicalExpansion!==undefined && body.lexicalExpansion!==null && body.lexicalExpansion!==''){
  const lx=body.lexicalExpansion;
  if(typeof lx!=='object' || Array.isArray(lx)){ err('lexicalExpansion','deve ser objeto JSON','TYPE'); }
  else{
    const ALLOWED_LX=new Set(['enabled','maxSynonymsPerTerm','dictionary']);
    for(const k of Object.keys(lx)){ if(!ALLOWED_LX.has(k)) err('lexicalExpansion.'+k,'campo desconhecido','UNKNOWN_FIELD'); }
    const lxEnabled=bool(lx.enabled,'lexicalExpansion.enabled');
    let maxSyn=int(lx.maxSynonymsPerTerm,'lexicalExpansion.maxSynonymsPerTerm');
    if(maxSyn!=null && (maxSyn<1||maxSyn>10)) err('lexicalExpansion.maxSynonymsPerTerm','faixa 1..10','RANGE');
    if(maxSyn==null||Number.isNaN(maxSyn)) maxSyn=4;
    const dictRaw=lx.dictionary;
    const dict={};
    if(dictRaw!==undefined && dictRaw!==null){
      if(typeof dictRaw!=='object' || Array.isArray(dictRaw)) err('lexicalExpansion.dictionary','deve ser objeto termo->sinônimos','TYPE');
      else{
        const entries=Object.entries(dictRaw);
        if(entries.length>500) err('lexicalExpansion.dictionary','máximo 500 termos','RANGE');
        for(const [term,syns] of entries){
          const t=String(term).trim().toLowerCase();
          if(!t || t.length>64){ err('lexicalExpansion.dictionary.'+term,'termo inválido (1..64 chars)','FORMAT'); continue; }
          if(!Array.isArray(syns)){ err('lexicalExpansion.dictionary.'+term,'sinônimos devem ser array de strings','TYPE'); continue; }
          const list=[];
          for(const s of syns){
            if(typeof s!=='string' || !s.trim() || s.length>64){ err('lexicalExpansion.dictionary.'+term,'sinônimo inválido (string 1..64 chars)','FORMAT'); continue; }
            list.push(s.trim());
          }
          if(list.length>maxSyn) warnings.push({field:'lexicalExpansion.dictionary.'+t,message:'mais sinônimos que maxSynonymsPerTerm; excedentes serão ignorados na expansão',code:'TRUNCATED'});
          dict[t]=list;
        }
      }
    }
    if(lxEnabled && Object.keys(dict).length===0) err('lexicalExpansion.dictionary','obrigatório quando enabled=true','REQUIRED');
    lexicalExpansion={enabled:lxEnabled, maxSynonymsPerTerm:maxSyn, dictionary:dict};
  }
}
if(versionLabel!=null){
  const vl=versionLabel.trim();`;

let patched = original;
for (const [oldStr, newStr] of [
  [OLD_ALLOWED, NEW_ALLOWED],
  [OLD_ANCHOR, NEW_ANCHOR],
  [OLD_TAIL, NEW_TAIL],
]) {
  const count = patched.split(oldStr).length - 1;
  if (count !== 1) throw new Error(`anchor not unique (${count}): ${oldStr.slice(0, 60)}`);
  patched = patched.replace(oldStr, newStr);
}

writeFileSync(new URL('./validator-patched.js', import.meta.url), patched);

// --- Behavioural comparison: original vs patched --------------------------------
function run(code, input) {
  const fn = new Function(
    '$input',
    'require',
    `${code.replace(/^const t=\$input\.first\(\)\.json\|\|\{\};/, 'const t=$input.first().json||{};')}`,
  );
  return fn({ first: () => ({ json: input }) }, (m) => (m === 'crypto' ? crypto : null))[0].json;
}

const hybridV1 = {
  mode: 'HYBRID',
  notes: 'Produção atual — ranking híbrido sem re-ranking avançado',
  boosts: {
    ocrGood: 0.03,
    isCurrent: 0.05,
    titleMatch: 0.08,
    categoryMatch: 0.1,
    recentVigency: 0.04,
    exactIdentifier: 0.2,
    subcategoryMatch: 0.15,
    tabularStructure: 0.08,
  },
  weights: { lexical: 0.35, semantic: 0.65 },
  penalties: { staleDocument: 0.05, redundancyPerExtraChunk: 0.06 },
  finalLimit: 12,
  normalization: { text: 'batchMax', hybrid: 'passthrough', vector: 'clip01' },
  candidateLimit: 30,
  enableNeighbors: false,
  maxChunksPerDocument: 4,
};

const cases = {
  'hybrid-v1 (no lexicalExpansion)': hybridV1,
  'hybrid-rerank-v1 shape': {
    mode: 'HYBRID_RERANK',
    weights: { lexical: 0.25, semantic: 0.45, hybridPrior: 0.15 },
    boosts: { titleMatch: 0.1 },
    penalties: { staleDocument: 0.06 },
    finalLimit: 8,
    candidateLimit: 30,
    enableNeighbors: false,
    maxChunksPerDocument: 2,
    normalization: { text: 'batchMax', hybrid: 'batchMinMax', vector: 'clip01' },
    notes: '',
  },
  'invalid: finalLimit > candidateLimit': { ...hybridV1, finalLimit: 20, candidateLimit: 10 },
};

let regressions = 0;
for (const [name, cfg] of Object.entries(cases)) {
  const a = run(original, { mode: cfg.mode, configurationJson: JSON.stringify(cfg) });
  const b = run(patched, { mode: cfg.mode, configurationJson: JSON.stringify(cfg) });
  const same =
    a.contentHash === b.contentHash &&
    JSON.stringify(a.errors) === JSON.stringify(b.errors) &&
    a.ok === b.ok &&
    a.configurationJson === b.configurationJson;
  console.log(`${same ? 'SAME ' : 'DIFF '} ${name} (ok=${a.ok}, hash=${a.contentHash.slice(0, 12)})`);
  if (!same) {
    regressions++;
    console.log('  before:', JSON.stringify(a).slice(0, 400));
    console.log('  after :', JSON.stringify(b).slice(0, 400));
  }
}

const v2 = {
  ...hybridV1,
  notes: 'Candidato hybrid-v2 — hybrid-v1 + expansão léxica por sinônimos (DRAFT, requer A/B antes de publicar)',
  lexicalExpansion: {
    enabled: true,
    maxSynonymsPerTerm: 4,
    dictionary: {
      equipamento: ['máquina', 'aparelho'],
      máquina: ['equipamento', 'aparelho'],
      aparelho: ['equipamento', 'máquina'],
      funcionário: ['colaborador', 'empregado'],
      colaborador: ['funcionário', 'empregado'],
      comprar: ['adquirir', 'aquisição'],
      adquirir: ['comprar', 'aquisição'],
      manutenção: ['reparo', 'conserto'],
      reparo: ['manutenção', 'conserto'],
      conserto: ['manutenção', 'reparo'],
      remarcar: ['reagendar', 'alterar agendamento'],
      reagendar: ['remarcar', 'alterar agendamento'],
    },
  },
};

const oldV2 = run(original, { mode: 'HYBRID', configurationJson: JSON.stringify(v2) });
const newV2 = run(patched, { mode: 'HYBRID', configurationJson: JSON.stringify(v2) });
console.log('\nhybrid-v2 on ORIGINAL validator: ok=%s errors=%s', oldV2.ok, JSON.stringify(oldV2.errors));
console.log('hybrid-v2 on PATCHED validator : ok=%s hash=%s', newV2.ok, newV2.contentHash);
console.log('hybrid-v2 normalized keys:', Object.keys(newV2.normalized).join(','));

const badCases = {
  'dictionary as array': { ...v2, lexicalExpansion: { enabled: true, dictionary: ['a'] } },
  'enabled without dictionary': { ...v2, lexicalExpansion: { enabled: true, dictionary: {} } },
  'maxSynonymsPerTerm out of range': { ...v2, lexicalExpansion: { ...v2.lexicalExpansion, maxSynonymsPerTerm: 99 } },
  'unknown subkey': { ...v2, lexicalExpansion: { ...v2.lexicalExpansion, sqlInject: 1 } },
};
console.log('\nreject cases:');
for (const [name, cfg] of Object.entries(badCases)) {
  const r = run(patched, { mode: 'HYBRID', configurationJson: JSON.stringify(cfg) });
  console.log(`  ${r.ok ? 'NOT REJECTED ' : 'rejected'} ${name}: ${JSON.stringify(r.errors)}`);
  if (r.ok) regressions++;
}

console.log(regressions === 0 ? '\nOK: no regressions' : `\nREGRESSIONS: ${regressions}`);
process.exit(regressions === 0 ? 0 : 1);
