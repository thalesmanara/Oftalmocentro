// Exported from n8n workflow Feli8ssd2KggST6N (EMBEDDING - VALIDAR)
// activeVersionId=d7f8438b-955a-438b-9849-7ff45289c476
export default {
  "name": "EMBEDDING - VALIDAR",
  "nodes": [
    {
      "id": "01efe58e-a08c-4fbd-8986-66ff1513c512",
      "name": "Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.2,
      "position": [
        0,
        0
      ],
      "parameters": {
        "inputSource": "workflowInputs",
        "workflowInputs": {
          "values": [
            {
              "name": "versionId",
              "type": "string"
            }
          ]
        }
      }
    },
    {
      "id": "7d9b91d4-d544-4134-8551-48918e4c53df",
      "name": "Agregar status",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        224,
        0
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "=WITH stats AS (\n  SELECT\n    COUNT(*)::int AS total,\n    COUNT(*) FILTER (WHERE embedding_status = 'PENDING')::int AS pending,\n    COUNT(*) FILTER (WHERE embedding_status = 'PROCESSING')::int AS processing,\n    COUNT(*) FILTER (WHERE embedding_status = 'VALID')::int AS valid,\n    COUNT(*) FILTER (WHERE embedding_status = 'FAILED')::int AS failed,\n    COUNT(*) FILTER (WHERE embedding_status = 'INVALID')::int AS invalid,\n    COUNT(*) FILTER (WHERE embedding_status = 'SKIPPED')::int AS skipped,\n    ROUND(AVG(embedding_generation_ms) FILTER (WHERE embedding_generation_ms IS NOT NULL), 2) AS avg_ms,\n    MAX(embedding_model) FILTER (WHERE embedding_status = 'VALID') AS model,\n    MAX(embedding_dimensions) FILTER (WHERE embedding_status = 'VALID') AS dimensions\n  FROM document_chunks\n  WHERE document_version_id = '{{ $json.versionId }}'::uuid\n),\nupd AS (\n  UPDATE document_versions dv SET\n    embedding_pending_count = s.pending + s.processing,\n    embedding_valid_count = s.valid,\n    embedding_failed_count = s.failed + s.invalid,\n    embedding_model = COALESCE(s.model, dv.embedding_model),\n    embedding_dimensions = COALESCE(s.dimensions, dv.embedding_dimensions),\n    embedding_avg_ms = s.avg_ms,\n    embedding_status = CASE\n      WHEN s.total = 0 THEN COALESCE(dv.embedding_status, 'SKIPPED')\n      WHEN (s.pending + s.processing + s.failed + s.invalid) = 0 THEN 'VALID'\n      WHEN s.processing > 0 THEN 'PROCESSING'\n      WHEN s.failed + s.invalid > 0 AND s.pending = 0 AND s.processing = 0 THEN 'FAILED'\n      ELSE 'PENDING'\n    END,\n    embedding_completed_at = CASE\n      WHEN (s.pending + s.processing + s.failed + s.invalid) = 0 THEN now()\n      ELSE dv.embedding_completed_at\n    END,\n    embedding_started_at = COALESCE(dv.embedding_started_at, now())\n  FROM stats s\n  WHERE dv.id = '{{ $json.versionId }}'::uuid\n  RETURNING dv.id, dv.embedding_status, dv.embedding_pending_count, dv.embedding_valid_count, dv.embedding_failed_count, dv.embedding_model, dv.embedding_dimensions, dv.embedding_avg_ms\n)\nSELECT\n  u.id AS \"versionId\",\n  u.embedding_status AS \"embeddingStatus\",\n  u.embedding_pending_count AS \"pendingCount\",\n  u.embedding_valid_count AS \"validCount\",\n  u.embedding_failed_count AS \"failedCount\",\n  u.embedding_model AS \"embeddingModel\",\n  u.embedding_dimensions AS \"embeddingDimensions\",\n  u.embedding_avg_ms AS \"avgMs\",\n  s.total,\n  s.pending,\n  s.processing,\n  s.valid,\n  s.failed,\n  s.invalid,\n  s.skipped\nFROM upd u CROSS JOIN stats s;"
      },
      "credentials": {
        "postgres": {
          "id": "XJtGZ5rpCR7BpN0X",
          "name": "Postgres account"
        }
      },
      "alwaysOutputData": true
    },
    {
      "id": "538bbc99-222d-41f4-9aa0-ebb84889921f",
      "name": "Finalizar validacao",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        448,
        0
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const row = $input.first().json || {};\nconst pending = Number(row.pending || 0);\nconst processing = Number(row.processing || 0);\nconst failed = Number(row.failed || 0);\nconst invalid = Number(row.invalid || 0);\nconst ok = pending === 0 && processing === 0 && failed === 0 && invalid === 0;\nreturn [{\n  json: {\n    ok,\n    versionId: row.versionId || $('Trigger').first().json.versionId,\n    status: row.embeddingStatus || (ok ? 'VALID' : 'PENDING'),\n    total: Number(row.total || 0),\n    pending,\n    processing,\n    valid: Number(row.valid || 0),\n    failed,\n    invalid,\n    skipped: Number(row.skipped || 0),\n    pendingCount: Number(row.pendingCount || 0),\n    validCount: Number(row.validCount || 0),\n    failedCount: Number(row.failedCount || 0),\n    embeddingModel: row.embeddingModel || null,\n    embeddingDimensions: row.embeddingDimensions != null ? Number(row.embeddingDimensions) : null,\n    avgMs: row.avgMs != null ? Number(row.avgMs) : null,\n  },\n}];"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Agregar status",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Agregar status": {
      "main": [
        [
          {
            "node": "Finalizar validacao",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "availableInMCP": true
  },
  "meta": {
    "aiBuilderAssisted": true,
    "builderVariant": "mcp"
  }
};
