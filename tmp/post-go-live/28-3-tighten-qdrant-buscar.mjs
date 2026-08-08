#!/usr/bin/env node
/**
 * Etapa 28.3 — require isActive=true in QDRANT - BUSCAR (only after 100% backfill)
 */
import { readFileSync } from 'fs';
import { mcpCall } from './mcp.mjs';

const WORKFLOW_ID = 'YDnrXjzYUOrZVE6N';
const coverage = JSON.parse(
  readFileSync(new URL('./28-3-qdrant-isactive-coverage.json', import.meta.url), 'utf8'),
);

if (!coverage.fullCoverage) {
  console.log('Skipping QDRANT tighten — not 100% pointsWithIsActive', coverage);
  process.exit(0);
}

const prepararBuscaJs = `const t=$input.first().json||{};let vector=[];try{vector=JSON.parse(String(t.queryVectorJson||'[]'));}catch(_){vector=[];}const topK=Math.min(Math.max(Number(t.topK||12)||12,1),50);const categoryId=String(t.categoryId||'').trim();const subcategoryId=String(t.subcategoryId||'').trim();const must=[{key:'isCurrent',match:{value:true}},{key:'isActive',match:{value:true}}];if(subcategoryId)must.push({key:'subcategoryId',match:{value:subcategoryId}});else if(categoryId)must.push({key:'categoryId',match:{value:categoryId}});const body={vector,limit:topK,with_payload:true,filter:{must}};return [{json:{ok:Array.isArray(vector)&&vector.length>0,url:'http://qdrant:6333/collections/oftalmocentro_chunks/points/search',body,topK}}];`;

const ops = [
  {
    type: 'updateNodeParameters',
    nodeName: 'Preparar busca',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: prepararBuscaJs,
    },
  },
];

console.log('Tightening QDRANT - BUSCAR (100% coverage confirmed)...');
const update = await mcpCall('update_workflow', { workflowId: WORKFLOW_ID, operations: ops });
console.log('update', JSON.stringify(update).slice(0, 400));
const pub = await mcpCall('publish_workflow', { workflowId: WORKFLOW_ID });
console.log('published', JSON.stringify(pub).slice(0, 400));
