/**
 * Etapa 28.3 — Blind semantic generalization A/B: hybrid-v1 vs hybrid-v2
 */
import { writeFileSync } from 'fs';
import pg from 'pg';

const BASE = 'https://n8n.oftalmocentrouberaba.cloud';
const EMAIL = 'compras@oftalmocentrouberaba.com.br';
const PASS = '12345678';
const TIMEOUT_MS = 180000;
const WARNING =
  '**Esta resposta apresenta um resumo das informações encontradas. Consulte o documento completo listado nas referências para verificar todos os detalhes.**';

const PG =
  'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n';

async function api(method, path, token, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
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
      json = { raw: text.slice(0, 600) };
    }
    return { status: res.status, json };
  } finally {
    clearTimeout(t);
  }
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function inDictionary(term, dict) {
  const t = norm(term);
  if (dict.has(t)) return true;
  for (const [k, vals] of dict.entries()) {
    if (norm(k) === t) return true;
    for (const v of vals) if (norm(v) === t) return true;
  }
  return false;
}

function pairNotInDict(termA, termB, dict) {
  return !inDictionary(termA, dict) && !inDictionary(termB, dict);
}

function sourceDocIds(sources) {
  return (sources || []).map((s) => String(s.documentId || s.id || s.document_id || ''));
}

function sourceTitles(sources) {
  return (sources || []).map((s) => String(s.documentTitle || s.title || ''));
}

function evalRetrieval(sources, expectedDocumentId) {
  const ids = sourceDocIds(sources);
  const k = ids.length;
  const rank = ids.findIndex((id) => id === expectedDocumentId);
  const hit = rank >= 0;
  const mrr = hit ? 1 / (rank + 1) : 0;
  const recallAtK = hit ? 1 : 0; // single relevant doc
  const precisionRough = k > 0 && hit ? 1 / k : 0;
  return { hit, rank: hit ? rank + 1 : null, mrr, recallAtK, precisionRough, k };
}

function avg(arr) {
  const xs = arr.filter((n) => Number.isFinite(n));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function buildCases(dictMap) {
  const cases = [];
  const add = (c) => {
    if (c.termA && c.termB && !pairNotInDict(c.termA, c.termB, dictMap)) {
      throw new Error(`Pair in dictionary: ${c.id} ${c.termA}/${c.termB}`);
    }
    if (c.termA && inDictionary(c.termA, dictMap)) throw new Error(`termA in dict: ${c.id}`);
    if (c.termB && inDictionary(c.termB, dictMap)) throw new Error(`termB in dict: ${c.id}`);
    cases.push({ ...c, wasInDictionary: false });
  };

  // --- 10 semantic pairs (NOT in dictionary) ---
  const semantic = [
    {
      id: 'sem-01',
      category: 'semantic',
      termA: 'lavanderia hospitalar',
      termB: 'serviço de rouparia clínica',
      question: 'Qual contrato regula o serviço de rouparia clínica da clínica?',
      expectedDocumentId: '63e80ccb-2ebe-4464-9ad5-ff483a8a8bec',
      expectedDocumentTitle: 'CONTRATO PRESTAÇÃO DE SERVIÇOS DE LAVANDERIA FAEPU 01/07/2024',
    },
    {
      id: 'sem-02',
      category: 'semantic',
      termA: 'aluguel do imóvel sede',
      termB: 'locação da sede oftalmológica',
      question: 'Até quando vai a locação da sede oftalmológica?',
      expectedDocumentId: '102e4aa0-261f-4bea-b252-1554074c2359',
      expectedDocumentTitle: 'ADITIVO CONTRATUAL LOCAÇÃO SEDE OFTALMOCENTRO 2025 A 2045 - ASSINADO',
    },
    {
      id: 'sem-03',
      category: 'semantic',
      termA: 'vigilância sanitária',
      termB: 'licença da secretaria de saúde',
      question: 'Documento de licença da secretaria de saúde para funcionamento clínico',
      expectedDocumentId: 'd19ac5f2-cc0d-4da4-abdb-9ebbb38fd6f3',
      expectedDocumentTitle: 'ALVARÁ DE LICENÇA SANITÁTIA EMITIDO EM 13/07/2023',
    },
    {
      id: 'sem-04',
      category: 'semantic',
      termA: 'corpo clínico',
      termB: 'cadastro nacional de estabelecimento de saúde',
      question: 'Onde consta o registro do corpo clínico no cadastro nacional de estabelecimento de saúde?',
      expectedDocumentId: 'c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f',
      expectedDocumentTitle: 'CADASTRO NACIONAL DE ESTABELECIMENTO DE SAÚDE BASE LOCAL',
    },
    {
      id: 'sem-05',
      category: 'semantic',
      termA: 'diretoria clínica',
      termB: 'ato constitutivo da diretoria',
      question: 'Quem compõe a diretoria clínica segundo o ato constitutivo?',
      expectedDocumentId: 'af8f1ffa-8146-4645-8026-90583990984f',
      expectedDocumentTitle: 'ATO CONSTITUTIVO DA DIRETORIA DA OFTALMOCENTRO',
    },
    {
      id: 'sem-06',
      category: 'semantic',
      termA: 'gás medicinal',
      termB: 'ficha de segurança do oxigênio',
      question: 'Ficha de segurança do oxigênio medicinal disponível na clínica',
      expectedDocumentId: 'bc733c80-d0e0-4d90-ba12-1598244a3404',
      expectedDocumentTitle: 'FISPQ OXIGÊNIO MEDICINAL',
    },
    {
      id: 'sem-07',
      category: 'semantic',
      termA: 'lentes intraoculares',
      termB: 'biometria ocular cirúrgica',
      question: 'Manual sobre biometria ocular e cálculo de lentes para cirurgia',
      expectedDocumentId: 'b533f80a-9b19-47c0-b4ab-210590846228',
      expectedDocumentTitle: 'BIOMETRIA E CÁLCULO DE LENTES INTRA OCULARES DA TEORIA À PRÁTICA CIRÚRGICA',
    },
    {
      id: 'sem-08',
      category: 'semantic',
      termA: 'estacionamento de pacientes',
      termB: 'locação da travessa Satyro Silva Oliveira',
      question: 'Contrato de locação do estacionamento na travessa Satyro Silva Oliveira',
      expectedDocumentId: 'a90d7c80-1693-4a7a-93f1-ec2206e3680c',
      expectedDocumentTitle: 'CONTRATO LOCAÇÃO ESTACIONAMENTO PACIENTES - SATYRO SILVA OLIVEIRA',
    },
    {
      id: 'sem-09',
      category: 'semantic',
      termA: 'climatização',
      termB: 'contrato de ar condicionado',
      question: 'Contrato de manutenção de ar condicionado da clínica',
      expectedDocumentId: 'c9428c52-8d23-492a-bd95-537e04856498',
      expectedDocumentTitle: 'CONTRATO DE MANUTENÇÃO APARELHOS DE AR CONDICIONADO',
    },
    {
      id: 'sem-10',
      category: 'semantic',
      termA: 'impacto ambiental',
      termB: 'licenciamento ambiental',
      question: 'Certificado de licenciamento ambiental da Oftalmocentro',
      expectedDocumentId: 'ed7aa0c2-1b20-4480-84d1-f7627b45a7d8',
      expectedDocumentTitle: 'CERTIFICADO DE LICENCIAMENTO AMBIENTAL',
    },
  ];
  semantic.forEach(add);

  // --- 10 paraphrases ---
  const paraphrase = [
    {
      id: 'para-01',
      category: 'paraphrase',
      questionA: 'Quais são as regras do plano de gerenciamento de tecnologias?',
      questionB: 'Como a clínica controla manutenções preditivas, preventivas e corretivas do parque tecnológico?',
      question: 'Como a clínica controla manutenções preditivas, preventivas e corretivas do parque tecnológico?',
      expectedDocumentId: '571f818d-2f24-4173-8dee-3036cb7c0f83',
      expectedDocumentTitle: 'PLANO DE GERENCIAMENTO DE TECNOLOGIAS',
    },
    {
      id: 'para-02',
      category: 'paraphrase',
      questionA: 'Qual o contrato social mais recente?',
      questionB: 'Décima primeira alteração consolidada do contrato social da empresa',
      question: 'Décima primeira alteração consolidada do contrato social da empresa',
      expectedDocumentId: '6bf331ee-0884-4b38-8a9e-faedf937f8a3',
      expectedDocumentTitle: 'CONTRATO SOCIAL - 11ª ALTERAÇÃO',
    },
    {
      id: 'para-03',
      category: 'paraphrase',
      questionA: 'Certidão COREN da enfermeira Jordana',
      questionB: 'Comprovante de regularidade profissional da enfermeira Jordana perante o conselho de enfermagem',
      question: 'Comprovante de regularidade profissional da enfermeira Jordana perante o conselho de enfermagem',
      expectedDocumentId: 'e61eeda6-3045-4a2d-bb5b-4bcbe4756207',
      expectedDocumentTitle: 'CERTIDÃO DE REGULARIDADE COREN - ENFERMEIRA JORDANA',
    },
    {
      id: 'para-04',
      category: 'paraphrase',
      questionA: 'AVCB vigente',
      questionB: 'Certificado do corpo de bombeiros válido até 2029 para a edificação',
      question: 'Certificado do corpo de bombeiros válido até 2029 para a edificação',
      expectedDocumentId: 'a302ac20-dc23-4e4c-b49b-9d57808a8f77',
      expectedDocumentTitle: 'AVCB - AUTO DE VISTORIA DO CORPO DE BOMBEIROS 21/11/2029',
    },
    {
      id: 'para-05',
      category: 'paraphrase',
      questionA: 'Regimento de enfermagem',
      questionB: 'Normas gerais de funcionamento do serviço de enfermagem da instituição',
      question: 'Normas gerais de funcionamento do serviço de enfermagem da instituição',
      expectedDocumentId: '9022fe88-4da1-43c6-87db-57ddc6e0270e',
      expectedDocumentTitle: 'REGIMENTO INTERNO DO SERVIÇO DE ENFERMAGEM - ARQUIVO WORD',
    },
    {
      id: 'para-06',
      category: 'paraphrase',
      questionA: 'Aditivo Guiron manutenção equipamentos',
      questionB: 'Termo aditivo ao contrato de gestão e manutenção com a Guiron Soluções',
      question: 'Termo aditivo ao contrato de gestão e manutenção com a Guiron Soluções',
      expectedDocumentId: '60a04d2a-7c93-423b-8c6d-721cf2b026bd',
      expectedDocumentTitle: 'ADITIVO CONSTRATUAL AO CONTRATO DE MANUTENÇÃO DE EQUIPAMENTOS',
    },
    {
      id: 'para-07',
      category: 'paraphrase',
      questionA: 'CRT enfermeira Jordana Borges',
      questionB: 'Certidão de responsabilidade técnica de enfermagem da Jordana Borges 2026',
      question: 'Certidão de responsabilidade técnica de enfermagem da Jordana Borges 2026',
      expectedDocumentId: 'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1',
      expectedDocumentTitle: 'ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA COREN - JORDANA BORGES 2026',
    },
    {
      id: 'para-08',
      category: 'paraphrase',
      questionA: 'Tabela de preços particulares',
      questionB: 'Valores de consultas e exames para pacientes particulares e cartões desconto',
      question: 'Valores de consultas e exames para pacientes particulares e cartões desconto',
      expectedDocumentId: '791232df-765c-412d-8bc2-2b2ecfd15f4f',
      expectedDocumentTitle: 'TABELA DE PREÇOS CONSULTAS E EXAMES PARTICULARES',
    },
    {
      id: 'para-09',
      category: 'paraphrase',
      questionA: 'POP nobreak centro cirúrgico',
      questionB: 'Procedimento operacional padrão para verificação de autonomia dos nobreaks do centro cirúrgico',
      question: 'Procedimento operacional padrão para verificação de autonomia dos nobreaks do centro cirúrgico',
      expectedDocumentId: '1a3520b6-a0db-4b96-8459-4ff825008337',
      expectedDocumentTitle: 'PROCEDIMENTO OPERACIONAL PADRA - ROTINA DE VERIFICAÇÃO NOBREAK - ARQUIVO WORD',
    },
    {
      id: 'para-10',
      category: 'paraphrase',
      questionA: 'Certidão direção técnica CRM',
      questionB: 'Documento do conselho regional de medicina sobre a diretora técnica Hélia Soares Angotti',
      question: 'Documento do conselho regional de medicina sobre a diretora técnica Hélia Soares Angotti',
      expectedDocumentId: 'c0009c91-d64e-44c1-bc28-e892f4ea358b',
      expectedDocumentTitle: 'CERTIDÃO DE DIREÇÃO TECNICA CRMMG',
    },
  ];
  paraphrase.forEach(add);

  // --- 5 technical vs popular ---
  const techPopular = [
    {
      id: 'tech-01',
      category: 'technical_vs_popular',
      termA: 'FISPQ',
      termB: 'ficha com dados de segurança',
      question: 'Ficha com dados de segurança do nitrogênio medicinal',
      expectedDocumentId: '20160a33-fa4e-48b5-9ff1-be69d80a8c78',
      expectedDocumentTitle: 'FISPQ NITROGÊNIO MEDICINAL',
    },
    {
      id: 'tech-02',
      category: 'technical_vs_popular',
      termA: 'CNES',
      termB: 'cadastro nacional de estabelecimentos de saúde',
      question: 'Cadastro nacional de estabelecimentos de saúde base nacional da clínica',
      expectedDocumentId: 'd80deafd-f0f2-4fd5-a2d7-2a4929565d23',
      expectedDocumentTitle: 'CADASTRO NACIONAL DE ESTABELECIMENTO DE SAÚDE BASE NACIONAL',
    },
    {
      id: 'tech-03',
      category: 'technical_vs_popular',
      termA: 'ART incêndio',
      termB: 'anotação de responsabilidade técnica projeto de combate a incêndio',
      question: 'Anotação de responsabilidade técnica para elaboração de projeto de combate a incêndio',
      expectedDocumentId: 'abe008c7-c9b8-4d6b-bc5f-a0f197722484',
      expectedDocumentTitle: 'ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA PARA ELABORAÇÃO DE PROJETO DE INCÊNDIO',
    },
    {
      id: 'tech-04',
      category: 'technical_vs_popular',
      termA: 'LIO',
      termB: 'lente intra ocular',
      question: 'Termo de ciência sobre escolha de lente intra ocular pelo paciente',
      expectedDocumentId: 'a02d647e-6487-47ce-9b37-6ea7ee5e8c09',
      expectedDocumentTitle: 'TERMO DE CIENCIA - LENTE INTRA OCULAR',
    },
    {
      id: 'tech-05',
      category: 'technical_vs_popular',
      termA: 'CRT',
      termB: 'certidão de responsabilidade técnica enfermagem',
      question: 'Certidão de responsabilidade técnica de enfermagem Jordana Borges',
      expectedDocumentId: 'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1',
      expectedDocumentTitle: 'ANOTAÇÃO DE RESPONSABILIDADE TÉCNICA COREN - JORDANA BORGES 2026',
    },
  ];
  techPopular.forEach(add);

  // --- 5 verb vs noun/concept ---
  const verbNoun = [
    {
      id: 'verb-01',
      category: 'verb_vs_noun',
      termA: 'locar consultório',
      termB: 'comodato de consultório',
      question: 'Contrato de comodato de consultório com Dr Leandro Araujo Fernandes',
      expectedDocumentId: '47f9c125-b4df-439c-89de-54a34b751c1b',
      expectedDocumentTitle: 'CONTRATO DE COMODATO DE CONSULTÓRIO - DR LEANDRO ARAUJO FERNANDES',
    },
    {
      id: 'verb-02',
      category: 'verb_vs_noun',
      termA: 'inspecionar sanitariamente',
      termB: 'protocolo de alvará sanitário',
      question: 'Protocolo de requerimento de alvará de licença sanitária',
      expectedDocumentId: '14e1260e-c935-4526-a703-095812c9a3da',
      expectedDocumentTitle: 'PROTOCOLO DE REQUERIMENTO DE ALVARÁ DE LICENÇA SANITÁRIA',
    },
    {
      id: 'verb-03',
      category: 'verb_vs_noun',
      termA: 'registrar empresa',
      termB: 'cadastro mobiliário municipal',
      question: 'Cadastro mobiliário e inscrição junto à prefeitura de Uberaba',
      expectedDocumentId: '59a181fe-702d-48aa-ad6f-959a6840933c',
      expectedDocumentTitle: 'CADASTRO MOBILIÁRIO PREFEITURA MUNICIPAL DE UBERABA',
    },
    {
      id: 'verb-04',
      category: 'verb_vs_noun',
      termA: 'estender contrato lavanderia',
      termB: 'segundo aditivo FAEPU',
      question: 'Segundo aditivo ao contrato de prestação de serviços com a lavanderia FAEPU',
      expectedDocumentId: 'cddc0ca8-4794-4556-8093-553a9bdab8a2',
      expectedDocumentTitle: 'SEGUNDO ADITIVO AO  CONTRATO DE PRESTAÇÃO DE SERVIÇOS COM A LAVANDERIA FAEPU ASSINADO EM 10/06/2026',
    },
    {
      id: 'verb-05',
      category: 'verb_vs_noun',
      termA: 'verificar nobreak',
      termB: 'rotina POP nobreak',
      question: 'Rotina de verificação de nobreaks para contingência de energia no centro cirúrgico',
      expectedDocumentId: '1a3520b6-a0db-4b96-8459-4ff825008337',
      expectedDocumentTitle: 'PROCEDIMENTO OPERACIONAL PADRA - ROTINA DE VERIFICAÇÃO NOBREAK - ARQUIVO WORD',
    },
  ];
  verbNoun.forEach(add);

  // --- 5 abbreviation vs full name ---
  const abbrev = [
    {
      id: 'abbr-01',
      category: 'abbreviation',
      termA: 'CNPJ',
      termB: 'cadastro nacional da pessoa jurídica',
      question: 'Cadastro nacional da pessoa jurídica da Oftalmocentro',
      expectedDocumentId: '206e4db5-10b6-42a6-995b-4d1a2b15edc6',
      expectedDocumentTitle: 'CARTÃO CNPJ - 20072026',
    },
    {
      id: 'abbr-02',
      category: 'abbreviation',
      termA: 'AVCB',
      termB: 'auto de vistoria do corpo de bombeiros',
      question: 'Auto de vistoria do corpo de bombeiros válido até novembro de 2029',
      expectedDocumentId: 'a302ac20-dc23-4e4c-b49b-9d57808a8f77',
      expectedDocumentTitle: 'AVCB - AUTO DE VISTORIA DO CORPO DE BOMBEIROS 21/11/2029',
    },
    {
      id: 'abbr-03',
      category: 'abbreviation',
      termA: 'COREN',
      termB: 'conselho regional de enfermagem',
      question: 'Certidão de regularidade da enfermeira Bianca no conselho regional de enfermagem',
      expectedDocumentId: '9db556e3-8140-4cb8-94d1-7b5173c199ad',
      expectedDocumentTitle: 'CERTIDÃO DE REGULARIDADE COREN - ENFERMEIRA BIANCA',
    },
    {
      id: 'abbr-04',
      category: 'abbreviation',
      termA: 'POP',
      termB: 'procedimento operacional padrão',
      question: 'Procedimento operacional padrão de verificação de nobreak',
      expectedDocumentId: '1a3520b6-a0db-4b96-8459-4ff825008337',
      expectedDocumentTitle: 'PROCEDIMENTO OPERACIONAL PADRA - ROTINA DE VERIFICAÇÃO NOBREAK - ARQUIVO WORD',
    },
    {
      id: 'abbr-05',
      category: 'abbreviation',
      termA: 'CRMMG',
      termB: 'conselho regional de medicina de minas gerais',
      question: 'Certificado de regularidade técnica do conselho regional de medicina de minas gerais 2026',
      expectedDocumentId: 'bf7bca54-5db5-4135-8b04-2aa8fb63a374',
      expectedDocumentTitle: 'CERTIFICADO DE REGULARIDADE TÉCNICA 2026',
    },
  ];
  abbrev.forEach(add);

  // --- Special cases ---
  add({
    id: 'exact-cnpj',
    category: 'exact_identifier',
    question: 'Qual o CNPJ da Oftalmocentro Uberaba Ltda?',
    expectedDocumentId: '206e4db5-10b6-42a6-995b-4d1a2b15edc6',
    expectedDocumentTitle: 'CARTÃO CNPJ - 20072026',
  });
  add({
    id: 'ocr-ish',
    category: 'ocr_noisy',
    question: 'ALVARA SAN ITARlo clinica oftalmologica Uberaba CNPJ 01.609.274/0001-45',
    expectedDocumentId: 'd19ac5f2-cc0d-4da4-abdb-9ebbb38fd6f3',
    expectedDocumentTitle: 'ALVARÁ DE LICENÇA SANITÁTIA EMITIDO EM 13/07/2023',
  });
  add({
    id: 'tabular',
    category: 'tabular',
    question: 'Relação de funcionários do quadro de enfermagem com CPF e registro COREN',
    expectedDocumentId: 'd33816da-475a-46e9-bdb4-9e68bc9c7139',
    expectedDocumentTitle: 'RELAÇÃO DE FUNCIONÁRIOS QUADRO DE ENFERMAGEM - ARQUIVO EXCEL',
  });
  add({
    id: 'negative',
    category: 'negative',
    question: 'Qual a política de férias e benefícios CLT dos funcionários administrativos?',
    expectedDocumentId: null,
    expectedDocumentTitle: null,
    expectNoHit: true,
  });

  return cases;
}

async function runConsulta(token, question, versionId) {
  const t0 = Date.now();
  const r = await api('POST', '/webhook/consulta-ia', token, {
    question,
    retrievalConfigVersionId: versionId,
    modeOverrideAllowed: true,
  });
  const latencyMs = Date.now() - t0;
  const data = r.json?.data || {};
  const sources = Array.isArray(data.sources) ? data.sources : [];
  return {
    status: r.status,
    latencyMs,
    sources,
    sourceCount: sources.length,
    sourceIds: sourceDocIds(sources),
    sourceTitles: sourceTitles(sources),
    answerLen: String(data.answer || '').length,
    retrievalMeta: data.retrievalMeta || data.pipelineMeta || null,
    error: r.json?.error || (r.status !== 200 ? r.json : null),
  };
}

function aggregateRuns(runs, cases) {
  const byCategory = {};
  let hits = 0;
  let mrrSum = 0;
  let recallSum = 0;
  let precSum = 0;
  let latSum = 0;
  let n = 0;

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const c = cases[i];
    const cat = c.category;
    byCategory[cat] = byCategory[cat] || { n: 0, hits: 0, mrr: 0, latency: 0 };
    byCategory[cat].n++;
    byCategory[cat].latency += run.latencyMs;

    if (c.expectNoHit) {
      const noSources = run.sourceCount === 0;
      const ok = noSources || !run.sourceIds.some((id) => id);
      if (ok) {
        byCategory[cat].hits++;
        hits++;
      }
      n++;
      latSum += run.latencyMs;
      continue;
    }

    const m = evalRetrieval(run.sources, c.expectedDocumentId);
    run.metrics = m;
    if (m.hit) {
      hits++;
      byCategory[cat].hits++;
    }
    mrrSum += m.mrr;
    recallSum += m.recallAtK;
    precSum += m.precisionRough;
    byCategory[cat].mrr += m.mrr;
    latSum += run.latencyMs;
    n++;
  }

  return {
    n,
    hitRate: n ? hits / n : 0,
    mrr: n ? mrrSum / n : 0,
    recallAtK: n ? recallSum / n : 0,
    precisionRough: n ? precSum / n : 0,
    avgLatencyMs: n ? latSum / n : 0,
    byCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [
        k,
        {
          n: v.n,
          hitRate: v.n ? v.hits / v.n : 0,
          mrr: v.mrr / v.n,
          avgLatencyMs: v.latency / v.n,
        },
      ]),
    ),
  };
}

// --- main ---
const client = new pg.Client({ connectionString: PG });
await client.connect();

const retRows = await client.query(
  `SELECT id, version_label, status, configuration->'lexicalExpansion'->'dictionary' AS dictionary
   FROM ai_retrieval_config_versions WHERE version_label IN ('hybrid-v1','hybrid-v2')`,
);
const v1 = retRows.rows.find((r) => r.version_label === 'hybrid-v1');
const v2 = retRows.rows.find((r) => r.version_label === 'hybrid-v2');
const rawDict = v2?.dictionary || {};
const dictMap = new Map(Object.entries(rawDict));

const blindCases = buildCases(dictMap);
writeFileSync('tmp/post-go-live/28-3-blind-cases.json', JSON.stringify({ at: new Date().toISOString(), dictionaryKeys: [...dictMap.keys()], cases: blindCases }, null, 2));
console.log('Cases:', blindCases.length);

const login = await api('POST', '/webhook/auth/login', null, { email: EMAIL, password: PASS });
const token = login.json?.data?.token;
if (!token) {
  writeFileSync('tmp/post-go-live/28-3-blind-ab-results.json', JSON.stringify({ error: 'login failed', login }, null, 2));
  process.exit(1);
}

// Summary warning checks
const summaryChecks = [];
for (const sc of [
  { name: 'explicit-resumo', question: 'Resuma o procedimento de gerenciamento de tecnologias da clínica.', expectSummarized: true },
  { name: 'pontual-cnpj', question: 'Qual o CNPJ da clínica?', expectSummarized: false },
]) {
  const r = await api('POST', '/webhook/consulta-ia', token, { question: sc.question });
  const data = r.json?.data || {};
  const answer = String(data.answer || '');
  const flagged =
    data.isSummarizedResponse === true ||
    data.policyMeta?.isSummarizedResponse === true ||
    data.responseMeta?.isSummarizedResponse === true;
  const starts = answer.startsWith(WARNING);
  summaryChecks.push({
    name: sc.name,
    expectSummarized: sc.expectSummarized,
    flagged,
    startsWithWarning: starts,
    ok: r.status === 200 && flagged === sc.expectSummarized && (!sc.expectSummarized || starts),
    reasons: data.policyMeta?.summarizedReasonCodes || [],
  });
  console.log('SUMMARY', sc.name, summaryChecks.at(-1).ok);
}

const runsA = [];
const runsB = [];
for (let i = 0; i < blindCases.length; i++) {
  const c = blindCases[i];
  console.log(`[${i + 1}/${blindCases.length}] ${c.id} A...`);
  const a = await runConsulta(token, c.question, v1.id);
  a.caseId = c.id;
  runsA.push(a);
  console.log(`[${i + 1}/${blindCases.length}] ${c.id} B... hitA=${a.metrics?.hit ?? (c.expectNoHit ? a.sourceCount === 0 : sourceDocIds(a.sources).includes(c.expectedDocumentId))}`);
  const b = await runConsulta(token, c.question, v2.id);
  b.caseId = c.id;
  runsB.push(b);
  console.log(`[${i + 1}/${blindCases.length}] ${c.id} done B hit=${b.metrics?.hit ?? (c.expectNoHit ? b.sourceCount === 0 : sourceDocIds(b.sources).includes(c.expectedDocumentId))}`);
}

const metricsA = aggregateRuns(runsA, blindCases);
const metricsB = aggregateRuns(runsB, blindCases);

const blindCategories = ['semantic', 'paraphrase', 'technical_vs_popular', 'verb_vs_noun', 'abbreviation'];
function catHitRate(metrics, cat) {
  return metrics.byCategory[cat]?.hitRate ?? 0;
}
const unknownParaphraseA = avg(blindCategories.slice(0, 2).map((c) => catHitRate(metricsA, c)));
const unknownParaphraseB = avg(blindCategories.slice(0, 2).map((c) => catHitRate(metricsB, c)));
const exactA = metricsA.byCategory.exact_identifier?.hitRate ?? 0;
const exactB = metricsB.byCategory.exact_identifier?.hitRate ?? 0;
const exactOk = exactB >= exactA;

const recommendKeepHybridV2 =
  (unknownParaphraseB >= unknownParaphraseA || metricsB.hitRate >= metricsA.hitRate) && exactOk;

const perCase = blindCases.map((c, i) => ({
  ...c,
  hybridV1: { ...runsA[i].metrics, latencyMs: runsA[i].latencyMs, sourceCount: runsA[i].sourceCount, rank: runsA[i].metrics?.rank },
  hybridV2: { ...runsB[i].metrics, latencyMs: runsB[i].latencyMs, sourceCount: runsB[i].sourceCount, rank: runsB[i].metrics?.rank },
  deltaHit: (runsB[i].metrics?.hit ? 1 : 0) - (runsA[i].metrics?.hit ? 1 : 0),
}));

const results = {
  at: new Date().toISOString(),
  versionIds: { hybridV1: v1.id, hybridV2: v2.id },
  dictionaryLoadedFrom: 'hybrid-v2.configuration.lexicalExpansion.dictionary',
  dictionaryKeyCount: dictMap.size,
  caseCount: blindCases.length,
  summaryChecks,
  summaryChecksOk: summaryChecks.every((s) => s.ok),
  metrics: {
    hybridV1: metricsA,
    hybridV2: metricsB,
    delta: {
      hitRate: metricsB.hitRate - metricsA.hitRate,
      mrr: metricsB.mrr - metricsA.mrr,
      recallAtK: metricsB.recallAtK - metricsA.recallAtK,
      precisionRough: metricsB.precisionRough - metricsA.precisionRough,
      avgLatencyMs: metricsB.avgLatencyMs - metricsA.avgLatencyMs,
      unknownParaphraseHitRate: unknownParaphraseB - unknownParaphraseA,
    },
  },
  decision: {
    recommendKeepHybridV2,
    exactOk,
    unknownParaphraseV1: unknownParaphraseA,
    unknownParaphraseV2: unknownParaphraseB,
    hitRateV1: metricsA.hitRate,
    hitRateV2: metricsB.hitRate,
    mrrV1: metricsA.mrr,
    mrrV2: metricsB.mrr,
    rationale:
      recommendKeepHybridV2
        ? 'hybrid-v2 mantém ou melhora hit em unknown/paraphrase sem regressão em exact identifier'
        : 'hybrid-v2 não supera hybrid-v1 em generalização semântica ou regrediu em exact',
  },
  perCase,
};

writeFileSync('tmp/post-go-live/28-3-blind-ab-results.json', JSON.stringify(results, null, 2));

const md = `# Etapa 28.3 — Blind semantic A/B (hybrid-v1 vs hybrid-v2)

**Data:** ${results.at}

## Config
- hybrid-v1: \`${v1.id}\` (${v1.status})
- hybrid-v2: \`${v2.id}\` (${v2.status})
- Dictionary keys (v2): ${dictMap.size} — pairs **not** added during test

## Casos
- Total: **${blindCases.length}** (todos \`wasInDictionary: false\` nos pares inventados)
- semantic: 10 | paraphrase: 10 | technical_vs_popular: 5 | verb_vs_noun: 5 | abbreviation: 5
- extras: exact CNPJ, OCR-ish, tabular, negative

## Métricas (sources)

| Métrica | hybrid-v1 | hybrid-v2 | Δ |
|---------|-----------|-----------|---|
| Hit Rate | ${(metricsA.hitRate * 100).toFixed(1)}% | ${(metricsB.hitRate * 100).toFixed(1)}% | ${((metricsB.hitRate - metricsA.hitRate) * 100).toFixed(1)}pp |
| MRR | ${metricsA.mrr.toFixed(3)} | ${metricsB.mrr.toFixed(3)} | ${(metricsB.mrr - metricsA.mrr).toFixed(3)} |
| Recall@K | ${metricsA.recallAtK.toFixed(3)} | ${metricsB.recallAtK.toFixed(3)} | ${(metricsB.recallAtK - metricsA.recallAtK).toFixed(3)} |
| Precision (rough) | ${metricsA.precisionRough.toFixed(3)} | ${metricsB.precisionRough.toFixed(3)} | ${(metricsB.precisionRough - metricsA.precisionRough).toFixed(3)} |
| Latência média | ${Math.round(metricsA.avgLatencyMs)}ms | ${Math.round(metricsB.avgLatencyMs)}ms | ${Math.round(metricsB.avgLatencyMs - metricsA.avgLatencyMs)}ms |

**Unknown+Paraphrase hit:** v1 ${(unknownParaphraseA * 100).toFixed(1)}% → v2 ${(unknownParaphraseB * 100).toFixed(1)}%

## Summary warning
${summaryChecks.map((s) => `- ${s.name}: ${s.ok ? 'OK' : 'FAIL'} (flagged=${s.flagged}, warning=${s.startsWithWarning})`).join('\n')}

## Decisão
**recommendKeepHybridV2: ${recommendKeepHybridV2}**

${results.decision.rationale}

Hit v1/v2: ${(metricsA.hitRate * 100).toFixed(1)}% / ${(metricsB.hitRate * 100).toFixed(1)}% | MRR v1/v2: ${metricsA.mrr.toFixed(3)} / ${metricsB.mrr.toFixed(3)}
`;

writeFileSync('tmp/post-go-live/28-3-blind-ab.md', md);
console.log('DECISION recommendKeepHybridV2=', recommendKeepHybridV2);
await client.end();
