// Exported from n8n workflow HympisbYzMo0mQYP (Schedule - Embeddings Fila)
// activeVersionId=2da17f3a-48ba-4141-809a-250a5a98441e
export default {
  "name": "Schedule - Embeddings Fila",
  "nodes": [
    {
      "id": "a978988c-b260-45bf-86f9-3147bb60bf47",
      "name": "Every 5 minutes",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.3,
      "position": [
        0,
        100
      ],
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "minutes",
              "minutesInterval": 5
            }
          ]
        }
      }
    },
    {
      "id": "731e3246-b581-4ed4-816e-c10def741b01",
      "name": "Prep schedule",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        220,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const crypto = require('crypto');\nreturn [{ json: { requestId: crypto.randomUUID(), userId: 'system', sessionId: '' } }];"
      }
    },
    {
      "id": "591deb6f-2692-4e97-98ec-8e03bbc0e1e6",
      "name": "Chamar FILA",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        440,
        100
      ],
      "parameters": {
        "mode": "once",
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "3BkmtrasXs1lORtL",
          "cachedResultName": "EMBEDDING - FILA"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "requestId": "={{ $json.requestId }}",
            "userId": "={{ $json.userId }}",
            "sessionId": "={{ $json.sessionId }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      }
    }
  ],
  "connections": {
    "Every 5 minutes": {
      "main": [
        [
          {
            "node": "Prep schedule",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Prep schedule": {
      "main": [
        [
          {
            "node": "Chamar FILA",
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
