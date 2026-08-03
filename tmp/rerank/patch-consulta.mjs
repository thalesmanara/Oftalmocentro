#!/usr/bin/env node
/** Patch Consulta IA: retrieval config + optional HYBRID_RERANK with fallback */
import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync } from 'fs';
import pg from 'pg';

const IDS = JSON.parse(readFileSync(new URL('./workflow-ids.json', import.meta.url), 'utf8'));
const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

function upsertNode(nodes, node) {
  const i = nodes.findIndex((n) => n.name === node.name);
  if (i >= 0) nodes[i] = { ...nodes[i], ...node, id: nodes[i].id };
  else nodes.push({ id: randomUUID(), ...node });
}
function setTargets(c, src, idx, targets) {
  if (!c[src]) c[src] = { main: [[]] };
  if (!c[src].main) c[src].main = [[]];
  while (c[src].main.length <= idx) c[src].main.push([]);
  c[src].main[idx] = targets.map((n) => ({ node: n, type: 'main', index: 0 }));
}

const { rows } = await client.query(
  `SELECT id, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [IDS.CONSULTA],
);
const wf = {
  id: rows[0].id,
  nodes: rows[0].nodes,
  connections: rows[0].connections,
  activeVersionId: rows[0].activeVersionId,
};

// 1) Widen Merge híbrido candidate pool to 30 (still sorted by hybrid)
const merge = wf.nodes.find((n) => n.name === 'Merge híbrido');
if (!merge) throw new Error('Merge híbrido missing');
if (!merge.parameters.jsCode.includes('candidatePool')) {
  merge.parameters.jsCode = merge.parameters.jsCode
    .replace('const top=merged.slice(0,12);', 'const candidatePool=30;\nconst top=merged.slice(0,candidatePool);')
    .replace(
      'return top.map(r=>({json:r}));',
      "return top.map((r,i)=>({json:{...r, hybridRank:i+1, candidatePool}}));",
    );
}

upsertNode(wf.nodes, {
  name: 'Carregar retrieval config',
  type: 'n8n-nodes-base.executeWorkflow',
  typeVersion: 1.3,
  position: [2700, 100],
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
  parameters: {
    mode: 'once',
    source: 'database',
    workflowId: { __rl: true, mode: 'id', value: IDS.LOAD_CFG, cachedResultName: 'IA - CARREGAR RETRIEVAL CONFIG' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
        modeOverride: '',
      },
    },
    options: { waitForSubWorkflow: true },
  },
});

upsertNode(wf.nodes, {
  name: 'Preparar seleção retrieval',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2920, 100],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const cfgNode=$('Carregar retrieval config').first().json||{};
const cfg=cfgNode.configuration||{};
const mode=String(cfgNode.mode||cfg.mode||'HYBRID').toUpperCase();
const finalLimit=Math.min(Math.max(Number(cfg.finalLimit||12)||12,1),20);
const candidates=$input.all().map(i=>i.json).filter(r=>r&&(r.chunkText||r.documentId));
const classification=$('Classificar pergunta').first().json||{};
const question=String(classification.question||'');
const useRerank=mode==='HYBRID_RERANK';
return [{json:{
  mode, useRerank, finalLimit,
  versionLabel: cfgNode.versionLabel||'hybrid-v1',
  configurationJson: JSON.stringify({...cfg, mode, versionLabel: cfgNode.versionLabel||null}),
  classificationJson: JSON.stringify({
    categoryId: classification.categoryId||null,
    subcategoryId: classification.subcategoryId||null,
    categoryName: classification.categoryName||null,
    subcategoryName: classification.subcategoryName||null,
    searchTerms: classification.searchTerms||[],
  }),
  candidatesJson: JSON.stringify(candidates),
  candidates,
  question,
  requestId: $('Normalizar request').first().json.requestId||'',
  userId: $('Validar auth').first().json.userId||'',
  sessionId: $('Validar auth').first().json.sessionId||'',
}}];`,
  },
});

upsertNode(wf.nodes, {
  name: 'Usar re-ranking?',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.3,
  position: [3140, 100],
  parameters: {
    conditions: {
      combinator: 'and',
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{
        id: 'rr1',
        leftValue: '={{ $json.useRerank === true }}',
        rightValue: true,
        operator: { type: 'boolean', operation: 'true' },
      }],
    },
    looseTypeValidation: true,
  },
});

upsertNode(wf.nodes, {
  name: 'Chamar RE-RANQUEAR',
  type: 'n8n-nodes-base.executeWorkflow',
  typeVersion: 1.3,
  position: [3360, 0],
  onError: 'continueRegularOutput',
  alwaysOutputData: true,
  parameters: {
    mode: 'once',
    source: 'database',
    workflowId: { __rl: true, mode: 'id', value: IDS.RERANK, cachedResultName: 'IA - RE-RANQUEAR CANDIDATOS' },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        question: '={{ $json.question }}',
        classificationJson: '={{ $json.classificationJson }}',
        candidatesJson: '={{ $json.candidatesJson }}',
        configurationJson: '={{ $json.configurationJson }}',
        requestId: '={{ $json.requestId }}',
        userId: '={{ $json.userId }}',
        sessionId: '={{ $json.sessionId }}',
      },
    },
    options: { waitForSubWorkflow: true },
  },
});

upsertNode(wf.nodes, {
  name: 'Resolver ranking final',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3580, 100],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const prep=$('Preparar seleção retrieval').first().json||{};
const mode=String(prep.mode||'HYBRID').toUpperCase();
const finalLimit=Number(prep.finalLimit||12)||12;
const hybridCandidates=Array.isArray(prep.candidates)?prep.candidates:[];
let ranked=[];
let fallbackUsed=false;
let rankingMetadata={mode, fallbackUsed:false, selectedCount:0, durationMs:0};
if(mode==='HYBRID_RERANK'){
  const rr=$input.first().json||{};
  if(rr.ok===true && Array.isArray(rr.rankedCandidates) && rr.rankedCandidates.length){
    ranked=rr.rankedCandidates;
    rankingMetadata=rr.rankingMetadata||rankingMetadata;
  } else {
    fallbackUsed=true;
    rankingMetadata={mode:'HYBRID_FALLBACK', fallbackUsed:true, selectedCount:0, durationMs:0, error:rr.error||'rerank_failed'};
    ranked=hybridCandidates.slice(0, finalLimit).map((c,i)=>({...c, rerankPosition:i+1, rerankScore:c.mergedScore||0, selectionReason:'hybrid_fallback', retrievalMode:'hybrid_fallback'}));
    try {
      // audit fallback is best-effort via metadata on response; dedicated audit optional
    } catch(_){}
  }
} else {
  ranked=hybridCandidates.slice(0, finalLimit).map((c,i)=>({...c, rerankPosition:i+1, rerankScore:c.mergedScore||0, selectionReason:'hybrid', retrievalMode:c.retrievalMode||'hybrid'}));
  rankingMetadata={mode, fallbackUsed:false, selectedCount:ranked.length, durationMs:0, versionLabel:prep.versionLabel||null};
}
rankingMetadata.fallbackUsed=fallbackUsed||!!rankingMetadata.fallbackUsed;
rankingMetadata.selectedCount=ranked.length;
rankingMetadata.versionLabel=prep.versionLabel||rankingMetadata.versionLabel||null;
return ranked.map((r,i)=>({json:{...r, rankingMetadata, retrievalConfigVersion:prep.versionLabel||null, fallbackUsed:rankingMetadata.fallbackUsed}}));`,
  },
});

upsertNode(wf.nodes, {
  name: 'Corte hybrid padrão',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3360, 200],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const prep=$input.first().json||{};
return [{json:prep}];`,
  },
});

// Wire: Merge → Carregar config → Preparar → IF → (RE-RANQUEAR | Corte) → Resolver → Montar
setTargets(wf.connections, 'Merge híbrido', 0, ['Carregar retrieval config']);
setTargets(wf.connections, 'Carregar retrieval config', 0, ['Preparar seleção retrieval']);
setTargets(wf.connections, 'Preparar seleção retrieval', 0, ['Usar re-ranking?']);
setTargets(wf.connections, 'Usar re-ranking?', 0, ['Chamar RE-RANQUEAR']);
setTargets(wf.connections, 'Usar re-ranking?', 1, ['Corte hybrid padrão']);
setTargets(wf.connections, 'Chamar RE-RANQUEAR', 0, ['Resolver ranking final']);
setTargets(wf.connections, 'Corte hybrid padrão', 0, ['Resolver ranking final']);
setTargets(wf.connections, 'Resolver ranking final', 0, ['Montar contexto']);

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id],
);
if (wf.activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId],
  );
}

writeFileSync(new URL('./_patch-consulta.json', import.meta.url), JSON.stringify({
  ok: true,
  nodes: wf.nodes.length,
  hasRerank: wf.nodes.some((n) => n.name === 'Chamar RE-RANQUEAR'),
  hasLoadCfg: wf.nodes.some((n) => n.name === 'Carregar retrieval config'),
}, null, 2));
console.log('Consulta IA patched; published mode remains HYBRID (no rerank path unless config published)');
await client.end();
