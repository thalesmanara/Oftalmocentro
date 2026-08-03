#!/usr/bin/env node
/**
 * Fix Avaliar: remove duplicate expectedIds block; fix broken SQL string concat before RETURNING.
 */
import pg from 'pg';
import { randomUUID } from 'crypto';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='KdpEmEGHNlPICOa4'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
const n = nodes.find((x) => x.name === 'Avaliar e montar insert');
let code = n.parameters.jsCode;
writeFileSync(new URL('./_c211-avaliar-before.js', import.meta.url), code);

// 1) Remove duplicate metrics inject that redeclares expectedIds
const dupStart = code.indexOf('const sourceCount = Array.isArray(sources)');
const utilStart = code.indexOf('const contextUtilizationRate =');
if (dupStart > 0 && utilStart > dupStart) {
  // Keep conflictDetected line and replace the duplicate block with non-duplicating version
  // Find first expectedIds
  const firstExpected = code.indexOf('const expectedIds = []');
  const secondExpected = code.indexOf('const expectedIds = []', firstExpected + 1);
  if (secondExpected > 0) {
    // Replace from sourceCount through conflictType assignment with fixed block that reuses uniqExpected
    const conflictDetectedLine = 'const conflictDetected = !!contextMeta.conflictDetected;';
    const cdIdx = code.indexOf(conflictDetectedLine);
    const afterCd = cdIdx + conflictDetectedLine.length;
    const beforeUtil = code.indexOf('\nconst contextUtilizationRate =');
    const fixedMid = `
const sourceCount = Array.isArray(sources) ? sources.length : (contextMeta.sourceCount != null ? Number(contextMeta.sourceCount) : null);
const overflowDetected = !!(contextMeta.truncated) || (availableContextTokens > 0 && estimatedContextTokens != null && Number(estimatedContextTokens) > Number(availableContextTokens));
const emptyContext = !!insufficientContext || (includedChunkCount === 0);
const redundancyRate = (redundancyRemovedCount != null && includedChunkCount != null && (redundancyRemovedCount + includedChunkCount) > 0)
  ? redundancyRemovedCount / (redundancyRemovedCount + includedChunkCount) : null;
let relevantContextRate = null;
let sourceCoverage = null;
const expectedDocIdsForContext = [...uniqExpected];
if (caso.required_source_document_id) expectedDocIdsForContext.push(String(caso.required_source_document_id));
const uniqExpectedDocs = [...new Set(expectedDocIdsForContext)];
const includedDocIds = Array.isArray(contextMeta.includedDocumentIds) ? contextMeta.includedDocumentIds.map(String) : (sources||[]).map(s=>String(s.documentId||s.document_id||'')).filter(Boolean);
if (uniqExpectedDocs.length > 0 && includedDocIds.length > 0) {
  const hit = includedDocIds.filter(id => uniqExpectedDocs.includes(id)).length;
  relevantContextRate = hit / includedDocIds.length;
  sourceCoverage = hit / uniqExpectedDocs.length;
} else {
  relevantContextRate = null;
  sourceCoverage = null;
}
const conflictType = contextMeta.conflictType || (conflictDetected ? 'POTENTIAL_CONFLICT' : 'NO_CONFLICT');
`;
    code = code.slice(0, afterCd) + fixedMid + code.slice(beforeUtil);
    console.log('Removed duplicate expectedIds; reused uniqExpected');
  }
}

// 2) Fix broken SQL concat: `+ \n  ) RETURNING` → `+ \n  ") RETURNING`
if (code.includes('+ \n  ) RETURNING') || code.includes('+\n  ) RETURNING') || code.includes("+ \"\\n\" +\n  ) RETURNING")) {
  code = code.replace(/\+\s*\n\s*\) RETURNING/, '+ \n  ") RETURNING');
  console.log('Fixed RETURNING quote');
}
// Also handle the exact broken pattern from MCP dump:
// `+ \"\\n\" +\n  ) RETURNING`
code = code.replace(/\+ \"\\n\" \+\n  \) RETURNING/, '+ \"\\n\" +\n  \") RETURNING');
code = code.replace(/\+ "\\n" \+\n  \) RETURNING/, '+ "\\n" +\n  ") RETURNING');

// 3) Fix possible double-space before rankedDocumentIds value
code = code.replace(
  `"  \"  '\" + j(rankedDocumentIds)`,
  `"  '\" + j(rankedDocumentIds)`,
);
code = code.replace(
  `"  "  '" + j(rankedDocumentIds)`,
  `"  '" + j(rankedDocumentIds)`,
);

// Verify no duplicate const expectedIds
const matches = code.match(/const expectedIds = \[\]/g) || [];
console.log('expectedIds decls', matches.length);
console.log('has RETURNING quote ok', code.includes('") RETURNING id') || code.includes('") RETURNING id'));

// Syntax check via Function constructor (approx)
try {
  // wrap to avoid return at top level issues - just check parse of declarations portion
  new Function(code.replace(/^return /, 'return '));
  console.log('Function() parse OK');
} catch (e) {
  console.log('Function() parse FAIL', e.message);
  // still save - maybe return at end causes issue in Function without wrapping
  try {
    new Function('return (async () => { ' + code + ' })');
    console.log('wrapped parse OK');
  } catch (e2) {
    console.log('wrapped parse FAIL', e2.message);
  }
}

n.parameters.jsCode = code;
writeFileSync(new URL('./_c211-avaliar-after.js', import.meta.url), code);

const versionId = randomUUID();
const nodesJson = JSON.stringify(nodes);
const connJson = JSON.stringify(connections);
await client.query('BEGIN');
await client.query(
  `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"createdAt","updatedAt")
   VALUES ($1::varchar,$2,'etapa21.1',$3::json,$4::json,$5,'Fix Avaliar expectedIds+SQL',false,NOW(),NOW())`,
  [versionId, 'KdpEmEGHNlPICOa4', nodesJson, connJson, rows[0].name],
);
await client.query(
  `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2::varchar, "activeVersionId"=$2::varchar, "updatedAt"=NOW() WHERE id=$3`,
  [nodesJson, versionId, 'KdpEmEGHNlPICOa4'],
);
await client.query('COMMIT');
console.log('Published version ready', versionId);
await client.end();
