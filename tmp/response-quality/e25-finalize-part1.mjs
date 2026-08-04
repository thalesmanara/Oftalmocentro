#!/usr/bin/env node
/**
 * Etapa 25 finalize — audit, dataset insert/metrics, health 7d, backup RQ tables
 */
import pg from 'pg';
import { randomUUID } from 'crypto';

const c = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await c.connect();

async function save(id, nodes, connections, name, desc = 'e25 finalize') {
  const versionId = randomUUID();
  const connJson =
    typeof connections === 'string' ? connections : JSON.stringify(connections);
  await c.query('BEGIN');
  await c.query(
    `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
     VALUES ($1::varchar,$2,'etapa25',$3::json,$4::json,$5,$6,false,NOW(),NOW())`,
    [versionId, id, JSON.stringify(nodes), connJson, name, desc],
  );
  await c.query(
    `UPDATE workflow_entity SET nodes=$1::json, connections=$2::json, "versionId"=$3::varchar, "activeVersionId"=$3::varchar, active=true, "updatedAt"=NOW() WHERE id=$4`,
    [JSON.stringify(nodes), connJson, versionId, id],
  );
  await c.query('COMMIT');
  await c.query(`UPDATE workflow_entity SET active=false WHERE id=$1`, [id]);
  await c.query(`UPDATE workflow_entity SET active=true WHERE id=$1`, [id]);
  console.log('saved', id, name, versionId);
}

// ---------- 1) Consulta: audit action + metadata policy ----------
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const audit = nodes.find((n) => n.name === 'Registrar auditoria sucesso');
  const v = audit.parameters.workflowInputs.value;
  v.action = `={{ (() => {
  try {
    const pol = $('Aplicar política resposta').first().json || {};
    if (pol.auditAction) return String(pol.auditAction);
  } catch (_) {}
  const data = ($json.response && $json.response.data) || {};
  const p = data.policyMeta || {};
  if (p.declined) return 'AI_RESPONSE_POLICY_DECLINE';
  if (p.abstained) return 'AI_RESPONSE_POLICY_ABSTAIN';
  if (p.clarificationRequired) return 'AI_RESPONSE_POLICY_CLARIFICATION';
  if (p.warningApplied || p.strategy === 'ANSWER_WITH_WARNING') return 'AI_RESPONSE_POLICY_WARNING';
  if (p.strategy === 'ANSWER_WITH_LIMITATION') return 'AI_RESPONSE_POLICY_LIMITATION';
  if (p.strategy) return 'AI_RESPONSE_POLICY_APPLIED';
  return 'AI_QUERY';
})() }}`;

  v.metadata = `={{ (() => {
  const resp = $json.response || {};
  const data = resp.data || {};
  const mr = (() => { try { return $('Montar resposta').first().json || {}; } catch (_) { return {}; } })();
  const pm = mr.promptMeta || {};
  const policy = data.policyMeta || (() => { try { return $('Aplicar política resposta').first().json.policyMeta || {}; } catch (_) { return {}; } })();
  const q = data.question || mr.data?.question || '';
  const a = data.answer || '';
  const sources = data.sources || [];
  const cls = data.classification || {};
  return {
    questionLength: String(q).length,
    answerLength: String(a).length,
    sourcesCount: sources.length,
    documentIds: sources.map(s => s.documentId).filter(Boolean),
    categoryId: cls.categoryId || null,
    categoryName: cls.categoryName || null,
    subcategoryId: cls.subcategoryId || null,
    subcategoryName: cls.subcategoryName || null,
    promptVersionId: pm.promptVersionId || null,
    promptCode: pm.promptCode || null,
    promptVersionNumber: pm.versionNumber != null ? pm.versionNumber : null,
    promptContentHash: pm.contentHash || null,
    promptModelName: pm.modelName || null,
    responsePolicyStrategy: policy.strategy || null,
    responsePolicyReasonCodes: Array.isArray(policy.reasonCodes) ? policy.reasonCodes : [],
    responsePolicyWarning: !!policy.warningApplied,
    responsePolicyAnswerModified: !!policy.answerModified,
    responsePolicyAbstained: !!policy.abstained,
    responsePolicyDeclined: !!policy.declined,
    responsePolicyClarificationRequired: !!policy.clarificationRequired,
    responsePolicyConfigVersion: policy.configVersion || null,
    responsePolicyLatencyMs: policy.durationMs != null ? Number(policy.durationMs) : null,
  };
})() }}`;

  await save('8EXk5RkFW5cxnenL', nodes, rows[0].connections, rows[0].name, 'e25 audit policy');
}

// ---------- 2) Dataset Avaliar insert: policyMeta columns ----------
{
  const { rows } = await c.query(
    `SELECT name, nodes, connections FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
  let code = n.parameters.jsCode;
  if (!code.includes('response_policy_strategy')) {
    // extract policyMeta after data=
    if (!code.includes('const policyMeta')) {
      code = code.replace(
        'const classification = data.classification && typeof data.classification === \'object\' ? data.classification : {};',
        `const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};
const policyMeta = data.policyMeta && typeof data.policyMeta === 'object' ? data.policyMeta : {};
const responseMeta = data.responseMeta && typeof data.responseMeta === 'object' ? data.responseMeta : {};`,
      );
    }
    code = code.replace(
      '"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type\\n" +',
      '"  insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\\n" +\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\\n" +\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\\n" +',
    );
    // Also try without escaped newlines if the file uses real newlines in source
    if (!code.includes('response_policy_strategy, response_policy_reason_codes')) {
      code = code.replace(
        'insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type\n" +',
        'insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\n" +\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\n" +\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\n" +',
      );
    }
    // values: before closing paren of VALUES
    const valuesNeedle =
      '  "  " + (overflowDetected ? \'true\' : \'false\') + ", " + (emptyContext ? \'true\' : \'false\') + ", " + (sourceCount == null ? \'NULL\' : String(sourceCount)) + ", " + (conflictType ? ("\'" + esc(conflictType) + "\'") : \'NULL\') + "\\n" + ';
    const valuesNeedle2 =
      '  "  " + (overflowDetected ? \'true\' : \'false\') + ", " + (emptyContext ? \'true\' : \'false\') + ", " + (sourceCount == null ? \'NULL\' : String(sourceCount)) + ", " + (conflictType ? ("\'" + esc(conflictType) + "\'") : \'NULL\') + "\\n" +';

    const policyValues =
      '  "  " + (overflowDetected ? \'true\' : \'false\') + ", " + (emptyContext ? \'true\' : \'false\') + ", " + (sourceCount == null ? \'NULL\' : String(sourceCount)) + ", " + (conflictType ? ("\'" + esc(conflictType) + "\'") : \'NULL\') + ",\\n" +\n' +
      '  "  " + (policyMeta.strategy ? ("\'" + esc(policyMeta.strategy) + "\'") : \'NULL\') + ",\\n" +\n' +
      '  "  \'" + j(Array.isArray(policyMeta.reasonCodes) ? policyMeta.reasonCodes : []) + "\'::jsonb,\\n" +\n' +
      '  "  " + (policyMeta.warningApplied ? \'true\' : \'false\') + ", " + (policyMeta.answerModified ? \'true\' : \'false\') + ",\\n" +\n' +
      '  "  " + (policyMeta.abstained ? \'true\' : \'false\') + ", " + (policyMeta.declined ? \'true\' : \'false\') + ", " + (policyMeta.clarificationRequired ? \'true\' : \'false\') + ",\\n" +\n' +
      '  "  " + (policyMeta.durationMs == null ? \'NULL\' : String(Math.round(Number(policyMeta.durationMs)||0))) + "\\n" + ';

    // Work on the actual source which uses real newlines in the string concat
    const oldTail = `  "  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" + 
  ") RETURNING`;
    const oldTail2 = `  "  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" + `;

    // Read exact bytes around conflict_type in values
    const idx = code.indexOf('conflictType ? ("\'" + esc(conflictType)');
    if (idx < 0) {
      console.log('WARN: could not find conflictType value insert point');
    } else {
      // Find the line ending before ") RETURNING
      const retIdx = code.indexOf(') RETURNING', idx);
      const lineStart = code.lastIndexOf('\n', retIdx);
      // Replace from overflowDetected values through before ) RETURNING
      const overflowIdx = code.lastIndexOf('overflowDetected', retIdx);
      const lineOverflowStart = code.lastIndexOf('\n', overflowIdx) + 1;
      const before = code.slice(0, lineOverflowStart);
      const after = code.slice(retIdx);
      const newValues =
        `  "  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + ",\\n" +\n` +
        `  "  " + (policyMeta.strategy ? ("'" + esc(policyMeta.strategy) + "'") : 'NULL') + ",\\n" +\n` +
        `  "  '" + j(Array.isArray(policyMeta.reasonCodes) ? policyMeta.reasonCodes : []) + "'::jsonb,\\n" +\n` +
        `  "  " + (policyMeta.warningApplied ? 'true' : 'false') + ", " + (policyMeta.answerModified ? 'true' : 'false') + ",\\n" +\n` +
        `  "  " + (policyMeta.abstained ? 'true' : 'false') + ", " + (policyMeta.declined ? 'true' : 'false') + ", " + (policyMeta.clarificationRequired ? 'true' : 'false') + ",\\n" +\n` +
        `  "  " + (policyMeta.durationMs == null ? 'NULL' : String(Math.round(Number(policyMeta.durationMs)||0))) + "\\n" + \n` +
        `  "`;
      // Wait - the SQL string structure uses "+ at end. Let me do a cleaner replace.
    }

    n.parameters.jsCode = patchAvaliadorInsert(code);
    if (!n.parameters.jsCode.includes('response_policy_strategy')) {
      throw new Error('Failed to patch Avaliar insert with policy columns');
    }
    await save('KdpEmEGHNlPICOa4', nodes, rows[0].connections, rows[0].name, 'e25 dataset policy');
  } else {
    console.log('dataset insert already has response_policy_strategy');
  }
}

function patchAvaliadorInsert(code) {
  if (code.includes('response_policy_strategy, response_policy_reason_codes')) return code;

  // columns list
  const colOld =
    'insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type\n" +';
  const colNew =
    'insufficient_context, conflict_detected, context_utilization_rate, relevant_context_rate, source_coverage, redundancy_rate, overflow_detected, empty_context, source_count, conflict_type,\n" +\n"  response_policy_strategy, response_policy_reason_codes, response_policy_warning, response_policy_modified,\n" +\n"  response_policy_abstained, response_policy_declined, response_policy_clarification_required, response_policy_latency_ms\n" +';
  if (!code.includes(colOld)) {
    throw new Error('column list needle not found');
  }
  code = code.replace(colOld, colNew);

  if (!code.includes('const policyMeta')) {
    code = code.replace(
      "const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};",
      "const classification = data.classification && typeof data.classification === 'object' ? data.classification : {};\nconst policyMeta = data.policyMeta && typeof data.policyMeta === 'object' ? data.policyMeta : {};",
    );
  }

  const valOld =
    `"  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" + 
  ") RETURNING`;
  // In the extracted file the newline after + might be literal in source as `\n` inside the JS string building... Looking at extract:
  // line 172: `  "  " + (overflowDetected ... + "\n" + `
  // line 173: `  ") RETURNING ...`
  const valOld2 =
    `"  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" + \n  ") RETURNING`;

  // Actual content in DB uses the character sequence: + "\n" + \n  ") RETURNING
  // When we read jsCode from JSON, `\n` in the SQL-building string is two chars backslash-n OR a real newline inside quotes?

  // From Read tool output line 172:
  // `  "  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\n" + `
  // So inside the JS source, it's: + "\n" +  where \n is escape for newline in the generated SQL string.

  const needle =
    `"  " + (overflowDetected ? 'true' : 'false') + ", " + (emptyContext ? 'true' : 'false') + ", " + (sourceCount == null ? 'NULL' : String(sourceCount)) + ", " + (conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" + \n  ") RETURNING`;

  // Try matching with real newline after +
  const re =
    /"  " \+ \(overflowDetected \? 'true' : 'false'\) \+ ", " \+ \(emptyContext \? 'true' : 'false'\) \+ ", " \+ \(sourceCount == null \? 'NULL' : String\(sourceCount\)\) \+ ", " \+ \(conflictType \? \("'" \+ esc\(conflictType\) \+ "'"\) : 'NULL'\) \+ "\\n" \+ \s*\) RETURNING/;

  // Simpler: find conflictType value and replace until ") RETURNING
  const marker = `(conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\\n" +`;
  const marker2 = `(conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + "\n" +`;
  let m = code.indexOf(marker2);
  let usedMarker = marker2;
  if (m < 0) {
    m = code.indexOf(marker);
    usedMarker = marker;
  }
  if (m < 0) {
    // dump nearby
    const i = code.indexOf('overflowDetected ?');
    console.log('snippet', JSON.stringify(code.slice(i, i + 280)));
    throw new Error('values needle not found');
  }
  const ret = code.indexOf(') RETURNING', m);
  const replacement =
    `(conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + ",\\n" +\n` +
    `  "  " + (policyMeta.strategy ? ("'" + esc(policyMeta.strategy) + "'") : 'NULL') + ",\\n" +\n` +
    `  "  '" + j(Array.isArray(policyMeta.reasonCodes) ? policyMeta.reasonCodes : []) + "'::jsonb,\\n" +\n` +
    `  "  " + (policyMeta.warningApplied ? 'true' : 'false') + ", " + (policyMeta.answerModified ? 'true' : 'false') + ",\\n" +\n` +
    `  "  " + (policyMeta.abstained ? 'true' : 'false') + ", " + (policyMeta.declined ? 'true' : 'false') + ", " + (policyMeta.clarificationRequired ? 'true' : 'false') + ",\\n" +\n` +
    `  "  " + (policyMeta.durationMs == null ? 'NULL' : String(Math.round(Number(policyMeta.durationMs) || 0))) + "\\n" +\n` +
    `  "`;
  // Fix: usedMarker ends with + "\n" + and we need to replace from (conflictType... through the + before ") RETURNING
  // Looking at structure: ... + "\n" + \n  ") RETURNING
  // So after usedMarker comes newline and `  ") RETURNING`

  // The generated SQL newlines: we need `,\n` in the SQL string = `",\\n" +` in JS source when writing with JSON... 
  // In JS source file content (what n8n stores), to emit comma+newline in SQL we write: + ",\n" +
  // which in the raw string is: + ",\n" +  (backslash-n or actual?)
  // From existing: + "\n" + means the JS string literal contains backslash-n? No - in the Read output of .js file,
  // `"\n"` is a JS string with newline character.
  // When I write replacement with `\\n` in a template literal in this patcher, I get `\n` two-char in output which is WRONG.
  // I need actual newline escapes in the JS code being generated for n8n = the characters quote backslash n quote.

  // Existing pattern in code (as stored): + "\n" +
  // In JavaScript when we have the code as a string loaded from DB, the characters are: + " then newline then " +
  // OR + " \ n " +
  // JSON.stringify of a snippet will tell us.

  const afterMarker = code.slice(m, m + usedMarker.length + 20);
  // Use same style as existing for \n inside SQL fragments
  const nl = usedMarker.includes('"\\n"') ? '\\n' : '\n';
  // Actually usedMarker2 was with "\n" - in the source string from DB when we have `"\n"` in the file read,
  // indexOf with "\n" in our JS means looking for quote-newline-quote.

  const repl =
    `(conflictType ? ("'" + esc(conflictType) + "'") : 'NULL') + ",` +
    (nl === '\n' ? '\n' : '\\n') +
    `" +\n` +
    `  "  " + (policyMeta.strategy ? ("'" + esc(policyMeta.strategy) + "'") : 'NULL') + ",` +
    (nl === '\n' ? '\n' : '\\n') +
    `" +\n` +
    `  "  '" + j(Array.isArray(policyMeta.reasonCodes) ? policyMeta.reasonCodes : []) + "'::jsonb,` +
    (nl === '\n' ? '\n' : '\\n') +
    `" +\n` +
    `  "  " + (policyMeta.warningApplied ? 'true' : 'false') + ", " + (policyMeta.answerModified ? 'true' : 'false') + ",` +
    (nl === '\n' ? '\n' : '\\n') +
    `" +\n` +
    `  "  " + (policyMeta.abstained ? 'true' : 'false') + ", " + (policyMeta.declined ? 'true' : 'false') + ", " + (policyMeta.clarificationRequired ? 'true' : 'false') + ",` +
    (nl === '\n' ? '\n' : '\\n') +
    `" +\n` +
    `  "  " + (policyMeta.durationMs == null ? 'NULL' : String(Math.round(Number(policyMeta.durationMs) || 0))) + "` +
    (nl === '\n' ? '\n' : '\\n') +
    `" +\n` +
    `  "`;

  code = code.slice(0, m) + repl + code.slice(ret);
  return code;
}

await c.end();
console.log('partial finalize done (audit+dataset attempt)');
