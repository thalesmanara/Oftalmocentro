// Exported from n8n workflow LJQZ2HrG6qJGN0Q2 (EMBEDDING - ORQUESTRAR)
// activeVersionId=0d4bcb60-a384-4173-bc8f-05c584b27363
export default {
  "name": "EMBEDDING - ORQUESTRAR",
  "nodes": [
    {
      "id": "093ba188-f094-4f01-9402-b9e6e4e91755",
      "name": "Trigger",
      "type": "n8n-nodes-base.executeWorkflowTrigger",
      "typeVersion": 1.2,
      "position": [
        0,
        100
      ],
      "parameters": {
        "inputSource": "workflowInputs",
        "workflowInputs": {
          "values": [
            {
              "name": "versionId",
              "type": "string"
            },
            {
              "name": "documentId",
              "type": "string"
            },
            {
              "name": "requestId",
              "type": "string"
            },
            {
              "name": "userId",
              "type": "string"
            },
            {
              "name": "sessionId",
              "type": "string"
            },
            {
              "name": "force",
              "type": "boolean"
            }
          ]
        }
      }
    },
    {
      "id": "5d02b239-0ea9-40b4-9e51-81d7b3959d06",
      "name": "Preparar contexto",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        220,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const crypto = require('crypto');\nconst t = $input.first().json || {};\nconst versionId = String(t.versionId || '').trim();\nconst documentId = String(t.documentId || '').trim();\nconst requestId = String(t.requestId || '').trim() || crypto.randomUUID();\nconst userId = String(t.userId || '').trim();\nconst sessionId = String(t.sessionId || '').trim();\nconst force = t.force === true || t.force === 'true';\nconst startedAtMs = Date.now();\nif (!versionId) return [{ json: { ok: false, error: 'versionId_required', requestId, startedAtMs } }];\nreturn [{ json: { versionId, documentId, requestId, userId, sessionId, force, startedAtMs, valid: true } }];"
      }
    },
    {
      "id": "a0261560-5f56-44e8-aee4-e158a52aab3f",
      "name": "Contexto ok?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        440,
        100
      ],
      "parameters": {
        "conditions": {
          "combinator": "and",
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 2
          },
          "conditions": [
            {
              "id": "c1",
              "leftValue": "={{ $json.valid === true }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true"
              }
            }
          ]
        },
        "looseTypeValidation": true
      }
    },
    {
      "id": "48ef6c55-e32f-4b8e-a99c-bfa60898f137",
      "name": "Erro contexto",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        660,
        -40
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar contexto').first().json || {};\nreturn [{ json: { ok: false, status: 'FAILED', error: p.error || 'invalid_input', requestId: p.requestId || '', versionId: p.versionId || '', documentId: p.documentId || '' } }];"
      }
    },
    {
      "id": "fa65061a-6cdd-49e3-9476-c7b220c6f29b",
      "name": "Audit STARTED",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        660,
        220
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "jtQvQlqRZ5X5WF9I",
          "cachedResultName": "AUDITORIA - REGISTRAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "requestId": "={{ $('Preparar contexto').first().json.requestId }}",
            "userId": "={{ $('Preparar contexto').first().json.userId }}",
            "sessionId": "={{ $('Preparar contexto').first().json.sessionId }}",
            "action": "EMBEDDING_STARTED",
            "resourceType": "document_version",
            "resourceId": "={{ $('Preparar contexto').first().json.versionId }}",
            "success": true,
            "method": "INTERNAL",
            "path": "/embeddings/orquestrar",
            "statusCode": "={{ 202 }}",
            "durationMs": "={{ 0 }}",
            "beforeData": "={{ null }}",
            "afterData": "={{ null }}",
            "metadata": "={{ { versionId: $('Preparar contexto').first().json.versionId, documentId: $('Preparar contexto').first().json.documentId, force: $('Preparar contexto').first().json.force } }}",
            "skipAudit": false
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "id": "99018115-baa4-4656-96d3-f88206c4a983",
      "name": "SQL started invalidate",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        880,
        220
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar contexto').first().json || {};\nconst vid = String(p.versionId || '').replace(/'/g, \"''\");\nconst force = p.force === true;\nconst inv = force\n  ? \"UPDATE document_chunks SET embedding_status = 'INVALID', embedding_vector = NULL, embedding_updated_at = now(), embedding_next_retry_at = NULL WHERE document_version_id = '\" + vid + \"'::uuid AND embedding_status = 'VALID' AND (embedding_hash IS DISTINCT FROM content_hash OR embedding_vector IS NULL) RETURNING id\"\n  : \"SELECT NULL::uuid AS id WHERE false\";\nconst sql = \"WITH inv AS (\" + inv + \"), upd AS (UPDATE document_versions SET embedding_started_at = COALESCE(embedding_started_at, now()), embedding_status = 'PROCESSING' WHERE id = '\" + vid + \"'::uuid RETURNING id, document_id) SELECT (SELECT COUNT(*)::int FROM inv) AS invalidated, u.id AS \\\"versionId\\\", u.document_id AS \\\"documentId\\\" FROM upd u\";\nreturn [{ json: { sql } }];"
      }
    },
    {
      "id": "3fc626bd-f099-455a-894f-6a1d1ccd8aa5",
      "name": "Marcar started + invalidate",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        1100,
        220
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "={{ $json.sql }}"
      },
      "credentials": {
        "postgres": {
          "id": "XJtGZ5rpCR7BpN0X",
          "name": "Postgres account"
        }
      }
    },
    {
      "id": "9aeaa563-a8d2-46ad-8c51-5d5f0c153a1c",
      "name": "Carregar pending ids",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        1320,
        220
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "SELECT id\nFROM document_chunks\nWHERE document_version_id = '{{ $('Preparar contexto').first().json.versionId }}'::uuid\n  AND embedding_status IN ('PENDING','FAILED','INVALID')\n  AND (embedding_next_retry_at IS NULL OR embedding_next_retry_at <= now())\nORDER BY chunk_order NULLS LAST, id"
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
      "id": "4cab4160-137a-4c48-be0a-4d51600dcca1",
      "name": "Montar lotes",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1540,
        220
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const rows = $input.all().map((i) => i.json).filter((j) => j && j.id);\nconst ids = rows.map((r) => r.id);\nconst batchSize = 16;\nconst batches = [];\nfor (let i = 0; i < ids.length; i += batchSize) {\n  batches.push({ json: { chunkIds: ids.slice(i, i + batchSize), batchIndex: batches.length, totalBatches: Math.ceil(ids.length / batchSize) || 0 } });\n}\nif (!batches.length) {\n  return [{ json: { chunkIds: [], batchIndex: 0, totalBatches: 0, empty: true } }];\n}\nreturn batches;"
      }
    },
    {
      "id": "125a163d-688d-4f24-bc42-545bcd744b10",
      "name": "Loop lotes",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        1760,
        220
      ],
      "parameters": {
        "batchSize": 1
      }
    },
    {
      "id": "e09668a3-22c5-414f-993a-b78a0d2df893",
      "name": "Chamar GERAR",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        1980,
        100
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "D1bbCBEdKuNQc9F5",
          "cachedResultName": "EMBEDDING - GERAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "chunkIds": "={{ $json.chunkIds }}",
            "requestId": "={{ $('Preparar contexto').first().json.requestId }}",
            "userId": "={{ $('Preparar contexto').first().json.userId }}",
            "sessionId": "={{ $('Preparar contexto').first().json.sessionId }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "id": "d0bf3de7-cb25-4e42-b8a1-b352106d140f",
      "name": "Chamar VALIDAR",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        2200,
        320
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "Feli8ssd2KggST6N",
          "cachedResultName": "EMBEDDING - VALIDAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "versionId": "={{ $('Preparar contexto').first().json.versionId }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "executeOnce": true
    },
    {
      "id": "24ee81ca-1eca-4563-8dce-d66636f23e59",
      "name": "Montar resultado",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2420,
        320
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar contexto').first().json || {};\nconst v = $input.first().json || {};\nconst ok = v.ok === true;\nreturn [{ json: {\n  ok,\n  status: v.status || (ok ? 'VALID' : 'FAILED'),\n  versionId: p.versionId,\n  documentId: p.documentId || '',\n  requestId: p.requestId,\n  total: Number(v.total || 0),\n  pending: Number(v.pending || 0),\n  processing: Number(v.processing || 0),\n  valid: Number(v.valid || 0),\n  failed: Number(v.failed || 0),\n  invalid: Number(v.invalid || 0),\n  skipped: Number(v.skipped || 0),\n  durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())),\n} }];"
      }
    },
    {
      "id": "b986cd08-6092-4815-a04b-af090c25afdd",
      "name": "Embedding ok?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        2640,
        320
      ],
      "parameters": {
        "conditions": {
          "combinator": "and",
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 2
          },
          "conditions": [
            {
              "id": "c1",
              "leftValue": "={{ $json.ok === true }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true"
              }
            }
          ]
        },
        "looseTypeValidation": true
      }
    },
    {
      "id": "91b306ae-35ec-4a58-b41a-674d0b937a55",
      "name": "Audit SUCCESS",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        2860,
        200
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "jtQvQlqRZ5X5WF9I",
          "cachedResultName": "AUDITORIA - REGISTRAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "requestId": "={{ $('Montar resultado').first().json.requestId }}",
            "userId": "={{ $('Preparar contexto').first().json.userId }}",
            "sessionId": "={{ $('Preparar contexto').first().json.sessionId }}",
            "action": "EMBEDDING_SUCCESS",
            "resourceType": "document_version",
            "resourceId": "={{ $('Montar resultado').first().json.versionId }}",
            "success": true,
            "method": "INTERNAL",
            "path": "/embeddings/orquestrar",
            "statusCode": "={{ 200 }}",
            "durationMs": "={{ $('Montar resultado').first().json.durationMs }}",
            "beforeData": "={{ null }}",
            "afterData": "={{ null }}",
            "metadata": "={{ { status: $('Montar resultado').first().json.status, valid: $('Montar resultado').first().json.valid, skipped: $('Montar resultado').first().json.skipped, total: $('Montar resultado').first().json.total } }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "id": "9273c6db-6cb4-406b-a53b-259f9777fcbe",
      "name": "Audit FAILED",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        2860,
        440
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "jtQvQlqRZ5X5WF9I",
          "cachedResultName": "AUDITORIA - REGISTRAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "requestId": "={{ $('Montar resultado').first().json.requestId }}",
            "userId": "={{ $('Preparar contexto').first().json.userId }}",
            "sessionId": "={{ $('Preparar contexto').first().json.sessionId }}",
            "action": "EMBEDDING_FAILED",
            "resourceType": "document_version",
            "resourceId": "={{ $('Montar resultado').first().json.versionId }}",
            "success": false,
            "method": "INTERNAL",
            "path": "/embeddings/orquestrar",
            "statusCode": "={{ 500 }}",
            "durationMs": "={{ $('Montar resultado').first().json.durationMs }}",
            "beforeData": "={{ null }}",
            "afterData": "={{ null }}",
            "errorCode": "EMBEDDING_FAILED",
            "metadata": "={{ { status: $('Montar resultado').first().json.status, pending: $('Montar resultado').first().json.pending, failed: $('Montar resultado').first().json.failed, invalid: $('Montar resultado').first().json.invalid } }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "id": "ecfedecc-1063-4177-9f8d-70fec38ede2f",
      "name": "Retorno final",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        3080,
        320
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const r = $('Montar resultado').first().json || {};\nreturn [{ json: r }];"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Preparar contexto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar contexto": {
      "main": [
        [
          {
            "node": "Contexto ok?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Contexto ok?": {
      "main": [
        [
          {
            "node": "Audit STARTED",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Erro contexto",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Audit STARTED": {
      "main": [
        [
          {
            "node": "SQL started invalidate",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "SQL started invalidate": {
      "main": [
        [
          {
            "node": "Marcar started + invalidate",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Marcar started + invalidate": {
      "main": [
        [
          {
            "node": "Carregar pending ids",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Carregar pending ids": {
      "main": [
        [
          {
            "node": "Montar lotes",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Montar lotes": {
      "main": [
        [
          {
            "node": "Loop lotes",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Loop lotes": {
      "main": [
        [
          {
            "node": "Chamar VALIDAR",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Chamar GERAR",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Chamar GERAR": {
      "main": [
        [
          {
            "node": "Loop lotes",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Chamar VALIDAR": {
      "main": [
        [
          {
            "node": "Montar resultado",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Montar resultado": {
      "main": [
        [
          {
            "node": "Embedding ok?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Embedding ok?": {
      "main": [
        [
          {
            "node": "Audit SUCCESS",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Audit FAILED",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Audit SUCCESS": {
      "main": [
        [
          {
            "node": "Retorno final",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Audit FAILED": {
      "main": [
        [
          {
            "node": "Retorno final",
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
