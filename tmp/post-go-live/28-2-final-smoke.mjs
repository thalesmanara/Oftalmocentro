import { writeFileSync } from 'fs';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';
const WARNING =
  '**Esta resposta apresenta um resumo das informações encontradas. Consulte o documento completo listado nas referências para verificar todos os detalhes.**';

async function api(method, path, token, body, timeoutMs = 180000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body != null ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 400) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

const out = { at: new Date().toISOString(), tests: [] };
function ok(name, pass, detail) {
  out.tests.push({ name, pass: !!pass, detail });
  console.log(pass ? 'OK' : 'FAIL', name, detail || '');
}

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
ok('login', !!token, { status: login.status });

const pwd7 = await api('POST', '/webhook/auth/change-password', token, {
  currentPassword: PASS,
  newPassword: '1234567',
  confirmPassword: '1234567',
});
ok('senha-7', pwd7.status === 400, { status: pwd7.status, code: pwd7.json?.error?.code });

// semantic after hybrid-v2 publish
const machine = await api('POST', '/webhook/consulta-ia', token, {
  question: 'Quais regras de conserto da máquina no plano de tecnologias?',
});
const mSources = machine.json?.data?.sources || [];
ok(
  'semantic-maquina-conserto',
  machine.status === 200 && mSources.length > 0,
  { status: machine.status, sources: mSources.length, titles: mSources.map((s) => s.documentTitle || s.title).slice(0, 3) },
);

const cnpj = await api('POST', '/webhook/consulta-ia', token, { question: 'Qual o CNPJ da clínica?' });
ok(
  'exact-cnpj',
  cnpj.status === 200 && !String(cnpj.json?.data?.answer || '').startsWith(WARNING) && String(cnpj.json?.data?.answer || '').length > 20,
  {
    status: cnpj.status,
    summarized: cnpj.json?.data?.isSummarizedResponse,
    len: String(cnpj.json?.data?.answer || '').length,
    answerHead: String(cnpj.json?.data?.answer || '').slice(0, 120),
  },
);

const resumo = await api('POST', '/webhook/consulta-ia', token, {
  question: 'Resuma o contrato social da Oftalmocentro.',
});
ok(
  'resumo-aviso',
  resumo.status === 200 && String(resumo.json?.data?.answer || '').startsWith(WARNING),
  { status: resumo.status, flagged: resumo.json?.data?.isSummarizedResponse },
);

// inactive out of IA
const docs = await api('GET', '/webhook/documents', token);
const list = docs.json?.data || [];
const target = list.find((d) => d.isActive !== false && /tecnolog/i.test(d.title || '')) || list.find((d) => d.processingStatus === 'processed');
if (target) {
  await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: false,
  });
  const q = await api('POST', '/webhook/consulta-ia', token, {
    question: `O que diz o documento "${target.title}"?`,
  });
  const titles = (q.json?.data?.sources || []).map((s) => String(s.documentTitle || s.title || ''));
  const leaked = titles.some((t) => t.includes(target.title.slice(0, 20)));
  ok('inactive-not-in-sources', q.status === 200 && !leaked, {
    doc: target.title.slice(0, 60),
    leaked,
    sourceTitles: titles.slice(0, 5),
  });
  await api('PUT', '/webhook/documents/update', token, {
    id: target.id,
    title: target.title,
    sectorId: target.sectorId,
    categoryId: target.categoryId,
    subcategoryId: target.subcategoryId ?? null,
    semanticDescription: target.semanticDescription ?? null,
    expirationDate: target.expirationDate ?? null,
    isActive: true,
  });
}

const live = await fetch('https://oftalmocentrouberaba.com.br/oftalmocentrointeligente/').then((r) => r.text());
const asset = (live.match(/assets\/index-[^"'\\s>]+\.js/) || [])[0];
out.liveFrontendAsset = asset;

writeFileSync('tmp/post-go-live/28-2-final-smoke.json', JSON.stringify(out, null, 2));
console.log('PASS', out.tests.filter((t) => t.pass).length, '/', out.tests.length);
console.log('live asset', asset);
