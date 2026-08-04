#!/usr/bin/env node
/**
 * Etapa 23 — apply migration + seed evidence-v1 PUBLISHED + evidence-v2 DRAFT
 */
import pg from 'pg';
import { createHash, randomUUID } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { defaultEvidenceConfig } from './evidence-helpers.mjs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();
await client.query(readFileSync(new URL('./migration.sql', import.meta.url), 'utf8'));

const v1 = {
  ...defaultEvidenceConfig(),
  mode: 'STRUCTURED',
  notes: 'evidence-v1 — camada estruturada compatível (produção)',
};
const v2 = {
  ...defaultEvidenceConfig(),
  mode: 'STRUCTURED_STRICT',
  minEvidenceScore: 40,
  dropBelowMinScore: true,
  redundancyThreshold: 0.9,
  notes: 'evidence-v2 — draft mais estrito (não publicar automaticamente)',
};

const hash = (o) => createHash('sha256').update(JSON.stringify(o)).digest('hex');

await client.query('BEGIN');
const def = await client.query(
  `INSERT INTO ai_evidence_configs (id, code, purpose, description, active)
   VALUES ($1,'AI_QUERY_EVIDENCE','AI_QUERY_EVIDENCE','Camada de evidências da consulta IA',true)
   ON CONFLICT (code) DO UPDATE SET updated_at=NOW()
   RETURNING id`,
  [randomUUID()],
);
const defId = def.rows[0].id;

// ensure single published
await client.query(
  `UPDATE ai_evidence_config_versions SET status='ARCHIVED', archived_at=NOW()
   WHERE evidence_config_id=$1 AND status='PUBLISHED' AND version_label<>'evidence-v1'`,
  [defId],
);

const existsV1 = await client.query(
  `SELECT id FROM ai_evidence_config_versions WHERE evidence_config_id=$1 AND version_label='evidence-v1'`,
  [defId],
);
let v1Id;
if (existsV1.rowCount) {
  v1Id = existsV1.rows[0].id;
  await client.query(
    `UPDATE ai_evidence_config_versions SET status='PUBLISHED', mode='STRUCTURED', configuration=$2::jsonb,
       content_hash=$3, published_at=COALESCE(published_at,NOW()), notes=$4
     WHERE id=$1`,
    [v1Id, JSON.stringify(v1), hash(v1), v1.notes],
  );
} else {
  const max = await client.query(
    `SELECT COALESCE(MAX(version_number),0)+1 AS n FROM ai_evidence_config_versions WHERE evidence_config_id=$1`,
    [defId],
  );
  v1Id = randomUUID();
  await client.query(
    `INSERT INTO ai_evidence_config_versions (
       id, evidence_config_id, version_number, version_label, status, mode, configuration, content_hash, notes, published_at
     ) VALUES ($1,$2,$3,'evidence-v1','PUBLISHED','STRUCTURED',$4::jsonb,$5,$6,NOW())`,
    [v1Id, defId, max.rows[0].n, JSON.stringify(v1), hash(v1), v1.notes],
  );
}

const existsV2 = await client.query(
  `SELECT id FROM ai_evidence_config_versions WHERE evidence_config_id=$1 AND version_label='evidence-v2'`,
  [defId],
);
let v2Id;
if (existsV2.rowCount) {
  v2Id = existsV2.rows[0].id;
  await client.query(
    `UPDATE ai_evidence_config_versions SET status='DRAFT', mode='STRUCTURED_STRICT', configuration=$2::jsonb,
       content_hash=$3, notes=$4 WHERE id=$1`,
    [v2Id, JSON.stringify(v2), hash(v2), v2.notes],
  );
} else {
  const max = await client.query(
    `SELECT COALESCE(MAX(version_number),0)+1 AS n FROM ai_evidence_config_versions WHERE evidence_config_id=$1`,
    [defId],
  );
  v2Id = randomUUID();
  await client.query(
    `INSERT INTO ai_evidence_config_versions (
       id, evidence_config_id, version_number, version_label, status, mode, configuration, content_hash, notes
     ) VALUES ($1,$2,$3,'evidence-v2','DRAFT','STRUCTURED_STRICT',$4::jsonb,$5,$6)`,
    [v2Id, defId, max.rows[0].n, JSON.stringify(v2), hash(v2), v2.notes],
  );
}

await client.query(
  `INSERT INTO app_secrets (key, value, updated_at) VALUES ('evidence_active_mode','STRUCTURED',NOW())
   ON CONFLICT (key) DO UPDATE SET value='STRUCTURED', updated_at=NOW()`,
);
await client.query(
  `INSERT INTO app_secrets (key, value, updated_at) VALUES ('evidence_active_version','evidence-v1',NOW())
   ON CONFLICT (key) DO UPDATE SET value='evidence-v1', updated_at=NOW()`,
);

await client.query('COMMIT');

const check = await client.query(
  `SELECT version_label, status, mode FROM ai_evidence_config_versions ORDER BY version_number`,
);
writeFileSync(
  new URL('./_e23-ids.json', import.meta.url),
  JSON.stringify({ defId, v1Id, v2Id, versions: check.rows }, null, 2),
);
console.log('seed OK', { defId, v1Id, v2Id, versions: check.rows });
await client.end();
