#!/usr/bin/env node
/** Patch Processar documento, health, backup, dataset for Etapa 18 embeddings. */
import { randomUUID } from 'crypto';
import { writeFileSync, readFileSync } from 'fs';
import pg from 'pg';

const ORQ = 'LJQZ2HrG6qJGN0Q2';
const PG = { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' };
const conn = process.env.PGURL || 'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';
const client = new pg.Client({ connectionString: conn });
await client.connect();

async function load(id) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id = $1`,
    [id]
  );
  if (!rows[0]) throw new Error('missing ' + id);
  return {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections: typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections,
  };
}

async function save(wf) {
  await client.query(
    `UPDATE workflow_entity SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW() WHERE id = $3`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id]
  );
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes = $1::json, connections = $2::json, "updatedAt" = NOW()
       WHERE "workflowId" = $3 AND "versionId" = $4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), wf.id, wf.activeVersionId]
    );
  }
}

function ensureMain(connections, src) {
  if (!connections[src]) connections[src] = { main: [[]] };
  if (!connections[src].main) connections[src].main = [[]];
}

function setTargets(connections, src, sourceIndex, targets) {
  ensureMain(connections, src);
  while (connections[src].main.length <= sourceIndex) connections[src].main.push([]);
  connections[src].main[sourceIndex] = targets.map((name) => ({ node: name, type: 'main', index: 0 }));
}

function upsertNode(nodes, node) {
  const idx = nodes.findIndex((n) => n.name === node.name);
  if (idx >= 0) nodes[idx] = { ...nodes[idx], ...node, id: nodes[idx].id };
  else nodes.push({ id: randomUUID(), ...node });
}

const results = {};

// ---- Processar documento ----
{
  const wf = await load('vNDpCzOdR7ATnHDP');
  upsertNode(wf.nodes, {
    name: 'Chamar EMBEDDING - ORQUESTRAR',
    type: 'n8n-nodes-base.executeWorkflow',
    typeVersion: 1.3,
    position: [2400, 200],
    parameters: {
      mode: 'once',
      source: 'database',
      workflowId: { __rl: true, mode: 'id', value: ORQ, cachedResultName: 'EMBEDDING - ORQUESTRAR' },
      workflowInputs: {
        mappingMode: 'defineBelow',
        value: {
          versionId: "={{ $('Buscar documento no PostgreSQL').first().json.versionId }}",
          documentId: "={{ $('Buscar documento no PostgreSQL').first().json.id }}",
          requestId: "={{ $('Normalizar request').first().json.requestId }}",
          userId: "={{ $('Validar auth').first().json.userId || '' }}",
          sessionId: "={{ $('Validar auth').first().json.sessionId || '' }}",
          force: false,
        },
      },
      options: { waitForSubWorkflow: true },
    },
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
  });
  upsertNode(wf.nodes, {
    name: 'Embedding ok?',
    type: 'n8n-nodes-base.if',
    typeVersion: 2.3,
    position: [2620, 200],
    parameters: {
      conditions: {
        options: { version: 2, leftValue: '', caseSensitive: true, typeValidation: 'loose' },
        combinator: 'and',
        conditions: [
          {
            id: 'emb1',
            operator: { type: 'boolean', operation: 'true' },
            leftValue: '={{ $json.ok }}',
            rightValue: true,
          },
        ],
      },
      looseTypeValidation: true,
    },
  });
  upsertNode(wf.nodes, {
    name: 'Marcar falha embedding',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.6,
    position: [2840, 360],
    credentials: { postgres: PG },
    parameters: {
      operation: 'executeQuery',
      options: {},
      query:
        "UPDATE document_versions SET status = 'FAILED', processing_status = 'failed', embedding_status = 'FAILED'\n" +
        "WHERE id = '{{ $('Buscar documento no PostgreSQL').first().json.versionId }}'::uuid;\n" +
        "UPDATE documents SET processing_status = 'error', updated_at = NOW()\n" +
        "WHERE id = '{{ $('Buscar documento no PostgreSQL').first().json.id }}'::uuid;\n" +
        "SELECT false AS ok, 'EMBEDDING_FAILED' AS errorCode;",
    },
  });

  // Rewire: Salvar chunks / Tabular ok? → embedding → promote/fail
  setTargets(wf.connections, 'Salvar chunks', 0, ['Chamar EMBEDDING - ORQUESTRAR']);
  setTargets(wf.connections, 'Tabular ok?', 0, ['Chamar EMBEDDING - ORQUESTRAR']);
  setTargets(wf.connections, 'Chamar EMBEDDING - ORQUESTRAR', 0, ['Embedding ok?']);
  setTargets(wf.connections, 'Embedding ok?', 0, ['Promover versão']);
  setTargets(wf.connections, 'Embedding ok?', 1, ['Marcar falha embedding']);
  setTargets(wf.connections, 'Marcar falha embedding', 0, ['Tratar erro processamento']);

  await save(wf);
  results.processar = { id: wf.id, nodes: wf.nodes.length };
}

// ---- BACKUP exclude embedding_vector ----
{
  const wf = await load('A16PhhWFr0Za9X3B');
  const n = wf.nodes.find((x) => x.name === 'Exportar tabelas app');
  if (!n) throw new Error('backup export node missing');
  n.parameters.query = n.parameters.query.replace(
    "'document_chunks', (SELECT COALESCE(json_agg(row_to_json(dc)), '[]'::json) FROM document_chunks dc)",
    "'document_chunks', (SELECT COALESCE(json_agg(to_jsonb(dc) - 'embedding_vector'), '[]'::json) FROM document_chunks dc)"
  );
  await save(wf);
  results.backup = { id: wf.id, patched: n.parameters.query.includes(" - 'embedding_vector'") };
}

// ---- DATASET stamp embedding fields ----
{
  const wf = await load('12t0Ol6zWQJgAKPC');
  const n = wf.nodes.find((x) => x.name === 'Inserir run');
  if (!n) throw new Error('dataset insert run missing');
  let q = n.parameters.query;
  if (!q.includes('embedding_model')) {
    q = q
      .replace(
        'INSERT INTO ai_test_runs (status, triggered_by, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version, prompt_version_id)',
        'INSERT INTO ai_test_runs (status, triggered_by, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version, prompt_version_id, embedding_model, embedding_version)'
      )
      .replace(
        'INSERT INTO ai_test_runs (status, triggered_by, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version)',
        'INSERT INTO ai_test_runs (status, triggered_by, trigger_mode, prompt_version, model_name, ocr_engine_version, tabular_engine_version, embedding_model, embedding_version)'
      );
    // Add select columns before FROM or before RETURNING depending on shape
    if (q.includes('prompt_version_id)\nSELECT') || q.includes('prompt_version_id)\nSELECT')) {
      // already handled by replace of insert list; need values
    }
    if (q.includes('pv.id\nFROM')) {
      q = q.replace(
        'pv.id\nFROM',
        "pv.id,\n  COALESCE((SELECT value FROM app_secrets WHERE key='embedding_model' LIMIT 1), 'unknown'),\n  COALESCE((SELECT value FROM app_secrets WHERE key='embedding_engine_version' LIMIT 1), 'unknown')\nFROM"
      );
    } else if (q.includes("tabular_engine_version') LIMIT 1), 'n/a')\n)")) {
      q = q.replace(
        "tabular_engine_version') LIMIT 1), 'n/a')\n)",
        "tabular_engine_version') LIMIT 1), 'n/a'),\n  COALESCE((SELECT value FROM app_secrets WHERE key='embedding_model' LIMIT 1), 'unknown'),\n  COALESCE((SELECT value FROM app_secrets WHERE key='embedding_engine_version' LIMIT 1), 'unknown')\n)"
      );
    }
    n.parameters.query = q;
  }
  await save(wf);
  results.dataset = { id: wf.id, hasEmbedding: n.parameters.query.includes('embedding_model') };
}

// ---- HEALTH: probe + prepare + aggregate + GET filter ----
{
  const wf = await load('qAyYc9DrHIqe4L9i');
  const probe = wf.nodes.find((x) => x.name === 'Probe database');
  const prep = wf.nodes.find((x) => x.name === 'Prepare checks');
  const agg = wf.nodes.find((x) => x.name === 'Aggregate health');
  if (!probe || !prep || !agg) throw new Error('health nodes missing');

  if (!probe.parameters.query.includes('embedding_stats')) {
    probe.parameters.query = probe.parameters.query
      .replace(
        'tabular_stats AS (',
        `embedding_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE embedding_status = 'PENDING')::int AS embedding_pending,
    COUNT(*) FILTER (WHERE embedding_status = 'PROCESSING')::int AS embedding_processing,
    COUNT(*) FILTER (WHERE embedding_status = 'VALID')::int AS embedding_valid,
    COUNT(*) FILTER (WHERE embedding_status = 'FAILED')::int AS embedding_failed,
    COUNT(*) FILTER (WHERE embedding_status = 'INVALID')::int AS embedding_invalid,
    COUNT(*) FILTER (WHERE embedding_status = 'SKIPPED')::int AS embedding_skipped,
    COUNT(*) FILTER (
      WHERE embedding_status = 'VALID'
        AND (embedding_vector IS NULL OR embedding_hash IS DISTINCT FROM content_hash)
    )::int AS embedding_mismatched,
    ROUND(AVG(embedding_generation_ms) FILTER (WHERE embedding_generation_ms IS NOT NULL))::int AS embedding_avg_ms
  FROM document_chunks
),
tabular_stats AS (`
      )
      .replace(
        'tabular_stats.tabular_chunk_count,',
        `tabular_stats.tabular_chunk_count,
  embedding_stats.embedding_pending,
  embedding_stats.embedding_processing,
  embedding_stats.embedding_valid,
  embedding_stats.embedding_failed,
  embedding_stats.embedding_invalid,
  embedding_stats.embedding_skipped,
  embedding_stats.embedding_mismatched,
  embedding_stats.embedding_avg_ms,`
      )
      .replace(
        'CROSS JOIN tabular_stats',
        'CROSS JOIN tabular_stats\nCROSS JOIN embedding_stats'
      );
  }

  if (!prep.parameters.jsCode.includes('embeddingsDb')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'const aiEvalDb = dbFailed',
      `const embeddingsDb = dbFailed
  ? { pending: 0, processing: 0, valid: 0, failed: 0, invalid: 0, skipped: 0, mismatched: 0, avgMs: null }
  : {
      pending: Number(dbItem.embedding_pending ?? 0) || 0,
      processing: Number(dbItem.embedding_processing ?? 0) || 0,
      valid: Number(dbItem.embedding_valid ?? 0) || 0,
      failed: Number(dbItem.embedding_failed ?? 0) || 0,
      invalid: Number(dbItem.embedding_invalid ?? 0) || 0,
      skipped: Number(dbItem.embedding_skipped ?? 0) || 0,
      mismatched: Number(dbItem.embedding_mismatched ?? 0) || 0,
      avgMs: dbItem.embedding_avg_ms != null ? Number(dbItem.embedding_avg_ms) : null,
    };
const aiEvalDb = dbFailed`
    );
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'aiPromptsDb,\n    },',
      'aiPromptsDb,\n      embeddingsDb,\n    },'
    );
  }

  if (!agg.parameters.jsCode.includes('embeddings:')) {
    agg.parameters.jsCode = agg.parameters.jsCode.replace(
      'aiPrompts: (() => {',
      `embeddings: (() => {
    const e = partial.embeddingsDb || { pending: 0, processing: 0, valid: 0, failed: 0, invalid: 0, skipped: 0, mismatched: 0, avgMs: null };
    const degraded = e.failed > 0 || e.invalid > 0 || e.mismatched > 0 || e.processing > 0;
    const status = e.pending > 0 && e.valid === 0 && e.failed === 0 ? 'degraded' : (degraded ? 'degraded' : 'ok');
    return {
      status,
      pending: e.pending,
      processing: e.processing,
      valid: e.valid,
      failed: e.failed,
      invalid: e.invalid,
      skipped: e.skipped,
      mismatched: e.mismatched,
      avgMs: e.avgMs,
    };
  })(),
  aiPrompts: (() => {`
    );
  }

  await save(wf);
  results.health = { id: wf.id, probeHasEmbedding: probe.parameters.query.includes('embedding_stats') };
}

// ---- GET System Health allow embeddings key ----
{
  const wf = await load('2UPHcxASp2PboC9M');
  const n = wf.nodes.find((x) => x.name === 'Montar resposta admin');
  if (!n) throw new Error('montar resposta missing');
  if (!n.parameters.jsCode.includes("'embeddings'")) {
    n.parameters.jsCode = n.parameters.jsCode.replace(
      "const allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','configuration','sessions','audit','documents','backup','aiEval','aiPrompts'];",
      "const allowedCompKeys = ['n8n','database','storage','tika','ocr','tabular','embeddings','configuration','sessions','audit','documents','backup','aiEval','aiPrompts'];"
    );
    n.parameters.jsCode = n.parameters.jsCode.replace(
      "if (key === 'tabular') {",
      `if (key === 'embeddings') {
    out.pending = Number(c.pending || 0) || 0;
    out.processing = Number(c.processing || 0) || 0;
    out.valid = Number(c.valid || 0) || 0;
    out.failed = Number(c.failed || 0) || 0;
    out.invalid = Number(c.invalid || 0) || 0;
    out.skipped = Number(c.skipped || 0) || 0;
    out.mismatched = Number(c.mismatched || 0) || 0;
    out.avgMs = c.avgMs != null ? Number(c.avgMs) : null;
  }
  if (key === 'tabular') {`
    );
  }
  await save(wf);
  results.getHealth = { id: wf.id, hasEmbeddings: n.parameters.jsCode.includes("'embeddings'") };
}

writeFileSync(new URL('./_patch-existing-result.json', import.meta.url), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await client.end();
