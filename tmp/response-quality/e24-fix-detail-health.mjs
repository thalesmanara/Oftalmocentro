#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function activate(id, nodes, connections, name) {
  const versionId = randomUUID();
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa24',$3::json,$4::json,$5,'e24 fix',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name],
  );
  await c.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await c.query('COMMIT');
  await c.query(`UPDATE workflow_entity SET active=false, "updatedAt"=NOW() WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true, "updatedAt"=NOW() WHERE id=$1`, [id]);
  console.log('fixed', id, versionId);
}

// Fix DETAIL SQL empty uuid
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='c24QualityDetail001'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const restore = nodes.find((n) => n.name === 'Restaurar request');
  restore.parameters.jsCode = `const auth=$('Validar auth').first().json||{};
const q=$('Webhook').first().json.query||{};
const versionId=String(q.versionId||'').replace(/[^0-9a-f-]/gi,'');
const versionFilter = versionId
  ? "AND v.id='" + versionId + "'::uuid"
  : "AND false";
const sql=\`SELECT jsonb_build_object(
  'definition', (SELECT to_jsonb(d) FROM ai_response_quality_configs d WHERE code='AI_QUERY_RESPONSE_QUALITY' LIMIT 1),
  'versions', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) ORDER BY v.version_number DESC) FROM ai_response_quality_config_versions v), '[]'::jsonb),
  'activeVersion', (SELECT jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) FROM ai_response_quality_config_versions v WHERE v.status='PUBLISHED' ORDER BY v.published_at DESC NULLS LAST LIMIT 1),
  'version', (
    SELECT jsonb_build_object(
      'id',v.id,'versionNumber',v.version_number,'versionLabel',v.version_label,'status',v.status,'mode',v.mode,
      'configuration',v.configuration,'contentHash',v.content_hash,'notes',v.notes,'createdAt',v.created_at,'publishedAt',v.published_at
    ) FROM ai_response_quality_config_versions v WHERE true \${versionFilter} LIMIT 1
  )
) AS data\`;
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql}}];`;
  await activate('c24QualityDetail001', nodes, rows[0].connections, rows[0].name);
}

// Fix health wrapper allowlist
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const montar = nodes.find((n) => n.name === 'Montar resposta admin');
  let code = montar.parameters.jsCode || '';
  if (!code.includes("'responseQuality'")) {
    if (code.includes("'evidenceLayer'")) {
      code = code.replace("'evidenceLayer']", "'evidenceLayer','responseQuality']");
    } else if (code.includes("'semanticCache']")) {
      code = code.replace("'semanticCache']", "'semanticCache','responseQuality']");
    }
  }
  if (!code.includes("key === 'responseQuality'")) {
    const block = `if (key === 'responseQuality') {
    out.activeMode = c.activeMode || null;
    out.activeVersion = c.activeVersion || null;
    out.averageQualityScore = c.averageQualityScore != null ? Number(c.averageQualityScore) : null;
    out.conflictRate = c.conflictRate != null ? Number(c.conflictRate) : null;
    out.consistencyOkRate = c.consistencyOkRate != null ? Number(c.consistencyOkRate) : null;
    out.lowQualityCount = c.lowQualityCount != null ? Number(c.lowQualityCount) : null;
    out.hallucinationRate = c.hallucinationRate != null ? Number(c.hallucinationRate) : null;
    out.gradeDistribution = c.gradeDistribution || null;
    out.draftCount = Number(c.draftCount || 0) || 0;
    out.multiplePublishedCount = Number(c.multiplePublishedCount || 0) || 0;
  }
`;
    if (code.includes("if (key === 'evidenceLayer')")) {
      code = code.replace("if (key === 'evidenceLayer')", block + "if (key === 'evidenceLayer')");
    } else {
      code = code.replace("if (key === 'semanticCache')", block + "if (key === 'semanticCache')");
    }
  }
  montar.parameters.jsCode = code;
  await activate('2UPHcxASp2PboC9M', nodes, rows[0].connections, rows[0].name);
}

// Ensure health subworkflow Aggregate includes responseQuality and Prepare has rqDb
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const prep = nodes.find((n) => n.name === 'Prepare checks');
  const agg = nodes.find((n) => n.name === 'Aggregate health');
  const probe = nodes.find((n) => n.name === 'Probe database');
  console.log('prep has rqDb', prep.parameters.jsCode.includes('rqDb'));
  console.log('agg has responseQuality', agg.parameters.jsCode.includes('responseQuality'));
  console.log('probe has rq_stats', String(probe.parameters.query).includes('rq_stats'));
  // Ensure rqDb is returned in partial object
  if (prep.parameters.jsCode.includes('rqDb') && !/rqDb\s*,/.test(prep.parameters.jsCode) && !prep.parameters.jsCode.includes('rqDb,')) {
    // try inject into return object near evidenceDb
    if (prep.parameters.jsCode.includes('evidenceDb,')) {
      prep.parameters.jsCode = prep.parameters.jsCode.replace('evidenceDb,', 'evidenceDb,\n      rqDb,');
    }
  }
  // If Aggregate missing responseQuality component wiring from partial - already checked true
  await activate('qAyYc9DrHIqe4L9i', nodes, rows[0].connections, rows[0].name);
}

await c.end();
