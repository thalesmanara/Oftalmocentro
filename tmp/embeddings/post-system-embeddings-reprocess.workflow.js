// Exported from n8n workflow A3ps15dPHWoN2LZf (POST System Embeddings Reprocess)
// activeVersionId=45bb9464-b342-4358-93ff-6ee7d44b292f
export default {
  "name": "POST System Embeddings Reprocess",
  "nodes": [
    {
      "id": "2b67c10b-35c0-40f8-84ca-493fd2152f71",
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [
        0,
        192
      ],
      "parameters": {
        "path": "system/embeddings/reprocess",
        "httpMethod": "POST",
        "responseMode": "responseNode",
        "options": {}
      }
    },
    {
      "id": "7d784cc9-e536-404f-b0e7-a373c0796083",
      "name": "Normalizar request",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        224,
        192
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "cachedResultName": "SYSTEM - NORMALIZAR REQUEST",
          "mode": "id",
          "value": "N3zLpj7Dij4n5p5p"
        }
      }
    },
    {
      "id": "5a25e905-d8de-4f7c-89a8-01a3059b0361",
      "name": "Validar auth",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        448,
        192
      ],
      "parameters": {
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "P5E43ZXSJiI9wFYD",
          "cachedResultName": "AUTH - VALIDAR TOKEN"
        },
        "mode": "once",
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "authorization": "={{ $json.authorization || $json.headers.authorization || $json.headers.Authorization || '' }}",
            "requestId": "={{ $json.requestId || '' }}"
          }
        },
        "options": {
          "waitForSubWorkflow": true
        }
      }
    },
    {
      "id": "c9454284-9cee-4a6e-9d74-998f020f2299",
      "name": "Auth ok?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        672,
        192
      ],
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 2
          },
          "conditions": [
            {
              "id": "a1",
              "leftValue": "={{ $json.ok }}",
              "rightValue": true,
              "operator": {
                "type": "boolean",
                "operation": "true"
              }
            }
          ],
          "combinator": "and"
        },
        "looseTypeValidation": true
      }
    },
    {
      "id": "fdc7c899-f394-42ae-a4e6-063c244cdafd",
      "name": "Validar permissão",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        896,
        96
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "cachedResultName": "AUTH - VALIDAR PERMISSÃO",
          "mode": "id",
          "value": "yXW3rW8EbHXuprRJ"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "isMaster": "={{ $json.user ? $json.user.isMaster === true : false }}",
            "permissions": "={{ $json.permissions || ($json.user && $json.user.permissions) || [] }}",
            "requiredAnyOf": "={{ [] }}",
            "requiredPermission": "editar_configuracoes",
            "sessionId": "={{ $json.sessionId || '' }}",
            "user": "={{ $json.user || null }}",
            "userId": "={{ $json.userId || ($json.user && $json.user.id) || '' }}",
            "requestId": "={{ $json.requestId || $('Normalizar request').first().json.requestId || '' }}"
          }
        }
      }
    },
    {
      "id": "d956b7fa-c2dd-415c-9e96-b5a50c758075",
      "name": "Permissão ok?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        1120,
        96
      ],
      "parameters": {
        "conditions": {
          "combinator": "and",
          "conditions": [
            {
              "id": "p1",
              "leftValue": "={{ $json.ok }}",
              "operator": {
                "operation": "true",
                "type": "boolean"
              },
              "rightValue": true
            }
          ],
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "loose",
            "version": 2
          }
        },
        "looseTypeValidation": true
      }
    },
    {
      "id": "10d0f1a8-db7b-48f3-9a05-b2a7ed9deeb7",
      "name": "Restaurar request",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1344,
        0
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "return [$('Normalizar request').first()];"
      }
    },
    {
      "id": "6c1a2def-c1bd-4841-8291-ed3d94a4784b",
      "name": "Chamar REPROCESSAR",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        1568,
        0
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "mode": "id",
          "value": "x4bw9IQ5vwJSFh0y",
          "cachedResultName": "EMBEDDING - REPROCESSAR"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "requestId": "={{ $('Normalizar request').first().json.requestId }}",
            "userId": "={{ $('Validar auth').first().json.userId || '' }}",
            "sessionId": "={{ $('Validar auth').first().json.sessionId || '' }}",
            "force": "={{ ($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.force) !== false }}",
            "limit": "={{ Number(($('Normalizar request').first().json.body && $('Normalizar request').first().json.body.limit) || 20) }}"
          }
        }
      }
    },
    {
      "id": "e4bec1a1-11d7-4ff9-ae43-c9b4c8697b55",
      "name": "Montar resposta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1792,
        0
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const r = $input.first().json || {};\nconst norm = $('Normalizar request').first().json;\nlet userId = ''; let sessionId = '';\ntry { const auth = $('Validar auth').first().json; userId = auth.userId || ''; sessionId = auth.sessionId || ''; } catch (_) {}\nreturn [{ json: {\n  data: { ok: r.ok !== false, processed: Number(r.processed || 0), status: r.status || 'DONE', requestId: r.requestId || norm.requestId },\n  asList: false,\n  statusCode: 200,\n  requestId: norm.requestId,\n  requestStartedAtMs: norm.requestStartedAtMs,\n  method: norm.method,\n  path: norm.path,\n  userId,\n  sessionId,\n} }];"
      }
    },
    {
      "id": "0d2edbc7-c000-45d7-8f54-505b1dc8c960",
      "name": "Preparar sucesso",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        2016,
        0
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "cachedResultName": "SYSTEM - PREPARAR SUCESSO",
          "mode": "id",
          "value": "zE5LRjZfbXw8Ymll"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "asList": "={{ $json.asList }}",
            "data": "={{ $json.data }}",
            "requestId": "={{ $json.requestId || $('Normalizar request').first().json.requestId }}",
            "statusCode": "={{ $json.statusCode }}",
            "requestStartedAtMs": "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
            "method": "={{ $('Normalizar request').first().json.method }}",
            "path": "={{ $('Normalizar request').first().json.path }}",
            "userId": "={{ $('Validar auth').first().json.userId || '' }}",
            "sessionId": "={{ $('Validar auth').first().json.sessionId || '' }}"
          }
        }
      }
    },
    {
      "id": "d661230d-69ae-4c5d-aac1-56bf4004323c",
      "name": "Registrar auditoria",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        2240,
        0
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "cachedResultName": "AUDITORIA - REGISTRAR",
          "mode": "id",
          "value": "jtQvQlqRZ5X5WF9I"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "requestId": "={{ $json.requestId }}",
            "tracking": "={{ $json.tracking }}",
            "response": "={{ $json.response }}",
            "responseHeaders": "={{ $json.responseHeaders }}",
            "headers": "={{ $('Normalizar request').first().json.headers || {} }}",
            "action": "EMBEDDING_REPROCESS_REQUESTED",
            "resourceType": "system",
            "resourceId": "",
            "success": "={{ $json.tracking?.success !== false }}",
            "userId": "={{ $json.tracking?.userId || $('Validar auth').first().json.userId || '' }}",
            "sessionId": "={{ $json.tracking?.sessionId || $('Validar auth').first().json.sessionId || '' }}",
            "method": "={{ $json.tracking?.method || $('Normalizar request').first().json.method }}",
            "path": "={{ $json.tracking?.path || $('Normalizar request').first().json.path }}",
            "statusCode": "={{ $json.statusCode }}",
            "durationMs": "={{ $json.durationMs }}",
            "beforeData": "={{ null }}",
            "afterData": "={{ null }}",
            "metadata": "={{ { processed: ($('Montar resposta').first().json.data && $('Montar resposta').first().json.data.processed) || 0 } }}"
          }
        },
        "onError": "continueRegularOutput",
        "alwaysOutputData": true
      }
    },
    {
      "id": "aed4b843-18b0-4c2c-806c-4b7b46df7853",
      "name": "Repassar resposta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2464,
        0
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const prep = $('Preparar sucesso').first().json || {};\nconst audit = $input.first().json || {};\nreturn [{ json: audit.response != null ? audit : prep }];"
      }
    },
    {
      "id": "99fa8911-eb3f-4345-bf2d-160d92c853ec",
      "name": "Respond to Webhook",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.5,
      "position": [
        2688,
        0
      ],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.response }}",
        "options": {
          "responseCode": "={{ $json.statusCode }}",
          "responseHeaders": {
            "entries": [
              {
                "name": "X-Request-Id",
                "value": "={{ $json.responseHeaders && $json.responseHeaders[\"X-Request-Id\"] ? $json.responseHeaders[\"X-Request-Id\"] : ($json.requestId || \"\") }}"
              },
              {
                "name": "X-Response-Time-Ms",
                "value": "={{ $json.responseHeaders && $json.responseHeaders[\"X-Response-Time-Ms\"] ? $json.responseHeaders[\"X-Response-Time-Ms\"] : String($json.durationMs || 0) }}"
              }
            ]
          }
        }
      }
    },
    {
      "id": "fe72d8f4-5de4-4183-b47c-f0bd8cdb452f",
      "name": "Preparar erro 403",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        1344,
        192
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "cachedResultName": "SYSTEM - PREPARAR ERRO",
          "mode": "id",
          "value": "r3iSBV1ClKOxS2UI"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "code": "={{ $json.error && $json.error.code ? $json.error.code : 'FORBIDDEN' }}",
            "message": "={{ $json.error && $json.error.message ? $json.error.message : 'Você não possui permissão para executar esta ação.' }}",
            "requestId": "={{ $('Normalizar request').first().json.requestId }}",
            "statusCode": 403,
            "requestStartedAtMs": "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
            "method": "={{ $('Normalizar request').first().json.method }}",
            "path": "={{ $('Normalizar request').first().json.path }}"
          }
        }
      }
    },
    {
      "id": "be47a77c-623e-46dc-a7b9-52cd146bba3b",
      "name": "Respond 403",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.5,
      "position": [
        1568,
        192
      ],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.response }}",
        "options": {
          "responseCode": 403,
          "responseHeaders": {
            "entries": [
              {
                "name": "X-Request-Id",
                "value": "={{ $json.responseHeaders && $json.responseHeaders[\"X-Request-Id\"] ? $json.responseHeaders[\"X-Request-Id\"] : ($json.requestId || \"\") }}"
              },
              {
                "name": "X-Response-Time-Ms",
                "value": "={{ $json.responseHeaders && $json.responseHeaders[\"X-Response-Time-Ms\"] ? $json.responseHeaders[\"X-Response-Time-Ms\"] : String($json.durationMs || 0) }}"
              }
            ]
          }
        }
      }
    },
    {
      "id": "bff16dfc-62e5-49ce-859d-c34144f59b9c",
      "name": "Preparar erro 401",
      "type": "n8n-nodes-base.executeWorkflow",
      "typeVersion": 1.3,
      "position": [
        896,
        288
      ],
      "parameters": {
        "mode": "once",
        "options": {
          "waitForSubWorkflow": true
        },
        "source": "database",
        "workflowId": {
          "__rl": true,
          "cachedResultName": "SYSTEM - PREPARAR ERRO",
          "mode": "id",
          "value": "r3iSBV1ClKOxS2UI"
        },
        "workflowInputs": {
          "mappingMode": "defineBelow",
          "value": {
            "code": "={{ $json.error && $json.error.code ? $json.error.code : 'UNAUTHORIZED' }}",
            "message": "={{ $json.error && $json.error.message ? $json.error.message : 'Autenticação obrigatória.' }}",
            "requestId": "={{ $('Normalizar request').first().json.requestId }}",
            "statusCode": 401,
            "requestStartedAtMs": "={{ $('Normalizar request').first().json.requestStartedAtMs }}",
            "method": "={{ $('Normalizar request').first().json.method }}",
            "path": "={{ $('Normalizar request').first().json.path }}"
          }
        }
      }
    },
    {
      "id": "fee422a6-c2ba-4ddd-94be-cd62e0eb3ee2",
      "name": "Respond 401",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1.5,
      "position": [
        1120,
        288
      ],
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ $json.response }}",
        "options": {
          "responseCode": 401,
          "responseHeaders": {
            "entries": [
              {
                "name": "X-Request-Id",
                "value": "={{ $json.responseHeaders && $json.responseHeaders[\"X-Request-Id\"] ? $json.responseHeaders[\"X-Request-Id\"] : ($json.requestId || \"\") }}"
              },
              {
                "name": "X-Response-Time-Ms",
                "value": "={{ $json.responseHeaders && $json.responseHeaders[\"X-Response-Time-Ms\"] ? $json.responseHeaders[\"X-Response-Time-Ms\"] : String($json.durationMs || 0) }}"
              }
            ]
          }
        }
      }
    }
  ],
  "connections": {
    "Webhook": {
      "main": [
        [
          {
            "node": "Normalizar request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Normalizar request": {
      "main": [
        [
          {
            "node": "Validar auth",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validar auth": {
      "main": [
        [
          {
            "node": "Auth ok?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Auth ok?": {
      "main": [
        [
          {
            "node": "Validar permissão",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preparar erro 401",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validar permissão": {
      "main": [
        [
          {
            "node": "Permissão ok?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Permissão ok?": {
      "main": [
        [
          {
            "node": "Restaurar request",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Preparar erro 403",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Restaurar request": {
      "main": [
        [
          {
            "node": "Chamar REPROCESSAR",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Chamar REPROCESSAR": {
      "main": [
        [
          {
            "node": "Montar resposta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Montar resposta": {
      "main": [
        [
          {
            "node": "Preparar sucesso",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar sucesso": {
      "main": [
        [
          {
            "node": "Registrar auditoria",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Registrar auditoria": {
      "main": [
        [
          {
            "node": "Repassar resposta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Repassar resposta": {
      "main": [
        [
          {
            "node": "Respond to Webhook",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar erro 403": {
      "main": [
        [
          {
            "node": "Respond 403",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Preparar erro 401": {
      "main": [
        [
          {
            "node": "Respond 401",
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
