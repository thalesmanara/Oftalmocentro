#!/usr/bin/env node
/**
 * Etapa 28.3 — add inactive document gate to IA - RECUPERAR CONTEXTO
 */
import { writeFileSync } from 'fs';
import { mcpCall } from './mcp.mjs';

const WORKFLOW_ID = 'bae8872eeb164a27';

const prepararGateJs = `const base=$input.first().json||{};
const candidates=Array.isArray(base.candidates)?base.candidates:[];
function esc(s){return String(s??'').replace(/'/g,"''");}
const ids=[...new Set(candidates.map(c=>c&&c.documentId).filter(Boolean).map(String))];
let gateSql;
if(!ids.length){
  gateSql='SELECT NULL::text AS "documentId", TRUE AS "isActive" WHERE FALSE';
}else{
  const inList=ids.map(id=>\`'\${esc(id)}'\`).join(',');
  gateSql=\`SELECT id::text AS "documentId", COALESCE(is_active,true) AS "isActive" FROM documents WHERE id IN (\${inList})\`;
}
return [{json:{...base,gateSql,gateDocumentIds:ids}}];`;

const aplicarGateJs = `const base=$('Preparar gate ativos').first().json||{};
const activeRows=$input.all().map(i=>i.json).filter(r=>r&&r.documentId);
const activeSet=new Set(activeRows.filter(r=>r.isActive===true||r.isActive==='true'||r.isActive===1).map(r=>String(r.documentId)));
const beforeCandidates=Array.isArray(base.candidates)?base.candidates:[];
const candidates=beforeCandidates.filter(c=>c&&c.documentId&&activeSet.has(String(c.documentId)));
const inactiveFilteredCount=beforeCandidates.length-candidates.length;
let vectorHits=Array.isArray(base.vectorHits)?base.vectorHits:[];
let textRows=Array.isArray(base.textRows)?base.textRows:[];
const beforeVector=vectorHits.length;
const beforeText=textRows.length;
vectorHits=vectorHits.filter(h=>h&&h.documentId&&activeSet.has(String(h.documentId)));
textRows=textRows.filter(r=>r&&r.documentId&&activeSet.has(String(r.documentId)));
const pipelineMeta={
  ...(base.pipelineMeta||{}),
  inactiveFilteredCount,
  inactiveFilteredVectorHits:beforeVector-vectorHits.length,
  inactiveFilteredTextRows:beforeText-textRows.length,
};
return [{json:{...base,candidates,vectorHits,textRows,pipelineMeta}}];`;

const ops = [
  {
    type: 'addNode',
    node: {
      name: 'Preparar gate ativos',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3580, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: prepararGateJs,
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Consultar ativos gate',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [3660, 0],
      parameters: {
        operation: 'executeQuery',
        options: {},
        query: '={{ $json.gateSql }}',
      },
      credentials: {
        postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Aplicar gate ativos',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3740, 0],
      parameters: {
        mode: 'runOnceForAllItems',
        language: 'javaScript',
        jsCode: aplicarGateJs,
      },
    },
  },
  { type: 'removeConnection', source: 'Merge híbrido', target: 'Preparar seleção' },
  { type: 'addConnection', source: 'Merge híbrido', target: 'Preparar gate ativos' },
  { type: 'addConnection', source: 'Preparar gate ativos', target: 'Consultar ativos gate' },
  { type: 'addConnection', source: 'Consultar ativos gate', target: 'Aplicar gate ativos' },
  { type: 'addConnection', source: 'Aplicar gate ativos', target: 'Preparar seleção' },
  {
    type: 'setNodeCredential',
    nodeName: 'Consultar ativos gate',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeSettings',
    nodeName: 'Consultar ativos gate',
    settings: { alwaysOutputData: true, onError: 'continueRegularOutput' },
  },
  { type: 'setNodePosition', nodeName: 'Preparar seleção', position: [3820, 0] },
];

writeFileSync(new URL('./28-3-gate-ops.json', import.meta.url), JSON.stringify(ops, null, 2));
console.log('Applying', ops.length, 'ops...');
const update = await mcpCall('update_workflow', { workflowId: WORKFLOW_ID, operations: ops });
console.log('update', JSON.stringify(update).slice(0, 500));
const pub = await mcpCall('publish_workflow', { workflowId: WORKFLOW_ID });
console.log('published', JSON.stringify(pub).slice(0, 500));
