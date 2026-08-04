#!/usr/bin/env node
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function save(id, nodes, connections, name) {
  const versionId = randomUUID();
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa25',$3::json,$4::json,$5,'e25 patch',false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), JSON.stringify(connections), name],
  );
  await c.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), JSON.stringify(connections), versionId, id],
  );
  await c.query('COMMIT');
  await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [id]);
  console.log('saved', id, versionId);
}

// Patch validate endpoint
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='c24QualityValidate01'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const restore = nodes.find((n) => n.name === 'Restaurar request');
  restore.parameters.jsCode = `const auth=$('Validar auth').first().json||{};
const body=$('Webhook').first().json.body||{};
const cfg=body.configuration||{};
const modes=['DISABLED','PASSTHROUGH','VALIDATE','VALIDATE_STRICT'];
const errors=[];
const mode=String(body.mode||cfg.mode||'').toUpperCase();
if(!modes.includes(mode)) errors.push({field:'mode',message:'mode invalido'});
for(const b of ['requireSources','allowEmptyOnInsufficientContext','enableHallucinationRules','enableConsistencyRules','enableSourceValidation','enableLengthRules','enableForbiddenPhrases','passthroughAnswer']){
  if(cfg[b]!==undefined && typeof cfg[b]!=='boolean') errors.push({field:b,message:'deve ser boolean'});
}
for(const n of ['minAnswerLength','maxAnswerLength','minQualityScoreWarn','minQualityScoreError','minCitationCoverage']){
  if(cfg[n]!==undefined && !Number.isFinite(Number(cfg[n]))) errors.push({field:n,message:'numero invalido'});
}
if(Number(cfg.maxAnswerLength||0) && Number(cfg.minAnswerLength||0) && Number(cfg.maxAnswerLength)<=Number(cfg.minAnswerLength)) errors.push({field:'maxAnswerLength',message:'deve ser > minAnswerLength'});
const rp=cfg.responsePolicy;
if(rp!==undefined){
  if(!rp || typeof rp!=='object' || Array.isArray(rp)) errors.push({field:'responsePolicy',message:'objeto invalido'});
  else {
    if(rp.enabled!==undefined && typeof rp.enabled!=='boolean') errors.push({field:'responsePolicy.enabled',message:'boolean'});
    if(rp.preserveOriginalAnswerOnAnswer!==undefined && typeof rp.preserveOriginalAnswerOnAnswer!=='boolean') errors.push({field:'responsePolicy.preserveOriginalAnswerOnAnswer',message:'boolean'});
    const allowed=['ANSWER','ANSWER_WITH_WARNING','ANSWER_WITH_LIMITATION','REQUEST_CLARIFICATION','ABSTAIN','DECLINE'];
    if(rp.strategies && typeof rp.strategies==='object'){
      for(const [k,v] of Object.entries(rp.strategies)){
        if(!allowed.includes(k)) errors.push({field:'responsePolicy.strategies.'+k,message:'estrategia nao permitida'});
        else if(typeof v!=='boolean') errors.push({field:'responsePolicy.strategies.'+k,message:'boolean'});
      }
    }
    const phrases=rp.phrases||{};
    for(const key of ['abstain','limitationPrefix','conflictPrefix','clarificationPrefix','decline']){
      if(phrases[key]!==undefined && !String(phrases[key]).trim()) errors.push({field:'responsePolicy.phrases.'+key,message:'frase vazia'});
      if(phrases[key] && /(api[_-]?key|password|secret|token|eval\\s*\\(|Function\\s*\\()/i.test(String(phrases[key]))) errors.push({field:'responsePolicy.phrases.'+key,message:'conteudo proibido'});
    }
    const known=new Set(['enabled','strategies','thresholds','phrases','forbiddenExpressions','preserveOriginalAnswerOnAnswer']);
    for(const k of Object.keys(rp)){ if(!known.has(k)) errors.push({field:'responsePolicy.'+k,message:'campo desconhecido'}); }
  }
}
const ok=errors.length===0;
const merged={...cfg,mode};
const sql="SELECT jsonb_build_object('ok',"+ok+",'errors','"+JSON.stringify(errors).replace(/'/g,"''")+"'::jsonb,'configuration','"+JSON.stringify(merged).replace(/'/g,"''")+"'::jsonb) AS data";
return [{json:{requestId:auth.requestId||'',userId:auth.userId,sessionId:auth.sessionId,requestStartedAtMs:Date.now(),sql,statusCode:ok?200:400}}];`;
  await save('c24QualityValidate01', nodes, rows[0].connections, rows[0].name);
}

// Patch health Aggregate responseQuality with policy fields
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='qAyYc9DrHIqe4L9i'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const agg = nodes.find((n) => n.name === 'Aggregate health');
  let code = agg.parameters.jsCode;
  if (!code.includes('policyEnabled')) {
    code = code.replace(
      'gradeDistribution: null,',
      `gradeDistribution: null,
      policyEnabled: !!(e.policyEnabled),
      strategyDistribution7d: null,
      warnings7d: null,
      limitations7d: null,
      clarifications7d: null,
      abstentions7d: null,
      declines7d: null,
      policyFailures7d: null,
      averagePolicyLatencyMs: null,`,
    );
    // also read policyEnabled from published config via rqDb - extend Prepare if needed
    agg.parameters.jsCode = code;
  }
  const prep = nodes.find((n) => n.name === 'Prepare checks');
  if (prep && !prep.parameters.jsCode.includes('policyEnabled')) {
    prep.parameters.jsCode = prep.parameters.jsCode.replace(
      'const rqDb = {',
      `const rqDb = {
      policyEnabled: String(dbItem.rq_policy_enabled || 'false') === 'true',`,
    );
  }
  const probe = nodes.find((n) => n.name === 'Probe database');
  if (probe && !String(probe.parameters.query).includes('rq_policy_enabled')) {
    probe.parameters.query = String(probe.parameters.query).replace(
      'AS rq_published',
      `AS rq_published,
    COALESCE((SELECT (configuration->'responsePolicy'->>'enabled') FROM ai_response_quality_config_versions WHERE status='PUBLISHED' ORDER BY published_at DESC NULLS LAST LIMIT 1),'false') AS rq_policy_enabled`,
    );
    if (!String(probe.parameters.query).includes('rq_stats.rq_policy_enabled')) {
      probe.parameters.query = String(probe.parameters.query).replace(
        'rq_stats.rq_published,',
        'rq_stats.rq_published,\n  rq_stats.rq_policy_enabled,',
      );
    }
  }
  await save('qAyYc9DrHIqe4L9i', nodes, rows[0].connections, rows[0].name);
}

// Wrapper health copy policyEnabled
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='2UPHcxASp2PboC9M'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const m = nodes.find((n) => n.name === 'Montar resposta admin');
  if (m && !m.parameters.jsCode.includes('policyEnabled')) {
    m.parameters.jsCode = m.parameters.jsCode.replace(
      'out.averageQualityScore = c.averageQualityScore != null ? Number(c.averageQualityScore) : null;',
      `out.averageQualityScore = c.averageQualityScore != null ? Number(c.averageQualityScore) : null;
    out.policyEnabled = c.policyEnabled === true;
    out.strategyDistribution7d = c.strategyDistribution7d || null;
    out.warnings7d = c.warnings7d != null ? Number(c.warnings7d) : null;
    out.limitations7d = c.limitations7d != null ? Number(c.limitations7d) : null;
    out.clarifications7d = c.clarifications7d != null ? Number(c.clarifications7d) : null;
    out.abstentions7d = c.abstentions7d != null ? Number(c.abstentions7d) : null;
    out.declines7d = c.declines7d != null ? Number(c.declines7d) : null;
    out.policyFailures7d = c.policyFailures7d != null ? Number(c.policyFailures7d) : null;
    out.averagePolicyLatencyMs = c.averagePolicyLatencyMs != null ? Number(c.averagePolicyLatencyMs) : null;`,
    );
  }
  await save('2UPHcxASp2PboC9M', nodes, rows[0].connections, rows[0].name);
}

// Patch Consulta SALVAR CACHE answer input if present
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const salvar = nodes.find((n) => n.name === 'IA - SALVAR CACHE');
  const v = salvar?.parameters?.workflowInputs?.value || {};
  console.log('SALVAR keys', Object.keys(v));
  let changed = false;
  for (const key of Object.keys(v)) {
    if (/answer/i.test(key) && typeof v[key] === 'string' && v[key].includes('Message a model')) {
      v[key] = "={{ $('Aplicar política resposta').first().json.answer || '' }}";
      changed = true;
    }
  }
  // Also pass policy strategy hints for cache eligibility if fields exist
  if (v.conflictDetected !== undefined) {
    v.conflictDetected = `={{ (() => { const p=$('Aplicar política resposta').first().json.policyMeta||{}; const r=$('Aplicar validação resposta').first().json.responseMeta||{}; return !!(r.conflictDetected || p.strategy==='ANSWER_WITH_WARNING'); })() }}`;
    changed = true;
  }
  if (changed) await save('8EXk5RkFW5cxnenL', nodes, rows[0].connections, rows[0].name);
  else console.log('consulta salvar inputs unchanged');
}

await c.end();
