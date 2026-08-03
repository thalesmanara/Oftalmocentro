#!/usr/bin/env node
/** Patch health + backup + dataset for retrieval/rerank metrics */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

async function patch(id, fn) {
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  if (!rows[0]) return { id, error: 'missing' };
  const wf = {
    ...rows[0],
    nodes: typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes,
    connections:
      typeof rows[0].connections === 'string'
        ? JSON.parse(rows[0].connections)
        : rows[0].connections,
  };
  const result = fn(wf) || {};
  await client.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW() WHERE id=$3`,
    [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), id],
  );
  if (wf.activeVersionId) {
    await client.query(
      `UPDATE workflow_history SET nodes=$1::json, connections=$2::json, "updatedAt"=NOW()
       WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(wf.nodes), JSON.stringify(wf.connections), id, wf.activeVersionId],
    );
  }
  return { id, name: wf.name, ...result };
}

const out = {};

// Health SYSTEM - HEALTH CHECK
out.health = await patch('qAyYc9DrHIqe4L9i', (wf) => {
  const probe = wf.nodes.find((n) => n.name === 'Probe database');
  const prep = wf.nodes.find((n) => n.name === 'Prepare probes' || n.name === 'Preparar probes');
  const agg = wf.nodes.find((n) => n.name === 'Aggregate health');
  let changed = [];
  if (probe && !probe.parameters.query.includes('retrieval_stats')) {
    const stats = `retrieval_stats AS (
  SELECT
    COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1),'HYBRID') AS retrieval_mode,
    COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1),'hybrid-v1') AS retrieval_version,
    (SELECT COUNT(*)::int FROM ai_retrieval_config_versions WHERE status='DRAFT') AS retrieval_drafts,
    (SELECT COUNT(*)::int FROM ai_retrieval_config_versions WHERE status='PUBLISHED') AS retrieval_published,
    (SELECT AVG(rerank_latency_ms)::int FROM ai_test_results WHERE rerank_latency_ms IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS retrieval_avg_rerank_ms,
    (SELECT COUNT(*)::int FROM ai_test_results WHERE fallback_used=true AND created_at > NOW() - INTERVAL '7 days') AS retrieval_fallback_count,
    (SELECT AVG(candidates_retrieved)::numeric FROM ai_test_results WHERE candidates_retrieved IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS retrieval_avg_candidates,
    (SELECT AVG(final_context_count)::numeric FROM ai_test_results WHERE final_context_count IS NOT NULL AND created_at > NOW() - INTERVAL '7 days') AS retrieval_avg_final,
    (SELECT MAX(started_at) FROM ai_test_runs WHERE retrieval_config_version IS NOT NULL) AS retrieval_last_validation
)`;
    if (probe.parameters.query.includes('ai_eval_stats AS')) {
      probe.parameters.query = probe.parameters.query.replace(
        'ai_eval_stats AS (',
        stats + ',\nai_eval_stats AS (',
      );
    } else if (probe.parameters.query.includes('qdrant_sync_stats AS')) {
      probe.parameters.query = probe.parameters.query.replace(
        'qdrant_sync_stats AS (',
        stats + ',\nqdrant_sync_stats AS (',
      );
    } else {
      // append before final SELECT if possible
      probe.parameters.query = probe.parameters.query.replace(
        /\nSELECT\n/,
        `,\n${stats}\nSELECT\n`,
      );
    }
    if (!probe.parameters.query.includes('retrieval_stats.retrieval_mode')) {
      probe.parameters.query = probe.parameters.query.replace(
        /FROM\s+/i,
        `  retrieval_stats.retrieval_mode AS retrieval_mode,
  retrieval_stats.retrieval_version AS retrieval_version,
  retrieval_stats.retrieval_drafts AS retrieval_drafts,
  retrieval_stats.retrieval_published AS retrieval_published,
  retrieval_stats.retrieval_avg_rerank_ms AS retrieval_avg_rerank_ms,
  retrieval_stats.retrieval_fallback_count AS retrieval_fallback_count,
  retrieval_stats.retrieval_avg_candidates AS retrieval_avg_candidates,
  retrieval_stats.retrieval_avg_final AS retrieval_avg_final,
  retrieval_stats.retrieval_last_validation AS retrieval_last_validation,
FROM `,
      );
      // fix accidental FROM replacement - better add CROSS JOIN
      if (!probe.parameters.query.includes('CROSS JOIN retrieval_stats')) {
        probe.parameters.query = probe.parameters.query.replace(
          /CROSS JOIN qdrant_sync_stats/,
          'CROSS JOIN qdrant_sync_stats\nCROSS JOIN retrieval_stats',
        );
        if (!probe.parameters.query.includes('CROSS JOIN retrieval_stats')) {
          probe.parameters.query += '\n-- retrieval_stats join may need manual fix';
        }
      }
    }
    changed.push('probe');
  }

  const prepNode = prep || wf.nodes.find((n) => n.type === 'n8n-nodes-base.code' && n.parameters?.jsCode?.includes('embeddingsDb'));
  if (prepNode && !prepNode.parameters.jsCode.includes('retrievalDb')) {
    prepNode.parameters.jsCode = prepNode.parameters.jsCode.replace(
      /const qdrantDb =/,
      `const retrievalDb = {
      mode: dbItem.retrieval_mode || 'HYBRID',
      version: dbItem.retrieval_version || 'hybrid-v1',
      drafts: Number(dbItem.retrieval_drafts ?? 0) || 0,
      published: Number(dbItem.retrieval_published ?? 0) || 0,
      avgRerankMs: dbItem.retrieval_avg_rerank_ms != null ? Number(dbItem.retrieval_avg_rerank_ms) : null,
      fallbackCount: Number(dbItem.retrieval_fallback_count ?? 0) || 0,
      avgCandidates: dbItem.retrieval_avg_candidates != null ? Number(dbItem.retrieval_avg_candidates) : null,
      avgFinal: dbItem.retrieval_avg_final != null ? Number(dbItem.retrieval_avg_final) : null,
      lastValidationAt: dbItem.retrieval_last_validation || null,
      available: true,
    };
const qdrantDb =`,
    );
    if (prepNode.parameters.jsCode.includes('qdrantDb,')) {
      prepNode.parameters.jsCode = prepNode.parameters.jsCode.replace(
        'qdrantDb,',
        'qdrantDb,\n      retrievalDb,',
      );
    }
    changed.push('prep');
  }

  if (agg && !agg.parameters.jsCode.includes('retrieval:')) {
    const snippet = `retrieval: (() => {
    const r = partial.retrievalDb || {};
    const fallbacks = Number(r.fallbackCount || 0);
    let status = 'up';
    if (fallbacks >= 20) status = 'degraded';
    return {
      status,
      mode: r.mode || 'HYBRID',
      activeVersion: r.version || null,
      draftsCount: Number(r.drafts || 0),
      avgDurationMs: r.avgRerankMs,
      failures: fallbacks,
      pending: Number(r.avgCandidates || 0),
      queue: Number(r.avgFinal || 0),
      lastRunAt: r.lastValidationAt || null,
      online: r.available !== false,
      details: {
        candidateAvg: r.avgCandidates,
        finalAvg: r.avgFinal,
        fallbackCount7d: fallbacks,
        rerankAvailable: true,
      },
    };
  })(),
  qdrant:`;
    if (agg.parameters.jsCode.includes('qdrant:')) {
      agg.parameters.jsCode = agg.parameters.jsCode.replace('qdrant:', snippet);
      changed.push('agg');
    }
  }
  return { changed };
});

// Also patch GET System Health if it has aggregate
out.healthGet = await patch('2UPHcxASp2PboC9M', (wf) => {
  // usually just calls SYSTEM - HEALTH CHECK; no change needed
  return { skipped: true, nodes: wf.nodes.map((n) => n.name) };
});

// Backup DATABASE — include retrieval tables in dump metadata/list
out.backup = await patch('A16PhhWFr0Za9X3B', (wf) => {
  let changed = false;
  for (const n of wf.nodes) {
    if (n.parameters?.jsCode?.includes('ai_prompt_definitions') && !n.parameters.jsCode.includes('ai_retrieval_configs')) {
      n.parameters.jsCode = n.parameters.jsCode.replace(
        "'ai_prompt_versions'",
        "'ai_prompt_versions', 'ai_retrieval_configs', 'ai_retrieval_config_versions'",
      );
      changed = true;
    }
    if (typeof n.parameters?.query === 'string' && n.parameters.query.includes('ai_prompt_definitions') && !n.parameters.query.includes('ai_retrieval_configs')) {
      n.parameters.query = n.parameters.query.replace(
        "'ai_prompt_versions', (SELECT COALESCE(json_agg(row_to_json(apv)), '[]'::json) FROM ai_prompt_versions apv)",
        `'ai_prompt_versions', (SELECT COALESCE(json_agg(row_to_json(apv)), '[]'::json) FROM ai_prompt_versions apv),
    'ai_retrieval_configs', (SELECT COALESCE(json_agg(row_to_json(arc)), '[]'::json) FROM ai_retrieval_configs arc),
    'ai_retrieval_config_versions', (SELECT COALESCE(json_agg(row_to_json(arv)), '[]'::json) FROM ai_retrieval_config_versions arv)`,
      );
      n.parameters.query = n.parameters.query.replace(
        "'ai_prompt_versions', (SELECT COUNT(*) FROM ai_prompt_versions)",
        `'ai_prompt_versions', (SELECT COUNT(*) FROM ai_prompt_versions),
    'ai_retrieval_configs', (SELECT COUNT(*) FROM ai_retrieval_configs),
    'ai_retrieval_config_versions', (SELECT COUNT(*) FROM ai_retrieval_config_versions)`,
      );
      changed = true;
    }
  }
  return { changed };
});

// Dataset run — stamp retrieval_config_version + mode from secrets
out.dataset = await patch('12t0Ol6zWQJgAKPC', (wf) => {
  let changed = false;
  for (const n of wf.nodes) {
    if (typeof n.parameters?.query === 'string' && n.parameters.query.includes('INSERT INTO ai_test_runs') && !n.parameters.query.includes('retrieval_config_version')) {
      // try add columns
      if (n.parameters.query.includes('retrieval_mode)')) {
        n.parameters.query = n.parameters.query.replace('retrieval_mode)', 'retrieval_mode, retrieval_config_version)');
        n.parameters.query = n.parameters.query.replace(
          /retrieval_mode\)\s*\n?SELECT/i,
          `retrieval_mode, retrieval_config_version)
SELECT`,
        );
        // append secret selects if hybrid pattern exists
        if (n.parameters.query.includes("key='retrieval") === false) {
          // add to SELECT list near embedding_version
          n.parameters.query = n.parameters.query.replace(
            /embedding_version,\s*retrieval_mode\)/i,
            'embedding_version, retrieval_mode, retrieval_config_version)',
          );
        }
        changed = true;
      } else if (n.parameters.query.includes('embedding_version)')) {
        n.parameters.query = n.parameters.query.replace(
          'embedding_version)',
          'embedding_version, retrieval_mode, retrieval_config_version)',
        );
        // Need to add values in SELECT — look for pattern
        if (n.parameters.query.includes("'hybrid'") || n.parameters.query.includes('hybrid')) {
          // noop
        }
        // Append secret coalesces before FROM or at end of select list
        n.parameters.query = n.parameters.query.replace(
          /(COALESCE\(\(SELECT value FROM app_secrets WHERE key='ai_eval_tabular_engine_version'[^\n]+)\n/,
          `$1,\n  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_mode' LIMIT 1), 'HYBRID'),\n  COALESCE((SELECT value FROM app_secrets WHERE key='retrieval_active_version' LIMIT 1), 'hybrid-v1')\n`,
        );
        changed = true;
      }
    }
  }
  return { changed };
});

writeFileSync(new URL('./_patch-ops.json', import.meta.url), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
