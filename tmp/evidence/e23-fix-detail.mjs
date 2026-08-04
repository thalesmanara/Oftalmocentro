#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT name, nodes, connections FROM workflow_entity WHERE id='c23EvidenceDetail001'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const restore = nodes.find((n) => n.name === 'Restaurar request');
restore.parameters.jsCode = `const auth=$('Validar auth').first().json||{};
const q=$('Webhook').first().json.query||{};
const versionId=String(q.versionId||'').replace(/[^0-9a-f-]/gi,'');
let versionSql="NULL";
if(versionId){
  versionSql="(SELECT jsonb_build_object('id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at) FROM ai_evidence_config_versions v WHERE v.id='"+versionId+"'::uuid LIMIT 1)";
}
const sql="SELECT jsonb_build_object("+
  "'definition', (SELECT jsonb_build_object('id',d.id,'code',d.code,'purpose',d.purpose,'description',d.description,'active',d.active) FROM ai_evidence_configs d WHERE code='AI_QUERY_EVIDENCE' LIMIT 1),"+
  "'versions', COALESCE((SELECT jsonb_agg(jsonb_build_object("+
    "'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,"+
    "'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at"+
  ") ORDER BY v.version_number DESC) FROM ai_evidence_config_versions v), '[]'::jsonb),"+
  "'activeVersion', (SELECT jsonb_build_object('id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at) FROM ai_evidence_config_versions v WHERE v.status='PUBLISHED' ORDER BY v.published_at DESC NULLS LAST LIMIT 1),"+
  "'version', "+versionSql+
") AS data";
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`;

const montar = nodes.find((n) => n.name === 'Montar data');
montar.parameters.jsCode = `const row=$input.first().json||{};
let data=row.data;
if(typeof data==='string'){try{data=JSON.parse(data);}catch(_){data={};}}
if(!data || typeof data!=='object') data={versions:[]};
return [{json:{data,statusCode:200,auditAction:'AI_EVIDENCE_COMPLETED'}}];`;

const versionId = randomUUID();
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,'c23EvidenceDetail001','etapa23',$2::json,$3::json,$4,'fix detail empty',false,NOW(),NOW())`,
  [versionId, JSON.stringify(nodes), JSON.stringify(connections), rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, active=true, "updatedAt"=NOW() WHERE id='c23EvidenceDetail001'`,
  [JSON.stringify(nodes), versionId],
);
await client.query('COMMIT');
await client.query(`UPDATE workflow_entity SET active=false WHERE id='c23EvidenceDetail001'`);
await client.query(`UPDATE workflow_entity SET active=true WHERE id='c23EvidenceDetail001'`);
console.log('detail fixed', versionId);
await client.end();
