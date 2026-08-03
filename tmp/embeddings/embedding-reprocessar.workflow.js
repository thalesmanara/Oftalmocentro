// Exported from n8n workflow x4bw9IQ5vwJSFh0y (EMBEDDING - REPROCESSAR)
// activeVersionId=402eb74c-4fbf-41a4-b76b-9348de383b6a
export default {
  "name": "EMBEDDING - REPROCESSAR",
  "nodes": [
    {
      "id": "b28ce6f4-a9e9-44fb-92c3-9f83c12e8f20",
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
            },
            {
              "name": "force",
              "type": "boolean"
            },
            {
              "name": "limit",
              "type": "number"
            }
          ]
        }
      }
    },
    {
      "id": "7656c0db-65a7-441c-88ec-0cf72615a6be",
      "name": "Preparar",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        220,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const crypto = require('crypto');\nconst t = $input.first().json || {};\nreturn [{ json: {\n  requestId: String(t.requestId || '').trim() || crypto.randomUUID(),\n  userId: String(t.userId || '').trim(),\n  sessionId: String(t.sessionId || '').trim(),\n  force: t.force !== false,\n  limit: Math.min(50, Math.max(1, Number(t.limit || 20) || 20)),\n  startedAtMs: Date.now(),\n} }];"
      }
    },
    {
      "id": "eab1e11e-11b5-461a-8188-8347c5a792cc",
      "name": "Buscar versões",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        440,
        100
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "SELECT DISTINCT dc.document_version_id AS \"versionId\", dc.document_id AS \"documentId\"\nFROM document_chunks dc\nJOIN document_versions dv ON dv.id = dc.document_version_id\nWHERE (\n  dc.embedding_status IN ('INVALID','FAILED','PENDING')\n  OR (dc.embedding_status = 'VALID' AND (dc.embedding_hash IS DISTINCT FROM dc.content_hash OR dc.embedding_vector IS NULL))\n)\nORDER BY dc.document_version_id\nLIMIT {{ $('Preparar').first().json.limit }}"
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
      "id": "76496daf-9dde-49f1-ae78-27fc86263703",
      "name": "Para itens",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        660,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const rows = $input.all().map((i) => i.json).filter((j) => j && j.versionId);\nif (!rows.length) return [{ json: { empty: true, versionId: '', documentId: '' } }];\nreturn rows.map((r) => ({ json: { ...r, empty: false } }));"
      }
    },
    {
      "id": "d994cbbe-f1ec-49da-8d18-b589458eb76c",
      "name": "Tem versões?",
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
              "leftValue": "={{ $json.empty !== true }}",
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
      "id": "1c71559e-d525-4a35-94f3-4b4e37a59034",
      "name": "Sem trabalho",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1100,
        -40
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar').first().json || {};\nreturn [{ json: { ok: true, processed: 0, requestId: p.requestId, status: 'NOOP' } }];"
      }
    },
    {
      "id": "3b319fb8-41fc-4364-9135-69bf9f72cc95",
      "name": "Loop versões",
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
      "id": "58660065-dd5c-45e9-ac03-29f98b0b8b16",
      "name": "Chamar ORQUESTRAR",
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
            "requestId": "={{ $('Preparar').first().json.requestId }}",
            "userId": "={{ $('Preparar').first().json.userId }}",
            "sessionId": "={{ $('Preparar').first().json.sessionId }}",
            "force": "={{ $('Preparar').first().json.force }}"
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
      "id": "f6f4157c-bd08-4fe7-99ab-cf40223ed79a",
      "name": "Audit REGENERATED",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        1540,
        280
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
            "requestId": "={{ $('Preparar').first().json.requestId }}",
            "userId": "={{ $('Preparar').first().json.userId }}",
            "sessionId": "={{ $('Preparar').first().json.sessionId }}",
            "action": "EMBEDDING_REGENERATED",
            "resourceType": "system",
            "resourceId": "",
            "success": true,
            "method": "INTERNAL",
            "path": "/embeddings/reprocess",
            "statusCode": "={{ 200 }}",
            "durationMs": "={{ Date.now() - $('Preparar').first().json.startedAtMs }}",
            "beforeData": "={{ null }}",
            "afterData": "={{ null }}",
            "metadata": "={{ { mode: 'reprocess' } }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      },
      "executeOnce": true,
      "onError": "continueRegularOutput",
      "alwaysOutputData": true
    },
    {
      "id": "b778a782-1a27-4b03-91db-cff22cc13645",
      "name": "Finalizar reprocess",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1760,
        280
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Preparar').first().json || {};\nlet processed = 0;\ntry { processed = $('Chamar ORQUESTRAR').all().length; } catch (_) { processed = 0; }\nreturn [{ json: { ok: true, processed, requestId: p.requestId, status: 'DONE', durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())) } }];"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Preparar",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar": {
      "main": [
        [
          {
            "node": "Buscar versões",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Buscar versões": {
      "main": [
        [
          {
            "node": "Para itens",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Para itens": {
      "main": [
        [
          {
            "node": "Tem versões?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tem versões?": {
      "main": [
        [
          {
            "node": "Loop versões",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Sem trabalho",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Loop versões": {
      "main": [
        [
          {
            "node": "Audit REGENERATED",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Chamar ORQUESTRAR",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Chamar ORQUESTRAR": {
      "main": [
        [
          {
            "node": "Loop versões",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Audit REGENERATED": {
      "main": [
        [
          {
            "node": "Finalizar reprocess",
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
