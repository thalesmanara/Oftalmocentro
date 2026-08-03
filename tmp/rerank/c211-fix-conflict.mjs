#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='e95a92295d7c4deb'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
const n = nodes.find((x) => x.name === 'Montar janela');
let code = n.parameters.jsCode;

const oldBlock = `// different money values present with overlapping domain (>=2 docs with money)
  const moneyDocs=new Set(); for(const set of keyMaps.money.values()) for(const id of set) moneyDocs.add(id);
  if(keyMaps.money.size>=2 && moneyDocs.size>=2){
    conflictType='CONFIRMED_CONFLICT'; conflictReasonCode='DIVERGENT_MONETARY_VALUES';
    conflictDocumentIds=[...moneyDocs];
  }
  // potential: same normalized title theme + divergent vigency
  if(conflictType==='NO_CONFLICT'){
    const vigDocs=docs.filter(d=>d.vigency);
    const vigSet=new Set(vigDocs.map(d=>String(d.vigency).slice(0,10)));
    if(vigDocs.length>=2 && vigSet.size>=2){
      // only if titles share a significant token
      const tokens=vigDocs.map(d=>String(d.title||'').toLowerCase().split(/[^a-z0-9à-ü]+/).filter(x=>x.length>4));
      let share=false;
      for(let i=0;i<tokens.length;i++) for(let j=i+1;j<tokens.length;j++){
        if(tokens[i].some(t=>tokens[j].includes(t))) share=true;
      }
      if(share){
        conflictType='POTENTIAL_CONFLICT'; conflictReasonCode='DIVERGENT_VIGENCY';
        conflictDocumentIds=vigDocs.map(d=>d.id);
      }
    }
  }
  // potential: POS vs NEG boolean signals across docs on same codes
  if(conflictType==='NO_CONFLICT'){
    const pos=[], neg=[];
    for(const d of docs){
      const s=extractSignals(d.text);
      if(s.bools.includes('POS')) pos.push(d.id);
      if(s.bools.includes('NEG')) neg.push(d.id);
    }
    if(pos.length && neg.length && [...new Set([...pos,...neg])].length>=2){
      conflictType='POTENTIAL_CONFLICT'; conflictReasonCode='OPPOSING_STATUS';
      conflictDocumentIds=[...new Set([...pos,...neg])];
    }
  }`;

const newBlock = `// Confirmed money conflict only when SAME entity key (CPF/CRM/code) maps to DIFFERENT money values
  for (const entityMap of [keyMaps.cpf, keyMaps.crm, keyMaps.code]) {
    for (const [entity, docSet] of entityMap.entries()) {
      if (docSet.size < 2) continue;
      const moneys = new Set();
      for (const id of docSet) {
        const d = byDoc.get(id);
        if (!d) continue;
        for (const m of extractSignals(d.text).money) moneys.add(m);
      }
      if (moneys.size >= 2) {
        conflictType = 'CONFIRMED_CONFLICT';
        conflictReasonCode = 'DIVERGENT_MONETARY_VALUES';
        conflictDocumentIds = [...docSet];
        break;
      }
    }
    if (conflictType !== 'NO_CONFLICT') break;
  }
  // Potential: same strong title fingerprint + divergent vigency (ignore generic tokens)
  if (conflictType === 'NO_CONFLICT') {
    const stop = new Set(['certidao','certidão','regularidade','documento','arquivo','word','excel','coren','crm','anexo','oftalmo','oftalmocentro']);
    const vigDocs = docs.filter((d) => d.vigency);
    for (let i = 0; i < vigDocs.length; i++) {
      for (let j = i + 1; j < vigDocs.length; j++) {
        const a = vigDocs[i], b = vigDocs[j];
        if (String(a.vigency).slice(0, 10) === String(b.vigency).slice(0, 10)) continue;
        const ta = String(a.title || '').toLowerCase().split(/[^a-z0-9à-ü]+/).filter((x) => x.length > 4 && !stop.has(x));
        const tb = String(b.title || '').toLowerCase().split(/[^a-z0-9à-ü]+/).filter((x) => x.length > 4 && !stop.has(x));
        const shared = ta.filter((t) => tb.includes(t));
        if (shared.length >= 2) {
          conflictType = 'POTENTIAL_CONFLICT';
          conflictReasonCode = 'DIVERGENT_VIGENCY';
          conflictDocumentIds = [a.id, b.id];
        }
      }
    }
  }
  // Potential opposing status ONLY when same entity key appears in both POS and NEG docs
  if (conflictType === 'NO_CONFLICT') {
    const docSignals = docs.map((d) => ({ id: d.id, ...extractSignals(d.text) }));
    const pos = docSignals.filter((d) => d.bools.includes('POS'));
    const neg = docSignals.filter((d) => d.bools.includes('NEG'));
    if (pos.length && neg.length) {
      let hit = null;
      for (const p of pos) {
        for (const n of neg) {
          if (p.id === n.id) continue;
          const sharedEntity =
            p.cpf.some((x) => n.cpf.includes(x)) ||
            p.crm.some((x) => n.crm.includes(x)) ||
            p.codes.some((x) => n.codes.includes(x));
          if (sharedEntity) {
            hit = [p.id, n.id];
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        conflictType = 'POTENTIAL_CONFLICT';
        conflictReasonCode = 'OPPOSING_STATUS';
        conflictDocumentIds = hit;
      }
    }
  }`;

if (!code.includes(oldBlock.slice(0, 80))) {
  console.error('old block not found - trying looser replace');
  // try replace from moneyDocs to OPPOSING end
  const start = code.indexOf('const moneyDocs=new Set()');
  const end = code.indexOf("conflictDetected = conflictType==='POTENTIAL_CONFLICT'");
  if (start < 0 || end < 0) {
    console.error('markers missing', { start, end });
    process.exit(1);
  }
  code = code.slice(0, start) + newBlock + '\n  ' + code.slice(end);
  console.log('replaced via markers');
} else {
  code = code.replace(oldBlock, newBlock);
  console.log('replaced exact block');
}

n.parameters.jsCode = code;
const versionId = randomUUID();
const nodesJson = JSON.stringify(nodes);
const connJson = JSON.stringify(connections);
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'Tighten conflict detection',false,NOW(),NOW())`,
  [versionId, 'e95a92295d7c4deb', nodesJson, connJson, rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [nodesJson, versionId, 'e95a92295d7c4deb'],
);
await client.query('COMMIT');
console.log('CWM version', versionId);
await client.end();
