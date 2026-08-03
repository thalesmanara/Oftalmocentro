import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { cases } = require('./seed-cases.cjs');

console.log('total', cases.length);
const by = {};
for (const c of cases) by[c.group_name] = (by[c.group_name] || 0) + 1;
console.log(by);
console.log('depends_missing', cases.filter((c) => c.depends_on_missing_docs).length);

function esc(s) {
  return String(s ?? '').replace(/'/g, "''");
}
function arr(a) {
  if (!a || !a.length) return "'{}'::text[]";
  return `ARRAY[${a.map((x) => `'${esc(x)}'`).join(',')}]::text[]`;
}
function uuidOrNull(u) {
  return u ? `'${u}'::uuid` : 'NULL';
}
function uuidArr(a) {
  const xs = (a || []).filter(Boolean);
  if (!xs.length) return `'{}'::uuid[]`;
  return `ARRAY[${xs.map((u) => `'${u}'::uuid`).join(',')}]`;
}

const stmts = [];
for (const c of cases) {
  stmts.push(`INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  '${esc(c.code)}', '${esc(c.name)}', '${esc(c.group_name)}', '${esc(c.test_type)}',
  ${c.category_name ? `'${esc(c.category_name)}'` : 'NULL'},
  ${c.subcategory_name ? `'${esc(c.subcategory_name)}'` : 'NULL'},
  ${uuidOrNull(c.expected_document_id)}, ${uuidArr(c.expected_document_ids)},
  '${esc(c.question)}',
  ${c.expected_answer ? `'${esc(c.expected_answer)}'` : 'NULL'},
  ${arr(c.required_words)}, ${arr(c.forbidden_words)},
  ${uuidOrNull(c.required_source_document_id)}, ${Number(c.min_score)},
  ${c.expect_no_answer}, ${c.notes ? `'${esc(c.notes)}'` : 'NULL'},
  'active', 1, ${!!c.depends_on_missing_docs}
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW()`);
}

fs.writeFileSync(new URL('./seed-statements.json', import.meta.url), JSON.stringify(stmts, null, 0));
console.log('wrote', stmts.length, 'statements');
