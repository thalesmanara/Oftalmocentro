/**
 * Etapa 17 smoke: login + GET prompts + GET compare + POST validate v2 + consulta-ia
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const BASE = process.env.N8N_BASE || 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = process.env.SMOKE_EMAIL || 'compras@oftalmocentrouberaba.com.br';
const PASS = process.env.SMOKE_PASS || '12345678';
const dir = dirname(fileURLToPath(import.meta.url));

const results = { startedAt: new Date().toISOString(), steps: [], pass: false };

function record(name, ok, detail) {
  results.steps.push({ name, ok, detail });
  console.log(ok ? 'PASS' : 'FAIL', name, typeof detail === 'string' ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200));
}

async function main() {
  // DB ids
  const client = new pg.Client({
    connectionString:
      process.env.PGURL ||
      'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
  });
  await client.connect();
  const { rows: versions } = await client.query(
    `SELECT id, version_number, status FROM ai_prompt_versions ORDER BY version_number`
  );
  const v1 = versions.find((v) => Number(v.version_number) === 1);
  const v2 = versions.find((v) => Number(v.version_number) === 2);
  record('db_versions', !!(v1 && v2 && v1.status === 'PUBLISHED' && v2.status === 'DRAFT'), {
    v1: v1?.id,
    v2: v2?.id,
    statuses: versions.map((v) => ({ n: v.version_number, s: v.status })),
  });
  await client.end();

  // Login
  const loginRes = await fetch(`${BASE}/webhook/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const loginJson = await loginRes.json().catch(() => ({}));
  const token =
    loginJson?.data?.token ||
    loginJson?.token ||
    loginJson?.accessToken ||
    loginJson?.data?.accessToken ||
    '';
  record('login', loginRes.ok && !!token, { status: loginRes.status, hasToken: !!token });
  if (!token) {
    results.finishedAt = new Date().toISOString();
    writeFileSync(join(dir, 'smoke-results.json'), JSON.stringify(results, null, 2));
    process.exit(1);
  }
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  // GET prompts
  const promptsRes = await fetch(`${BASE}/webhook/system/ai-prompts`, { headers: auth });
  const promptsJson = await promptsRes.json().catch(() => ({}));
  const items = promptsJson?.data?.items || promptsJson?.items || [];
  const main = items.find((i) => i.code === 'AI_QUERY_MAIN');
  record('get_prompts', promptsRes.ok && !!main?.publishedVersion, {
    status: promptsRes.status,
    count: items.length,
    publishedVersionNumber: main?.publishedVersion?.versionNumber,
  });

  // GET compare
  const compareUrl = `${BASE}/webhook/system/ai-prompts/compare?versionIdA=${encodeURIComponent(v1.id)}&versionIdB=${encodeURIComponent(v2.id)}`;
  const compareRes = await fetch(compareUrl, { headers: auth });
  const compareJson = await compareRes.json().catch(() => ({}));
  const cmp = compareJson?.data || compareJson;
  record('get_compare', compareRes.ok && cmp?.ok === true && !!cmp?.versionA && !!cmp?.versionB, {
    status: compareRes.status,
    ok: cmp?.ok,
    changedLines: cmp?.diff?.changedLines,
  });

  // POST validate v2
  const validateRes = await fetch(`${BASE}/webhook/system/ai-prompts/validate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ versionId: v2.id }),
  });
  const validateJson = await validateRes.json().catch(() => ({}));
  const val = validateJson?.data || validateJson;
  record('post_validate_v2', validateRes.ok && typeof val?.ok === 'boolean', {
    status: validateRes.status,
    ok: val?.ok,
    errors: val?.errors,
    warnings: val?.warnings,
  });

  // Consulta IA smoke
  const consultaRes = await fetch(`${BASE}/webhook/consulta-ia`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ pergunta: 'Qual o horário de funcionamento da clínica?' }),
  });
  const consultaJson = await consultaRes.json().catch(() => ({}));
  const answer =
    consultaJson?.data?.answer ||
    consultaJson?.data?.resposta ||
    consultaJson?.answer ||
    consultaJson?.resposta ||
    '';
  const blob = JSON.stringify(consultaJson);
  const leaksPrompt = blob.includes('Você é a IA interna');
  record('consulta_ia', consultaRes.ok && !!answer && !leaksPrompt, {
    status: consultaRes.status,
    answerLen: String(answer).length,
    leaksPrompt,
  });

  // Confirm v2 still DRAFT
  const client2 = new pg.Client({
    connectionString:
      process.env.PGURL ||
      'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
  });
  await client2.connect();
  const { rows: v2rows } = await client2.query(`SELECT status FROM ai_prompt_versions WHERE id = $1`, [v2.id]);
  record('v2_still_draft', v2rows[0]?.status === 'DRAFT' || v2rows[0]?.status === 'VALIDATING' || v2rows[0]?.status === 'REJECTED', {
    status: v2rows[0]?.status,
  });
  // Prefer DRAFT after validate success
  if (v2rows[0]?.status === 'VALIDATING') {
    // validate may leave VALIDATING briefly; check again after finish path should be DRAFT/REJECTED
  }
  await client2.end();

  results.pass = results.steps.every((s) => s.ok);
  results.finishedAt = new Date().toISOString();
  writeFileSync(join(dir, 'smoke-results.json'), JSON.stringify(results, null, 2));
  console.log('OVERALL', results.pass ? 'PASS' : 'FAIL');
  process.exit(results.pass ? 0 : 1);
}

main().catch((e) => {
  results.steps.push({ name: 'fatal', ok: false, detail: String(e.stack || e) });
  results.finishedAt = new Date().toISOString();
  writeFileSync(join(dir, 'smoke-results.json'), JSON.stringify(results, null, 2));
  console.error(e);
  process.exit(1);
});
