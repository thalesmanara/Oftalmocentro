#!/usr/bin/env node
/**
 * Etapa 25 — seed responsePolicy into v1 (compat, enabled:false) and v2 DRAFT (full).
 */
import pg from 'pg';
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import {
  defaultResponseQualityConfig,
  defaultResponsePolicy,
  validateResponseQualityConfiguration,
} from './quality-helpers.mjs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
await client.query(readFileSync(new URL('./migration-25.sql', import.meta.url), 'utf8'));

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex');

const v1Cfg = validateResponseQualityConfiguration({
  ...defaultResponseQualityConfig(),
  mode: 'VALIDATE',
  notes: 'response-quality-v1 — qualidade + policy compatível (passthrough; enabled=false)',
  responsePolicy: defaultResponsePolicy({
    enabled: false,
    preserveOriginalAnswerOnAnswer: true,
  }),
});
if (!v1Cfg.ok) {
  console.error(v1Cfg.errors);
  process.exit(1);
}

const v2Cfg = validateResponseQualityConfiguration({
  ...defaultResponseQualityConfig(),
  mode: 'VALIDATE_STRICT',
  minAnswerLength: 60,
  minQualityScoreWarn: 65,
  minQualityScoreError: 50,
  minCitationCoverage: 0.45,
  notes: 'response-quality-v2 — DRAFT com política completa (não publicar automaticamente)',
  responsePolicy: defaultResponsePolicy({
    enabled: true,
    preserveOriginalAnswerOnAnswer: true,
  }),
});
if (!v2Cfg.ok) {
  console.error(v2Cfg.errors);
  process.exit(1);
}

await client.query('BEGIN');

const def = await client.query(
  `SELECT id FROM ai_response_quality_configs WHERE code='AI_QUERY_RESPONSE_QUALITY' LIMIT 1`,
);
const defId = def.rows[0].id;

const v1 = await client.query(
  `SELECT id FROM ai_response_quality_config_versions WHERE response_quality_config_id=$1 AND version_label='response-quality-v1'`,
  [defId],
);
await client.query(
  `UPDATE ai_response_quality_config_versions
   SET configuration=$2::jsonb, content_hash=$3, mode='VALIDATE', status='PUBLISHED',
       notes=$4, published_at=COALESCE(published_at,NOW())
   WHERE id=$1`,
  [v1.rows[0].id, JSON.stringify(v1Cfg.configuration), hash(v1Cfg.configuration), v1Cfg.configuration.notes],
);

const v2 = await client.query(
  `SELECT id FROM ai_response_quality_config_versions WHERE response_quality_config_id=$1 AND version_label='response-quality-v2'`,
  [defId],
);
await client.query(
  `UPDATE ai_response_quality_config_versions
   SET configuration=$2::jsonb, content_hash=$3, mode='VALIDATE_STRICT', status='DRAFT', notes=$4
   WHERE id=$1`,
  [v2.rows[0].id, JSON.stringify(v2Cfg.configuration), hash(v2Cfg.configuration), v2Cfg.configuration.notes],
);

await client.query(
  `INSERT INTO app_secrets (key, value, updated_at) VALUES ('response_quality_active_mode','VALIDATE',NOW())
   ON CONFLICT (key) DO UPDATE SET value='VALIDATE', updated_at=NOW()`,
);
await client.query(
  `INSERT INTO app_secrets (key, value, updated_at) VALUES ('response_quality_active_version','response-quality-v1',NOW())
   ON CONFLICT (key) DO UPDATE SET value='response-quality-v1', updated_at=NOW()`,
);

await client.query('COMMIT');

const state = await client.query(
  `SELECT version_label, status, mode,
          (configuration ? 'responsePolicy') AS has_policy,
          (configuration->'responsePolicy'->>'enabled') AS policy_enabled
   FROM ai_response_quality_config_versions WHERE response_quality_config_id=$1 ORDER BY version_number`,
  [defId],
);
console.log(state.rows);
writeFileSync(
  new URL('./_e25-ids.json', import.meta.url),
  JSON.stringify({ defId, v1Id: v1.rows[0].id, v2Id: v2.rows[0].id }, null, 2),
);
await client.end();
console.log('seed ok');
