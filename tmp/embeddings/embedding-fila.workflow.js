// Exported from n8n workflow 3BkmtrasXs1lORtL (EMBEDDING - FILA)
// activeVersionId=2a10a262-da0a-49af-9eb4-3562569defd5
export default {
  "name": "EMBEDDING - FILA",
  "nodes": [
    {
      "id": "6ae8b674-c81a-40ab-8ec8-fdb3276adaf7",
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
            }
          ]
        }
      }
    },
    {
      "id": "73e9ebf9-feac-483a-b300-7d7519d65550",
      "name": "Preparar fila",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        220,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const crypto = require('crypto');\nconst t = $input.first().json || {};\nreturn [{ json: {\n  requestId: String(t.requestId || '').trim() || crypto.randomUUID(),\n  userId: String(t.userId || '').trim() || 'system',\n  sessionId: String(t.sessionId || '').trim(),\n  startedAtMs: Date.now(),\n} }];"
      }
    },
    {
      "id": "a775c5e6-2471-4ae8-be30-e0360bce4ec1",
      "name": "Pick versões",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        440,
        100
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "SELECT document_version_id AS \"versionId\", MIN(document_id::text)::uuid AS \"documentId\", COUNT(*)::int AS pending\nFROM document_chunks\nWHERE embedding_status IN ('PENDING','FAILED','INVALID')\n  AND (embedding_next_retry_at IS NULL OR embedding_next_retry_at <= now())\nGROUP BY document_version_id\nORDER BY MIN(COALESCE(embedding_next_retry_at, '-infinity'::timestamptz)), document_version_id\nLIMIT 3"
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
      "id": "3898c1c6-9a13-4242-8b79-ec1ce7aed020",
      "name": "Itens fila",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        660,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const rows = $input.all().map((i) => i.json).filter((j) => j && j.versionId);\nif (!rows.length) return [{ json: { empty: true } }];\nreturn rows.map((r) => ({ json: { ...r, empty: false } }));"
      }
    },
    {
      "id": "9adf4477-1f2e-4c8a-8e0a-95c0e5425b9f",
      "name": "Fila vazia?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        880,
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
              "leftValue": "={{ $json.empty === true }}",
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
      "id": "8fe6497a-a3d7-49cc-a4a6-de4828c42101",
      "name": "Fila noop",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1100,
        -40
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar fila').first().json || {};\nreturn [{ json: { ok: true, processed: 0, requestId: p.requestId, status: 'IDLE' } }];"
      }
    },
    {
      "id": "472b3a96-865e-48e0-ab0a-9b355fc7bb2d",
      "name": "Loop fila",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [
        1100,
        200
      ],
      "parameters": {
        "batchSize": 1
      }
    },
    {
      "id": "34f660d3-8244-44c1-9f65-7a174b2616b2",
      "name": "ORQUESTRAR fila",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        1320,
        80
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "LJQZ2HrG6qJGN0Q2",
          "cachedResultName": "EMBEDDING - ORQUESTRAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "versionId": "={{ $json.versionId }}",
            "documentId": "={{ $json.documentId }}",
            "requestId": "={{ $('Preparar fila').first().json.requestId }}",
            "userId": "={{ $('Preparar fila').first().json.userId }}",
            "sessionId": "={{ $('Preparar fila').first().json.sessionId }}",
            "force": false
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
      "id": "3db3fd85-ce2e-4d47-ae6a-0fceafcce75a",
      "name": "Finalizar fila",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1540,
        280
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar fila').first().json || {};\nlet processed = 0;\ntry { processed = $('ORQUESTRAR fila').all().filter((i) => i.json && i.json.versionId).length; } catch (_) {}\nreturn [{ json: { ok: true, processed, requestId: p.requestId, status: 'DONE', durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())) } }];"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Preparar fila",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar fila": {
      "main": [
        [
          {
            "node": "Pick versões",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Pick versões": {
      "main": [
        [
          {
            "node": "Itens fila",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Itens fila": {
      "main": [
        [
          {
            "node": "Fila vazia?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Fila vazia?": {
      "main": [
        [
          {
            "node": "Fila noop",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Loop fila",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Loop fila": {
      "main": [
        [
          {
            "node": "Finalizar fila",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "ORQUESTRAR fila",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "ORQUESTRAR fila": {
      "main": [
        [
          {
            "node": "Loop fila",
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
