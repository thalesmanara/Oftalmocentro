// Exported from n8n workflow D1bbCBEdKuNQc9F5 (EMBEDDING - GERAR)
// activeVersionId=44289b21-2260-4c29-95c3-c08ce4d28806
export default {
  "name": "EMBEDDING - GERAR",
  "nodes": [
    {
      "id": "128008ad-23d0-42fe-a8b2-6fb0a1400199",
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
              "name": "chunkIds",
              "type": "array"
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
            }
          ]
        }
      }
    },
    {
      "id": "49abbc20-b8f7-4da9-b9bd-0f8f5f7640f5",
      "name": "Normalizar entrada",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        240,
        100
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const item = $input.first().json || {};\nconst UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\nlet ids = item.chunkIds;\nif (typeof ids === 'string') {\n  try { ids = JSON.parse(ids); } catch (_) { ids = ids.split(/[\\s,]+/); }\n}\nif (!Array.isArray(ids)) ids = [];\nconst chunkIds = [...new Set(ids.map((x) => String(x || '').trim()).filter((x) => UUID_RE.test(x)))];\nconst requestId = String(item.requestId || '').trim();\nconst userId = String(item.userId || '').trim();\nconst sessionId = String(item.sessionId || '').trim();\nconst startedAtMs = Date.now();\nif (!chunkIds.length) {\n  return [{ json: { ok: true, empty: true, requestId, userId, sessionId, startedAtMs, total: 0, skippedValid: 0, skippedEmpty: 0, generated: 0, failed: 0, pending: 0 } }];\n}\nconst idList = chunkIds.map((id) => \"'\" + id.replace(/'/g, \"''\") + \"'::uuid\").join(',');\nconst loadSql =\n  'SELECT id, document_id AS \"documentId\", document_version_id AS \"versionId\", ' +\n  \"COALESCE(chunk_text, '') AS \\\"chunkText\\\", content_hash AS \\\"contentHash\\\", \" +\n  'embedding_status AS \"embeddingStatus\", embedding_hash AS \"embeddingHash\", ' +\n  'embedding_attempts AS \"embeddingAttempts\", ' +\n  '(embedding_vector IS NOT NULL) AS \"hasVector\" ' +\n  'FROM document_chunks WHERE id IN (' + idList + ')';\nreturn [{ json: { ok: true, empty: false, chunkIds, idList, loadSql, requestId, userId, sessionId, startedAtMs } }];"
      }
    },
    {
      "id": "9b60496b-0190-4b9c-bd94-4d09ac9bd2df",
      "name": "Entrada vazia?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        480,
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
      "id": "45b919a8-085a-4c50-b947-219ab9257a7d",
      "name": "Finalizar vazio",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        720,
        -40
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const n = $('Normalizar entrada').first().json || {};\nreturn [{ json: { ok: true, requestId: n.requestId || '', total: 0, skippedValid: 0, skippedEmpty: 0, generated: 0, failed: 0, pending: 0, durationMs: Math.max(0, Date.now() - Number(n.startedAtMs || Date.now())) } }];"
      }
    },
    {
      "id": "82d7b740-aef6-4876-98f8-369934634037",
      "name": "Carregar secrets",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        720,
        220
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "SELECT\n  MAX(CASE WHEN key = 'embedding_model' THEN value END) AS model,\n  MAX(CASE WHEN key = 'embedding_dimensions' THEN value END) AS dimensions,\n  MAX(CASE WHEN key = 'embedding_max_retries' THEN value END) AS max_retries,\n  MAX(CASE WHEN key = 'embedding_engine_version' THEN value END) AS engine_version,\n  MAX(CASE WHEN key = 'embedding_timeout_ms' THEN value END) AS timeout_ms\nFROM app_secrets\nWHERE key IN ('embedding_model','embedding_dimensions','embedding_max_retries','embedding_engine_version','embedding_timeout_ms');"
      },
      "credentials": {
        "postgres": {
          "id": "XJtGZ5rpCR7BpN0X",
          "name": "Postgres account"
        }
      }
    },
    {
      "id": "feb056fe-a39d-42db-b2b6-ed9780d2c7c6",
      "name": "Carregar chunks",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        960,
        220
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "={{ $('Normalizar entrada').first().json.loadSql }}"
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
      "id": "eca3cae0-29e0-4587-a748-5e504f310000",
      "name": "Classificar chunks",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1200,
        220
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const norm = $('Normalizar entrada').first().json || {};\nconst secrets = $('Carregar secrets').first().json || {};\nconst rows = $input.all().map((i) => i.json).filter((j) => j && j.id);\nconst model = String(secrets.model || 'text-embedding-3-small');\nconst dimensions = Number(secrets.dimensions || 1536) || 1536;\nconst maxRetries = Number(secrets.max_retries || 3) || 3;\nconst engineVersion = Number(String(secrets.engine_version || '1').split('.')[0]) || 1;\nconst timeoutMs = Number(secrets.timeout_ms || 60000) || 60000;\nconst skippedValid = [];\nconst skippedEmpty = [];\nconst toProcess = [];\nfor (const row of rows) {\n  const text = String(row.chunkText || '').trim();\n  const contentHash = String(row.contentHash || '').trim();\n  const status = String(row.embeddingStatus || '');\n  const embHash = String(row.embeddingHash || '').trim();\n  const hasVector = row.hasVector === true || row.hasVector === 't' || row.hasVector === 'true';\n  if (!text) { skippedEmpty.push(row.id); continue; }\n  if (status === 'VALID' && hasVector && contentHash && embHash && contentHash === embHash) {\n    skippedValid.push(row.id); continue;\n  }\n  toProcess.push({ id: row.id, text, contentHash });\n}\nfunction esc(s) { return String(s ?? '').replace(/'/g, \"''\"); }\nlet markSkippedSql = 'SELECT 0 AS noop WHERE false';\nif (skippedEmpty.length) {\n  markSkippedSql = \"UPDATE document_chunks SET embedding_status = 'SKIPPED', embedding_vector = NULL, embedding_hash = NULL, embedding_updated_at = now(), embedding_last_error = NULL, embedding_next_retry_at = NULL WHERE id IN (\" + skippedEmpty.map((id) => \"'\" + esc(id) + \"'::uuid\").join(',') + \") RETURNING id\";\n}\nlet markProcessingSql = 'SELECT 0 AS noop WHERE false';\nif (toProcess.length) {\n  markProcessingSql = \"UPDATE document_chunks SET embedding_status = 'PROCESSING', embedding_updated_at = now(), embedding_last_error = NULL WHERE id IN (\" + toProcess.map((c) => \"'\" + esc(c.id) + \"'::uuid\").join(',') + \") RETURNING id\";\n}\nconst openaiBody = { model, input: toProcess.map((c) => c.text), dimensions };\nreturn [{ json: { requestId: norm.requestId, userId: norm.userId, sessionId: norm.sessionId, startedAtMs: norm.startedAtMs, model, dimensions, maxRetries, engineVersion, timeoutMs, total: rows.length, skippedValid: skippedValid.length, skippedEmpty: skippedEmpty.length, toProcessCount: toProcess.length, toProcessIds: toProcess.map((c) => c.id), toProcessHashes: toProcess.map((c) => c.contentHash), markSkippedSql, markProcessingSql, openaiBody, hasWork: toProcess.length > 0 } }];"
      }
    },
    {
      "id": "6769f3ba-da7f-41a2-9214-b92971d0e4e5",
      "name": "Marcar SKIPPED",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        1440,
        220
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "={{ $json.markSkippedSql }}"
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
      "id": "2b555ad5-64bd-4af0-ae15-301ace8983e0",
      "name": "Tem trabalho?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2.3,
      "position": [
        1680,
        220
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
              "leftValue": "={{ $('Classificar chunks').first().json.hasWork === true }}",
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
      "id": "3bccbc60-bad6-4c31-8525-6b2c3c421fbd",
      "name": "Finalizar sem trabalho",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        1920,
        380
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const cls = $('Classificar chunks').first().json || {};\nreturn [{ json: { ok: true, requestId: cls.requestId || '', total: Number(cls.total || 0), skippedValid: Number(cls.skippedValid || 0), skippedEmpty: Number(cls.skippedEmpty || 0), generated: 0, failed: 0, pending: 0, durationMs: Math.max(0, Date.now() - Number(cls.startedAtMs || Date.now())) } }];"
      }
    },
    {
      "id": "5e29fd16-1b0d-47be-a2ce-0c41a8936986",
      "name": "Marcar PROCESSING",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        1920,
        80
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "={{ $('Classificar chunks').first().json.markProcessingSql }}"
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
      "id": "027ce64c-03f8-4dea-b53a-685ca4b16a41",
      "name": "OpenAI Embeddings",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.4,
      "position": [
        2160,
        80
      ],
      "parameters": {
        "method": "POST",
        "url": "https://api.openai.com/v1/embeddings",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "openAiApi",
        "sendBody": true,
        "contentType": "json",
        "specifyBody": "json",
        "jsonBody": "={{ $('Classificar chunks').first().json.openaiBody }}",
        "options": {
          "timeout": "={{ $('Classificar chunks').first().json.timeoutMs || 60000 }}",
          "response": {
            "response": {
              "fullResponse": true,
              "neverError": true
            }
          }
        }
      },
      "credentials": {
        "openAiApi": {
          "id": "g6QTP6n02dss9A0d",
          "name": "OpenAI account"
        }
      },
      "alwaysOutputData": true,
      "onError": "continueRegularOutput"
    },
    {
      "id": "fd568ee3-de5b-4fc6-9c06-566e08a2df62",
      "name": "Processar resposta",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        2400,
        80
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const cls = $('Classificar chunks').first().json || {};\nconst resp = $input.first().json || {};\nconst statusCode = Number(resp.statusCode ?? resp.status ?? 0);\nlet body = resp.body ?? resp.data ?? resp;\nif (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }\nconst okHttp = statusCode >= 200 && statusCode < 300;\nconst data = Array.isArray(body && body.data) ? body.data : [];\nconst ids = cls.toProcessIds || [];\nconst hashes = cls.toProcessHashes || [];\nconst generationMs = Math.max(0, Date.now() - Number(cls.startedAtMs || Date.now()));\nconst tokenCount = body && body.usage ? Number(body.usage.total_tokens || body.usage.prompt_tokens || 0) : 0;\nconst dimensions = Number(cls.dimensions || 1536) || 1536;\nconst model = String(cls.model || 'text-embedding-3-small');\nconst engineVersion = Number(cls.engineVersion || 1) || 1;\nconst maxRetries = Number(cls.maxRetries || 3) || 3;\nfunction esc(s) { return String(s ?? '').replace(/'/g, \"''\"); }\nlet persistSql = 'SELECT 0 AS noop WHERE false';\nlet failSql = 'SELECT 0 AS noop WHERE false';\nlet generated = 0;\nlet failed = 0;\nif (okHttp && data.length) {\n  const byIndex = new Map();\n  for (const item of data) byIndex.set(Number(item.index), item.embedding);\n  const values = [];\n  for (let i = 0; i < ids.length; i++) {\n    const emb = byIndex.get(i);\n    if (!Array.isArray(emb) || !emb.length) { failed += 1; continue; }\n    generated += 1;\n    const vectorJson = JSON.stringify(emb).replace(/'/g, \"''\");\n    const hash = esc(hashes[i] || '');\n    values.push(\"('\" + esc(ids[i]) + \"'::uuid, '\" + vectorJson + \"'::jsonb, '\" + hash + \"', '\" + esc(model) + \"', \" + dimensions + \", \" + engineVersion + \", \" + generationMs + \", \" + (tokenCount || 'NULL') + \")\");\n  }\n  if (values.length) {\n    persistSql = \"UPDATE document_chunks AS dc SET embedding_vector = v.vec, embedding_status = 'VALID', embedding_hash = v.content_hash, content_hash = COALESCE(NULLIF(dc.content_hash, ''), v.content_hash), embedding_model = v.model, embedding_dimensions = v.dims, embedding_version = v.eng_ver, embedding_generation_ms = v.gen_ms, embedding_token_count = v.tokens, embedding_created_at = COALESCE(dc.embedding_created_at, now()), embedding_updated_at = now(), embedding_last_error = NULL, embedding_next_retry_at = NULL FROM (VALUES \" + values.join(',') + \") AS v(id, vec, content_hash, model, dims, eng_ver, gen_ms, tokens) WHERE dc.id = v.id RETURNING dc.id\";\n  }\n  const missingIds = ids.filter((_, i) => !byIndex.has(i) || !Array.isArray(byIndex.get(i)) || !byIndex.get(i).length);\n  if (missingIds.length) {\n    failSql = \"UPDATE document_chunks SET embedding_attempts = embedding_attempts + 1, embedding_last_error = 'missing_embedding_in_response', embedding_status = CASE WHEN embedding_attempts + 1 >= \" + maxRetries + \" THEN 'FAILED' ELSE 'PENDING' END, embedding_next_retry_at = now() + ((POWER(2, LEAST(embedding_attempts + 1, 6))::int || ' minutes')::interval), embedding_updated_at = now(), embedding_vector = NULL WHERE id IN (\" + missingIds.map((id) => \"'\" + esc(id) + \"'::uuid\").join(',') + \") RETURNING id, embedding_status\";\n  }\n} else {\n  failed = ids.length;\n  const errMsg = esc((body && (body.error && (body.error.message || body.error.code))) || resp.error || ('http_' + statusCode) || 'openai_embeddings_failed').slice(0, 500);\n  if (ids.length) {\n    failSql = \"UPDATE document_chunks SET embedding_attempts = embedding_attempts + 1, embedding_last_error = '\" + errMsg + \"', embedding_status = CASE WHEN embedding_attempts + 1 >= \" + maxRetries + \" THEN 'FAILED' ELSE 'PENDING' END, embedding_next_retry_at = now() + ((POWER(2, LEAST(embedding_attempts + 1, 6))::int || ' minutes')::interval), embedding_updated_at = now(), embedding_vector = NULL WHERE id IN (\" + ids.map((id) => \"'\" + esc(id) + \"'::uuid\").join(',') + \") RETURNING id, embedding_status\";\n  }\n}\nreturn [{ json: { requestId: cls.requestId, userId: cls.userId, sessionId: cls.sessionId, startedAtMs: cls.startedAtMs, total: cls.total, skippedValid: cls.skippedValid, skippedEmpty: cls.skippedEmpty, generated, failed, persistSql, failSql, okHttp, statusCode } }];"
      }
    },
    {
      "id": "86d0a2e0-2479-429e-b47a-79e11f0febea",
      "name": "Persistir VALID",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        2640,
        80
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "={{ $json.persistSql }}"
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
      "id": "15c7f526-d0d8-436b-80e9-e78d598abfc3",
      "name": "Persistir falhas",
      "type": "n8n-nodes-base.postgres",
      "typeVersion": 2.6,
      "position": [
        2880,
        80
      ],
      "parameters": {
        "operation": "executeQuery",
        "options": {},
        "query": "={{ $('Processar resposta').first().json.failSql }}"
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
      "id": "db775a82-65ef-4f2c-b1fd-2b911aa5e4d4",
      "name": "Finalizar com trabalho",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [
        3120,
        80
      ],
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "const p = $('Processar resposta').first().json || {};\nreturn [{ json: { ok: Number(p.failed || 0) === 0, requestId: p.requestId || '', total: Number(p.total || 0), skippedValid: Number(p.skippedValid || 0), skippedEmpty: Number(p.skippedEmpty || 0), generated: Number(p.generated || 0), failed: Number(p.failed || 0), pending: Number(p.failed || 0), durationMs: Math.max(0, Date.now() - Number(p.startedAtMs || Date.now())), statusCode: p.statusCode || null } }];"
      }
    }
  ],
  "connections": {
    "Trigger": {
      "main": [
        [
          {
            "node": "Normalizar entrada",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Normalizar entrada": {
      "main": [
        [
          {
            "node": "Entrada vazia?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Entrada vazia?": {
      "main": [
        [
          {
            "node": "Finalizar vazio",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Carregar secrets",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Carregar secrets": {
      "main": [
        [
          {
            "node": "Carregar chunks",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Carregar chunks": {
      "main": [
        [
          {
            "node": "Classificar chunks",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Classificar chunks": {
      "main": [
        [
          {
            "node": "Marcar SKIPPED",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Marcar SKIPPED": {
      "main": [
        [
          {
            "node": "Tem trabalho?",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tem trabalho?": {
      "main": [
        [
          {
            "node": "Marcar PROCESSING",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Finalizar sem trabalho",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Marcar PROCESSING": {
      "main": [
        [
          {
            "node": "OpenAI Embeddings",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OpenAI Embeddings": {
      "main": [
        [
          {
            "node": "Processar resposta",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Processar resposta": {
      "main": [
        [
          {
            "node": "Persistir VALID",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Persistir VALID": {
      "main": [
        [
          {
            "node": "Persistir falhas",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Persistir falhas": {
      "main": [
        [
          {
            "node": "Finalizar com trabalho",
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
