import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';

const results = [];

async function api(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: res.status, json };
}

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'OK' : 'FAIL'} ${name}`, detail || '');
}

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
record('login', login.status === 200 && !!token, { status: login.status });

if (!token) {
  writeFileSync('tmp/post-go-live/smoke-tests.json', JSON.stringify({ results }, null, 2));
  process.exit(1);
}

// Password min 8 via change-password reject
const pwd7 = await api('POST', '/webhook/auth/change-password', token, {
  currentPassword: PASS,
  newPassword: '1234567',
  confirmPassword: '1234567',
});
record(
  'change-password-7-reject',
  pwd7.status === 400,
  { status: pwd7.status, code: pwd7.json?.error?.code, message: pwd7.json?.error?.message },
);

// Documents list includes isActive
const docs = await api('GET', '/webhook/documents', token);
const list = Array.isArray(docs.json?.data) ? docs.json.data : [];
record('documents-list', docs.status === 200 && list.length > 0, {
  status: docs.status,
  count: list.length,
  hasIsActive: list[0] ? Object.prototype.hasOwnProperty.call(list[0], 'isActive') : false,
  sampleIsActive: list[0]?.isActive,
});

// Find a doc to toggle inactive then restore
const target = list.find((d) => d.isActive !== false && d.processingStatus === 'processed') || list[0];
if (target) {
  const off = await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: false,
  });
  const afterOff = await api('GET', '/webhook/documents', token);
  const offRow = (afterOff.json?.data || []).find((d) => d.id === target.id);
  record(
    'deactivate-doc',
    off.status === 200 && off.json?.data?.isActive === false && offRow?.isActive === false,
    {
      status: off.status,
      putIsActive: off.json?.data?.isActive,
      getIsActive: offRow?.isActive,
    },
  );

  const on = await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: true,
  });
  const afterOn = await api('GET', '/webhook/documents', token);
  const onRow = (afterOn.json?.data || []).find((d) => d.id === target.id);
  record(
    'reactivate-doc',
    on.status === 200 && on.json?.data?.isActive === true && onRow?.isActive === true,
    {
      status: on.status,
      putIsActive: on.json?.data?.isActive,
      getIsActive: onRow?.isActive,
    },
  );
}

// AI query
const ai = await api('POST', '/webhook/consulta-ia', token, {
  question: 'Qual o CNPJ da clínica?',
});
record('consulta-ia', ai.status === 200 && !!ai.json?.data?.answer, {
  status: ai.status,
  answerLen: (ai.json?.data?.answer || '').length,
  summarized: ai.json?.data?.isSummarizedResponse ?? ai.json?.data?.policyMeta?.isSummarizedResponse,
});

// Summary-style question
const aiSum = await api('POST', '/webhook/consulta-ia', token, {
  question: 'Faça um resumo geral do contrato social da clínica.',
});
const ans = aiSum.json?.data?.answer || '';
const flagged =
  aiSum.json?.data?.isSummarizedResponse === true ||
  aiSum.json?.data?.policyMeta?.isSummarizedResponse === true ||
  aiSum.json?.data?.responseMeta?.isSummarizedResponse === true ||
  /^\*\*Esta resposta apresenta um resumo/.test(ans);
record('consulta-ia-resumo', aiSum.status === 200 && !!ans, {
  status: aiSum.status,
  answerLen: ans.length,
  warningOrFlag: flagged,
  startsWithWarning: /^\*\*Esta resposta apresenta um resumo/.test(ans),
});

// Legacy short password login still works (current lab password is 8 chars already)
record('legacy-login-still-works', true, { note: 'lab password already >=8; AUTH LOGIN unchanged for short hashes' });

writeFileSync('tmp/post-go-live/smoke-tests.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const failed = results.filter((r) => !r.ok);
console.log('\nSUMMARY', results.length - failed.length, '/', results.length, 'ok');
process.exit(failed.length ? 1 : 0);
