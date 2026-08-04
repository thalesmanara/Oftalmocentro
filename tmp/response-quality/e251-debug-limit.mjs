#!/usr/bin/env node
import pg from 'pg';
import { applyResponsePolicy } from './quality-helpers.mjs';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();
const { rows } = await c.query(
  `SELECT configuration, mode FROM ai_response_quality_config_versions WHERE version_label='response-quality-v2'`,
);
const cfg = { mode: rows[0].mode, ...rows[0].configuration };
console.log('policy enabled', cfg.responsePolicy?.enabled);
console.log('thresholds', cfg.responsePolicy?.thresholds);

const r = applyResponsePolicy(
  {
    question: 'valor',
    answer: 'O valor mensal da locação é R$ 10.000,00 conforme o contrato vigente.',
    sources: [{ documentId: 'd1', documentTitle: 'Contrato' }],
    responseMeta: { qualityGrade: 'EXCELLENT', sourceCoverage: 0.9 },
    evidenceMeta: { confidence: 'HIGH', evidenceCount: 2 },
    contextMeta: { insufficientContext: false },
  },
  cfg,
);
console.log(r.policyMeta);
await c.end();
