#!/usr/bin/env node
/**
 * Integrate CWM into Consulta IA:
 * RECUPERAR → Aplicar contexto recuperado → Carregar prompt → Preparar prompt meta
 * → GERENCIAR JANELA → Aplicar janela/mensagens → OpenAI → Montar resposta
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';

const CONSULTA = '8EXk5RkFW5cxnenL';
const ids = JSON.parse(readFileSync(new URL('./_cwm-ids.json', import.meta.url), 'utf8'));

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
  [CONSULTA],
);
let nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : structuredClone(rows[0].nodes);
let conn =
  typeof rows[0].connections === 'string'
    ? JSON.parse(rows[0].connections)
    : structuredClone(rows[0].connections);

const uid = () => randomUUID();

// Enrich Aplicar contexto recuperado to keep selectedChunks + legacy context
const aplicarCtx = nodes.find((n) => n.name === 'Aplicar contexto recuperado');
if (aplicarCtx) {
  aplicarCtx.parameters.jsCode = `const ret=$input.first().json||{};
const cls=$('Classificar pergunta').first().json||{};
return [{json:{
  question: ret.question || cls.question || '',
  classification: ret.classification || {
    categoryId: cls.categoryId || null,
    categoryName: cls.categoryName || null,
    categoryDescription: cls.categoryDescription || null,
    subcategoryId: cls.subcategoryId || null,
    subcategoryName: cls.subcategoryName || null,
    subcategoryDescription: cls.subcategoryDescription || null,
  },
  context: ret.context || '',
  sources: Array.isArray(ret.sources) ? ret.sources : [],
  selectedChunks: Array.isArray(ret.selectedChunks) ? ret.selectedChunks : [],
  retrievalMeta: ret.retrievalMeta || null,
  diagnostic: ret.diagnostic || null,
  requestId: ret.requestId || $('Normalizar request').first().json.requestId || '',
}}];`;
}

// Replace Aplicar prompt carregado to only normalize prompt (no context yet)
const aplicarPrompt = nodes.find((n) => n.name === 'Aplicar prompt carregado');
if (aplicarPrompt) {
  aplicarPrompt.parameters.jsCode = `const loaded = $input.first().json || {};
if (!loaded.ok) {
  throw new Error('Falha ao carregar prompt ativo: ' + (loaded.code || 'PROMPT_NOT_FOUND'));
}
return [{json:{
  ok: true,
  promptVersionId: loaded.promptVersionId || null,
  promptCode: loaded.promptCode || loaded.code || null,
  versionNumber: loaded.versionNumber ?? null,
  contentHash: loaded.contentHash || null,
  modelName: loaded.modelName || 'gpt-4.1-mini',
  temperature: loaded.temperature ?? 0.1,
  maxTokens: loaded.maxTokens ?? 800,
  topP: loaded.topP ?? null,
  systemPrompt: loaded.content || '',
  content: loaded.content || '',
  userMessageTemplate: loaded.userMessageTemplate || null,
}}];`;
}

// Remove old connection Aplicar prompt → Message a model
// Add CWM nodes
nodes = nodes.filter(
  (n) => !['IA - GERENCIAR JANELA DE CONTEXTO', 'Aplicar janela de contexto'].includes(n.name),
);
delete conn['IA - GERENCIAR JANELA DE CONTEXTO'];
delete conn['Aplicar janela de contexto'];

const callCwm = {
  id: uid(),
  name: 'IA - GERENCIAR JANELA DE CONTEXTO',
  type: 'n8n-nodes-base.executeWorkflow',
  typeVersion: 1.3,
  position: [2400, 0],
  parameters: {
    mode: 'once',
    source: 'database',
    workflowId: {
      __rl: true,
      mode: 'id',
      value: ids.CWM_ID,
      cachedResultName: 'IA - GERENCIAR JANELA DE CONTEXTO',
    },
    workflowInputs: {
      mappingMode: 'defineBelow',
      value: {
        question: "={{ $('Aplicar contexto recuperado').first().json.question || '' }}",
        classificationJson:
          "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.classification || {}) }}",
        selectedChunksJson:
          "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.selectedChunks || []) }}",
        retrievalMetaJson:
          "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.retrievalMeta || {}) }}",
        promptConfigurationJson:
          "={{ JSON.stringify($('Aplicar prompt carregado').first().json || {}) }}",
        legacyContext: "={{ $('Aplicar contexto recuperado').first().json.context || '' }}",
        sourcesJson: "={{ JSON.stringify($('Aplicar contexto recuperado').first().json.sources || []) }}",
        contextConfigVersionId: `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  return String(b.contextConfigVersionId||q.contextConfigVersionId||'').trim();
})() }}`,
        contextConfigOverrideAllowed: `={{ (() => {
  const b=$('Normalizar request').first().json.body||{};
  const q=$('Normalizar request').first().json.query||{};
  const flag=b.contextConfigOverrideAllowed===true||b.contextConfigOverrideAllowed==='true'||q.contextConfigOverrideAllowed===true||q.contextConfigOverrideAllowed==='true';
  if(!flag) return 'false';
  let allowed=false;
  try {
    const auth=$('Validar auth').first().json||{};
    const user=auth.user||{};
    const perms=[...(Array.isArray(auth.permissions)?auth.permissions:[]),...(Array.isArray(user.permissions)?user.permissions:[])].map(p=>String(p).toLowerCase());
    allowed=auth.isMaster===true||user.isMaster===true||perms.includes('editar_configuracoes');
  } catch(_) {}
  return allowed ? 'true' : 'false';
})() }}`,
        requestId: "={{ $('Normalizar request').first().json.requestId || '' }}",
        userId: "={{ $('Validar auth').first().json.userId || '' }}",
        sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
      },
    },
    options: { waitForSubWorkflow: true },
  },
};

const aplicarJanela = {
  id: uid(),
  name: 'Aplicar janela de contexto',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2620, 0],
  parameters: {
    mode: 'runOnceForAllItems',
    language: 'javaScript',
    jsCode: `const win=$input.first().json||{};
const prompt=$('Aplicar prompt carregado').first().json||{};
const ret=$('Aplicar contexto recuperado').first().json||{};
const cls=win.classification||ret.classification||{};
const context=String(win.context||ret.context||'');
const question=String(win.question||ret.question||'');
const systemContent=String(prompt.systemPrompt||prompt.content||'');
const userContent = 'Pergunta do usuário:\\n\\n' + question +
  '\\n\\nCategoria identificada:\\n\\n' + (cls.categoryName || 'Não identificada') +
  '\\n\\nDescrição da categoria:\\n\\n' + (cls.categoryDescription || 'Não informada') +
  '\\n\\nSubcategoria identificada:\\n\\n' + (cls.subcategoryName || 'Não identificada') +
  '\\n\\nDescrição da subcategoria:\\n\\n' + (cls.subcategoryDescription || 'Não informada') +
  '\\n\\nContexto documental recuperado:\\n\\n' + context +
  '\\n\\nResponda exclusivamente com base no contexto documental acima.';
return [{json:{
  question,
  classification: cls,
  context,
  sources: Array.isArray(win.sources) ? win.sources : (ret.sources || []),
  retrievalMeta: win.retrievalMeta || ret.retrievalMeta || null,
  contextMeta: win.contextMeta || null,
  modelName: prompt.modelName || 'gpt-4.1-mini',
  temperature: prompt.temperature ?? 0.1,
  maxTokens: prompt.maxTokens ?? 800,
  systemContent,
  userContent,
  promptVersionId: prompt.promptVersionId || null,
  promptCode: prompt.promptCode || null,
  versionNumber: prompt.versionNumber ?? null,
  contentHash: prompt.contentHash || null,
}}];`,
  },
};

nodes.push(callCwm, aplicarJanela);

// Wire: Aplicar prompt → CWM → Aplicar janela → Message a model
conn['Aplicar prompt carregado'] = {
  main: [[{ node: 'IA - GERENCIAR JANELA DE CONTEXTO', type: 'main', index: 0 }]],
};
conn['IA - GERENCIAR JANELA DE CONTEXTO'] = {
  main: [[{ node: 'Aplicar janela de contexto', type: 'main', index: 0 }]],
};
conn['Aplicar janela de contexto'] = {
  main: [[{ node: 'Message a model', type: 'main', index: 0 }]],
};

// Message a model should read from Aplicar janela - check expressions
const msg = nodes.find((n) => n.name === 'Message a model');
if (msg) {
  // typically uses $json.modelName / systemContent / userContent from previous node - OK
}

// Montar resposta: use Aplicar janela
const montar = nodes.find((n) => n.name === 'Montar resposta');
if (montar) {
  montar.parameters.jsCode = `const ctx = $('Aplicar janela de contexto').first().json;
const prompt = $('Aplicar prompt carregado').first().json || {};
const answer = $json.output?.[0]?.content?.[0]?.text ?? '';
const sources = (ctx.sources || []).map((s) => ({
  ...s,
  expirationDate: s.expirationDate ?? s.vigencyDate ?? null,
}));
const requestId = $('Normalizar request').first().json.requestId;
const retrievalMeta = ctx.retrievalMeta || null;
const contextMeta = ctx.contextMeta || null;
return [{
  json: {
    data: {
      question: ctx.question,
      answer,
      sources,
      classification: ctx.classification,
      retrievalMeta,
      contextMeta: contextMeta ? {
        mode: contextMeta.mode,
        configVersion: contextMeta.configVersion,
        configVersionId: contextMeta.configVersionId,
        estimatedContextTokens: contextMeta.estimatedContextTokens,
        availableContextTokens: contextMeta.availableContextTokens,
        includedChunkCount: contextMeta.includedChunkCount,
        excludedChunkCount: contextMeta.excludedChunkCount,
        includedDocumentCount: contextMeta.includedDocumentCount,
        truncated: contextMeta.truncated,
        insufficientContext: contextMeta.insufficientContext,
        conflictDetected: contextMeta.conflictDetected,
        redundancyRemovedCount: contextMeta.redundancyRemovedCount,
        neighborsAddedCount: contextMeta.neighborsAddedCount,
        fallbackUsed: contextMeta.fallbackUsed,
        durationMs: contextMeta.durationMs,
        modelName: contextMeta.modelName,
      } : null,
    },
    statusCode: 200,
    requestId,
    promptMeta: {
      promptVersionId: prompt.promptVersionId || null,
      promptCode: prompt.promptCode || null,
      versionNumber: prompt.versionNumber != null ? prompt.versionNumber : null,
      contentHash: prompt.contentHash || null,
      modelName: prompt.modelName || null,
    },
  },
}];`;
}

await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
  [JSON.stringify(nodes), JSON.stringify(conn), CONSULTA],
);
if (rows[0].activeVersionId) {
  await client.query(
    `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
     WHERE "workflowId"=$3 AND "versionId"=$4`,
    [JSON.stringify(nodes), JSON.stringify(conn), CONSULTA, rows[0].activeVersionId],
  );
}

writeFileSync(
  new URL('./_cwm-consulta.json', import.meta.url),
  JSON.stringify(
    {
      names: nodes.map((n) => n.name),
      connections: Object.fromEntries(
        Object.entries(conn).map(([k, v]) => [
          k,
          (v.main || []).map((b) => (b || []).map((x) => x.node)),
        ]),
      ),
    },
    null,
    2,
  ),
);
console.log('Consulta integrated, nodes=', nodes.length);
await client.end();
