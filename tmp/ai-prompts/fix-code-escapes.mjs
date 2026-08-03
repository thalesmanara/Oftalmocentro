/**
 * Fix Code-node jsCode that got real newlines inside double-quoted strings
 * after local SDK toJSON() evaluated template literals.
 *
 * Strategy: for every code node, convert literal newline sequences that appear
 * inside SQL string concatenations by rebuilding from the .workflow.js source
 * using a non-evaluated extraction: read file text and pull jsCode with a regex
 * that preserves \\n escapes from the on-disk source BEFORE Node evaluates them.
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import crypto from 'crypto';

const dir = dirname(fileURLToPath(import.meta.url));
const CONN =
  process.env.PGURL ||
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

const targets = [
  { id: 'q9U9E1gz8LbjrbBE', file: 'post-ai-prompts-create.workflow.js' },
  { id: 'JZxiFaHPoH8Sn2M0', file: 'put-ai-prompts-update.workflow.js' },
  { id: '1dNNsNKevnH6RRiR', file: 'post-ai-prompts-validate.workflow.js' },
  { id: 'sHlvvNBw1uTCtS3P', file: 'post-ai-prompts-publish.workflow.js' },
  { id: 'lWMX8ESUgPOuPd8T', file: 'post-ai-prompts-rollback.workflow.js' },
];

/** Extract jsCode template literal bodies from SDK source without evaluating escapes beyond \\` and \\\${} */
function extractJsCodes(src) {
  const result = [];
  const re = /name:\s*'([^']+)'[\s\S]*?jsCode:\s*`([\s\S]*?)`/g;
  let m;
  while ((m = re.exec(src))) {
    const name = m[1];
    let body = m[2];
    // Source has \\n meaning we want \n (backslash-n) in runtime code for SQL concat,
    // OR \n meaning newline between statements.
    // In the on-disk file inside backticks:
    //   - real newlines separate JS statements (keep)
    //   - \\n sequences are backslash+n written as two chars after file write from generator
    // When we READ the file as text, `\\n` in generator output that was written as `\n`
    // appears as backslash + n in the file text.
    // Actual problem: after Node import, `\n` in template became newline char.
    // On disk, the workflow.js from generator has either real newlines or \n escapes.
    result.push({ name, body });
  }
  return result;
}

function looksBroken(jsCode) {
  // double-quoted string containing raw newline
  return /"[^"\n]*\n/.test(jsCode);
}

const client = new pg.Client({ connectionString: CONN });
await client.connect();
const results = [];

for (const t of targets) {
  const src = readFileSync(join(dir, t.file), 'utf8');
  // Re-extract by parsing SDK file carefully: find jsCode:`...` and unescape as template literal would
  // BUT double the backslashes for \n that appear inside SQL string quotes.
  // Simpler approach: take extracted body and replace pattern:
  //   "....\n"  (quote, content, REAL newline) → "....\\n" for SQL builders
  // Actually after reading from disk, if the file still has \\n as two chars inside backticks, extractJsCodes gives us that.
  // Check what's on disk:
  const sample = src.includes('SELECT\\n') || src.includes('SELECT\\\\n');
  const codes = extractJsCodes(src);

  const { rows } = await client.query(`SELECT nodes, connections, name FROM workflow_entity WHERE id=$1`, [t.id]);
  const nodes = rows[0].nodes;
  let changed = 0;

  for (const n of nodes) {
    if (n.type !== 'n8n-nodes-base.code' || !n.parameters?.jsCode) continue;
    const fromSrc = codes.find((c) => c.name === n.name);
    if (!fromSrc) continue;

    // Unescape template-literal style from SOURCE TEXT:
    // In source text inside backticks, sequences are:
    //   \\ → \
    //   \` → `
    //   \${ → ${
    //   \n → if written as backslash-n in file, stays; if written as real newline, stays as newline
    let body = fromSrc.body;
    // Convert any REAL newlines that appear between SQL double-quotes into \\n
    // Heuristic: lines that are only `"` or start mid-string after `"SELECT` broken across lines
    if (looksBroken(n.parameters.jsCode) || looksBroken(body)) {
      // Prefer reconstructing: replace in body the pattern of quote-newline that breaks strings
      // by joining broken SQL string fragments.
      body = body.replace(/"\s*\n\s*"/g, '\\n'); // "\n"  between concat parts already as " + \n + " 
      // Fix: "SELECT\n" +  where \n is real newline inside quotes
      body = body.replace(/"([^"\\]*(?:\\.[^"\\]*)*)\n([^"]*)"/g, (full, a, b) => {
        return `"${a}\\n${b}"`;
      });
      // Also fix unescaped "id" inside SQL alias strings that lost escapes: AS "id"
      // Those should be AS \"id\" in the JS source
      // Pattern from broken: AS "id" inside a JS double-quoted string
      // Hard to fix generically — rebuild from create-style known-good escaping.
    }

    // Better rebuild: use the SOURCE body as stored on disk, applying only template unescape for \` and \${
    // and leaving \n as backslash-n when present as two chars.
    let fixed = fromSrc.body
      .replace(/\\`/g, '`')
      .replace(/\\\$\{/g, '${')
      .replace(/\\\\/g, '\\'); // \\ → \

    // If source body still has real newlines inside quotes (file was already corrupted), fix:
    fixed = fixed.replace(/"([^"\n]*)\n([^"]*)"/g, '"$1\\n$2"');
    // Fix alias quotes that were meant to be escaped: AS "foo" inside "... AS \"foo\" ..."
    // After corruption: `AS "id"` inside outer JS string — detect ` AS "` and escape
    // Only when inside a JS double-quoted segment for SQL. Use replace for common aliases:
    for (const alias of [
      'id',
      'promptDefinitionId',
      'versionNumber',
      'status',
      'environment',
      'content',
      'modelName',
      'temperature',
      'maxTokens',
      'topP',
      'parameters',
      'contentHash',
      'promptCode',
      'purpose',
      'changeSummary',
      'createdBy',
      'basedOnVersionId',
      'createdAt',
      'metadata',
      'defId',
      'defCode',
      'defName',
      'defDescription',
      'defPurpose',
      'defActive',
      'defCreatedAt',
      'defUpdatedAt',
      'validationRunId',
      'maxVersion',
      'basedContent',
      'basedModelName',
      'basedTemperature',
      'basedMaxTokens',
      'basedTopP',
      'basedParameters',
      'basedEnvironment',
    ]) {
      // Inside JS double-quoted SQL fragments, AS "alias" should be AS \"alias\"
      fixed = fixed.replace(new RegExp(`AS "${alias}"`, 'g'), `AS \\"${alias}\\"`);
    }

    if (fixed !== n.parameters.jsCode) {
      n.parameters.jsCode = fixed;
      changed++;
    }
  }

  if (changed > 0) {
    const versionId = crypto.randomUUID();
    await client.query(
      `UPDATE workflow_entity SET nodes=$1::json, "versionId"=$2, "updatedAt"=NOW() WHERE id=$3`,
      [JSON.stringify(nodes), versionId, t.id]
    );
    await client.query(
      `INSERT INTO workflow_history ("versionId","workflowId",authors,nodes,connections,name,description,autosaved,"nodeGroups","createdAt","updatedAt")
       SELECT $1, id, 'escape-fix', nodes, connections, name, description, false, '[]'::json, NOW(), NOW() FROM workflow_entity WHERE id=$2`,
      [versionId, t.id]
    );
    // Point active to new version immediately via sync-style update
    await client.query(`UPDATE workflow_entity SET "activeVersionId"=$1 WHERE id=$2`, [versionId, t.id]);
    results.push({ id: t.id, name: rows[0].name, changed, versionId, sample: sample });
    console.log('FIXED', rows[0].name, changed, 'nodes', versionId);
  } else {
    results.push({ id: t.id, name: rows[0].name, changed: 0, sample });
    console.log('NOCHANGE', rows[0].name, 'sampleEscapes', sample);
  }
}

await client.end();
writeFileSync(join(dir, 'fix-escape-results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
