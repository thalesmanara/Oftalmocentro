/**
 * Seed ~100 deterministic AI eval cases from real Oftalmocentro documents.
 * Does NOT invent documents. Marks depends_on_missing_docs when needed.
 */
const cases = [];

function add(c) {
  cases.push({
    status: 'active',
    version: 1,
    min_score: c.min_score ?? 70,
    required_words: c.required_words || [],
    forbidden_words: c.forbidden_words || [],
    expected_document_ids: c.expected_document_ids || (c.expected_document_id ? [c.expected_document_id] : []),
    expect_no_answer: !!c.expect_no_answer,
    depends_on_missing_docs: !!c.depends_on_missing_docs,
    notes: c.notes || null,
    ...c,
  });
}

const DOCS = {
  excelRh: 'd33816da-475a-46e9-bdb4-9e68bc9c7139',
  wordRh: 'dc44a492-d463-4028-b907-37117124163d',
  bianca: '9db556e3-8140-4cb8-94d1-7b5173c199ad',
  jordana: 'e61eeda6-3045-4a2d-bb5b-4bcbe4756207',
  mariana: 'c8f367df-8ada-4424-baf7-24c6bc5dff09',
  dayana: '7d995627-21ac-4607-b221-8ff59c15d389',
  artJordana: 'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1',
  avcbValid: 'a302ac20-dc23-4e4c-b49b-9d57808a8f77',
  avcbExpired: 'e8a7bfff-c0a0-462c-a5cd-780f78875d03',
  alvaraExpired: 'd19ac5f2-cc0d-4da4-abdb-9ebbb38fd6f3',
  alvaraLoc: 'd3d4dc55-648f-4e56-bf8e-086dd6272a3f',
  ambiental: 'ed7aa0c2-1b20-4480-84d1-f7627b45a7d8',
  crmDir: 'c0009c91-d64e-44c1-bc28-e892f4ea358b',
  crmReg: 'bf7bca54-5db5-4135-8b04-2aa8fb63a374',
  declaracaoSan: 'c38d5903-35a6-49b2-82d4-c3e354bd39e0',
  protocoloSan: '14e1260e-c935-4526-a703-095812c9a3da',
  nobreak: '1a3520b6-a0db-4b96-8459-4ff825008337',
  pgtRev03: 'a692cd00-aea8-4975-bcb1-231c70b6b700',
  pgtExpired: '571f818d-2f24-4173-8dee-3036cb7c0f83',
  fisOx: 'bc733c80-d0e0-4d90-ba12-1598244a3404',
  fisNitro: '20160a33-fa4e-48b5-9ff1-be69d80a8c78',
  manutEquip: 'cd401398-9891-4259-9294-bdcb3be5a78a',
  aditivoManut: '60a04d2a-7c93-423b-8c6d-721cf2b026bd',
  arCond: 'c9428c52-8d23-492a-bd95-537e04856498',
  tabelaPrecos: '791232df-765c-412d-8bc2-2b2ecfd15f4f',
  termoLio: 'a02d647e-6487-47ce-9b37-6ea7ee5e8c09',
  lavanderia: '63e80ccb-2ebe-4464-9ad5-ff483a8a8bec',
  lavanderiaAd2: 'cddc0ca8-4794-4556-8093-553a9bdab8a2',
  biometria: 'b533f80a-9b19-47c0-b4ab-210590846228',
  atoDir: 'af8f1ffa-8146-4645-8026-90583990984f',
  cnesLocal: 'c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f',
  cnesNac: 'd80deafd-f0f2-4fd5-a2d7-2a4929565d23',
  cnpj: '206e4db5-10b6-42a6-995b-4d1a2b15edc6',
  cadMob: '59a181fe-702d-48aa-ad6f-959a6840933c',
  locacaoAssinado: '102e4aa0-261f-4bea-b252-1554074c2359',
  locacaoExpired: '9bee2362-31bb-44ec-a3b6-e1d52071a1ce',
  estacionamento: 'a90d7c80-1693-4a7a-93f1-ec2206e3680c',
  regimentoEnf: '9022fe88-4da1-43c6-87db-57ddc6e0270e',
  contratoSocial11: '6bf331ee-0884-4b38-8a9e-faedf937f8a3',
  comodatoLeandro: '47f9c125-b4df-439c-89de-54a34b751c1b',
  comodatoRenato: '9c4350c9-36ee-44fe-a2c0-236e523a8b21',
  comodatoMaria: '886df516-d267-49cb-af94-e023e91cf820',
  bombeirosArt: 'abe008c7-c9b8-4d6b-bc5f-a0f197722484',
};

let n = 1;
const code = () => `TC-${String(n++).padStart(3, '0')}`;

// --- RH / tabular ---
add({
  code: code(),
  name: 'CPF Bianca na planilha',
  group_name: 'RH',
  test_type: 'excel',
  category_name: 'ALVARÁS - LICENÇAS - ART',
  subcategory_name: 'COREN',
  expected_document_id: DOCS.excelRh,
  required_source_document_id: DOCS.excelRh,
  question: 'Qual o CPF da enfermeira Bianca na relação de funcionários?',
  required_words: ['099.446.406-11', 'Bianca'],
  notes: 'Caso tabular XLSX',
});
add({
  code: code(),
  name: 'Setor Barbara',
  group_name: 'RH',
  test_type: 'excel',
  expected_document_id: DOCS.excelRh,
  required_source_document_id: DOCS.excelRh,
  question: 'Em qual setor trabalha Barbara Aparecida Muniz de Lima?',
  required_words: ['Barbara', 'CENTRO CIRÚRGICO'],
});
add({
  code: code(),
  name: 'COREN Dayana',
  group_name: 'RH',
  test_type: 'excel',
  expected_document_id: DOCS.excelRh,
  required_source_document_id: DOCS.excelRh,
  question: 'Qual o número de registro COREN da técnica Dayana?',
  required_words: ['Dayana'],
});
add({
  code: code(),
  name: 'Responsável técnica Jordana',
  group_name: 'RH',
  test_type: 'approximate',
  expected_document_id: DOCS.excelRh,
  required_source_document_id: DOCS.excelRh,
  question: 'Quem é a responsável técnica no quadro de enfermagem?',
  required_words: ['Jordana'],
});
add({
  code: code(),
  name: 'Lista funcionários Word',
  group_name: 'RH',
  test_type: 'pdf',
  expected_document_id: DOCS.wordRh,
  required_source_document_id: DOCS.wordRh,
  question: 'Existe relação de funcionários do quadro de enfermagem em arquivo Word?',
  required_words: ['enfermagem'],
});

// --- COREN certidões ---
for (const [key, name, words] of [
  ['bianca', 'Bianca', ['Bianca', 'COREN']],
  ['jordana', 'Jordana', ['Jordana', 'COREN']],
  ['mariana', 'Mariana', ['Mariana', 'COREN']],
  ['dayana', 'Dayana', ['Dayana', 'COREN']],
]) {
  add({
    code: code(),
    name: `Certidão COREN ${name}`,
    group_name: 'RH',
    test_type: 'pdf',
    category_name: 'ALVARÁS - LICENÇAS - ART',
    subcategory_name: 'COREN',
    expected_document_id: DOCS[key],
    required_source_document_id: DOCS[key],
    question: `Existe certidão de regularidade COREN da ${name.includes('Dayana') ? 'técnica' : 'enfermeira'} ${name}?`,
    required_words: words,
  });
}
add({
  code: code(),
  name: 'ART Jordana 2026',
  group_name: 'RH',
  test_type: 'pdf',
  expected_document_id: DOCS.artJordana,
  required_source_document_id: DOCS.artJordana,
  question: 'Qual documento registra a anotação de responsabilidade técnica COREN de Jordana Borges 2026?',
  required_words: ['Jordana', 'responsabilidade'],
});

// --- Bombeiros / AVCB ---
add({
  code: code(),
  name: 'AVCB válido 2029',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.avcbValid,
  required_source_document_id: DOCS.avcbValid,
  question: 'Qual é a validade do AVCB do Corpo de Bombeiros de 21/11/2029?',
  required_words: ['2029', 'Bombeiros'],
});
add({
  code: code(),
  name: 'AVCB expirado 2024',
  group_name: 'Casos vencidos',
  test_type: 'expired',
  expected_document_id: DOCS.avcbExpired,
  required_source_document_id: DOCS.avcbExpired,
  question: 'Existe AVCB do Corpo de Bombeiros com data 25/10/2024?',
  required_words: ['Bombeiros', '2024'],
  notes: 'Documento marcado como vencido no cadastro',
});
add({
  code: code(),
  name: 'ART projeto incêndio',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.bombeirosArt,
  required_source_document_id: DOCS.bombeirosArt,
  question: 'Há anotação de responsabilidade técnica para elaboração de projeto de incêndio?',
  required_words: ['incêndio', 'responsabilidade'],
});

// --- Alvarás ---
add({
  code: code(),
  name: 'Alvará sanitário vencido 2023',
  group_name: 'Casos vencidos',
  test_type: 'expired',
  expected_document_id: DOCS.alvaraExpired,
  required_source_document_id: DOCS.alvaraExpired,
  question: 'Há alvará de licença sanitária emitido em 13/07/2023?',
  required_words: ['sanit', '2023'],
});
add({
  code: code(),
  name: 'Alvará localização',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.alvaraLoc,
  required_source_document_id: DOCS.alvaraLoc,
  question: 'Existe alvará de licença, localização e funcionamento?',
  required_words: ['localização', 'funcionamento'],
});
add({
  code: code(),
  name: 'Licenciamento ambiental',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.ambiental,
  required_source_document_id: DOCS.ambiental,
  question: 'Qual documento comprova o licenciamento ambiental?',
  required_words: ['ambiental'],
});
add({
  code: code(),
  name: 'Declaração andamento alvará',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.declaracaoSan,
  required_source_document_id: DOCS.declaracaoSan,
  question: 'Há declaração de andamento de processo de emissão de alvará sanitário?',
  required_words: ['andamento', 'sanit'],
});
add({
  code: code(),
  name: 'Protocolo alvará sanitário',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.protocoloSan,
  required_source_document_id: DOCS.protocoloSan,
  question: 'Existe protocolo de requerimento de alvará de licença sanitária?',
  required_words: ['protocolo', 'sanit'],
});

// --- CRM ---
add({
  code: code(),
  name: 'Direção técnica CRM',
  group_name: 'Médicos',
  test_type: 'pdf',
  expected_document_id: DOCS.crmDir,
  required_source_document_id: DOCS.crmDir,
  question: 'Existe certidão de direção técnica CRMMG?',
  required_words: ['direção', 'CRM'],
});
add({
  code: code(),
  name: 'Regularidade técnica CRM 2026',
  group_name: 'Médicos',
  test_type: 'pdf',
  expected_document_id: DOCS.crmReg,
  required_source_document_id: DOCS.crmReg,
  question: 'Há certificado de regularidade técnica 2026 do CRM?',
  required_words: ['regularidade', '2026'],
});

// --- Engenharia / POP ---
add({
  code: code(),
  name: 'POP nobreak',
  group_name: 'POP',
  test_type: 'approximate',
  expected_document_id: DOCS.nobreak,
  required_source_document_id: DOCS.nobreak,
  question: 'Qual o procedimento operacional padrão de verificação de nobreak?',
  required_words: ['nobreak'],
});
add({
  code: code(),
  name: 'PGT revisão 03',
  group_name: 'Normas',
  test_type: 'pdf',
  expected_document_id: DOCS.pgtRev03,
  required_source_document_id: DOCS.pgtRev03,
  question: 'Qual a revisão mais recente do Plano de Gerenciamento de Tecnologias?',
  required_words: ['revisão', '03'],
});
add({
  code: code(),
  name: 'PGT expirado',
  group_name: 'Casos vencidos',
  test_type: 'expired',
  expected_document_id: DOCS.pgtExpired,
  required_source_document_id: DOCS.pgtExpired,
  question: 'Existe Plano de Gerenciamento de Tecnologias com validade em 2024?',
  required_words: ['gerenciamento', 'tecnologias'],
});
add({
  code: code(),
  name: 'FISPQ oxigênio',
  group_name: 'Normas',
  test_type: 'pdf',
  expected_document_id: DOCS.fisOx,
  required_source_document_id: DOCS.fisOx,
  question: 'Onde está a FISPQ de oxigênio medicinal?',
  required_words: ['oxigênio', 'FISPQ'],
});
add({
  code: code(),
  name: 'FISPQ nitrogênio',
  group_name: 'Normas',
  test_type: 'pdf',
  expected_document_id: DOCS.fisNitro,
  required_source_document_id: DOCS.fisNitro,
  question: 'Existe FISPQ de nitrogênio medicinal?',
  required_words: ['nitrogênio'],
});
add({
  code: code(),
  name: 'Contrato manutenção equipamentos',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.manutEquip,
  required_source_document_id: DOCS.manutEquip,
  question: 'Há contrato de manutenção de equipamentos?',
  required_words: ['manutenção', 'equipamentos'],
});
add({
  code: code(),
  name: 'Aditivo manutenção',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.aditivoManut,
  required_source_document_id: DOCS.aditivoManut,
  question: 'Existe aditivo contratual ao contrato de manutenção de equipamentos?',
  required_words: ['aditivo', 'manutenção'],
});
add({
  code: code(),
  name: 'Manutenção ar condicionado',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.arCond,
  required_source_document_id: DOCS.arCond,
  question: 'Qual o contrato de manutenção de aparelhos de ar condicionado?',
  required_words: ['ar condicionado'],
});

// --- Preços / exames ---
add({
  code: code(),
  name: 'Tabela preços particulares',
  group_name: 'Exames',
  test_type: 'approximate',
  expected_document_id: DOCS.tabelaPrecos,
  required_source_document_id: DOCS.tabelaPrecos,
  question: 'Existe tabela de preços de consultas e exames particulares?',
  required_words: ['preços', 'exames'],
});
add({
  code: code(),
  name: 'Termo LIO',
  group_name: 'Exames',
  test_type: 'pdf',
  expected_document_id: DOCS.termoLio,
  required_source_document_id: DOCS.termoLio,
  question: 'Há termo de ciência de lente intra ocular?',
  required_words: ['lente', 'intra'],
});
add({
  code: code(),
  name: 'Biometria LIO teoria',
  group_name: 'Exames',
  test_type: 'pdf',
  expected_document_id: DOCS.biometria,
  required_source_document_id: DOCS.biometria,
  question: 'Existe material sobre biometria e cálculo de lentes intra oculares?',
  required_words: ['biometria'],
});

// --- Fornecedores ---
add({
  code: code(),
  name: 'Contrato lavanderia FAEPU',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.lavanderia,
  required_source_document_id: DOCS.lavanderia,
  question: 'Qual o contrato de prestação de serviços de lavanderia FAEPU?',
  required_words: ['lavanderia', 'FAEPU'],
});
add({
  code: code(),
  name: 'Segundo aditivo lavanderia',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.lavanderiaAd2,
  required_source_document_id: DOCS.lavanderiaAd2,
  question: 'Há segundo aditivo ao contrato de lavanderia FAEPU assinado em 2026?',
  required_words: ['aditivo', 'lavanderia'],
});

// --- Institucional ---
add({
  code: code(),
  name: 'Ato constitutório diretoria',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.atoDir,
  required_source_document_id: DOCS.atoDir,
  question: 'Onde está o ato constitutório da diretoria da Oftalmocentro?',
  required_words: ['diretoria'],
});
add({
  code: code(),
  name: 'CNES base local',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.cnesLocal,
  required_source_document_id: DOCS.cnesLocal,
  question: 'Existe cadastro CNES base local?',
  required_words: ['CNES'],
});
add({
  code: code(),
  name: 'CNES base nacional',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.cnesNac,
  required_source_document_id: DOCS.cnesNac,
  question: 'Existe cadastro CNES base nacional?',
  required_words: ['CNES', 'nacional'],
});
add({
  code: code(),
  name: 'Cartão CNPJ',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.cnpj,
  required_source_document_id: DOCS.cnpj,
  question: 'Há cartão CNPJ da Oftalmocentro?',
  required_words: ['CNPJ'],
});
add({
  code: code(),
  name: 'Cadastro mobiliário',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.cadMob,
  required_source_document_id: DOCS.cadMob,
  question: 'Existe cadastro mobiliário da Prefeitura de Uberaba?',
  required_words: ['mobiliário', 'Uberaba'],
});
add({
  code: code(),
  name: 'Locação sede 2025-2045',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.locacaoAssinado,
  required_source_document_id: DOCS.locacaoAssinado,
  question: 'Qual o aditivo contratual de locação da sede 2025 a 2045?',
  required_words: ['locação', '2045'],
});
add({
  code: code(),
  name: 'Locação sede antiga vencida',
  group_name: 'Casos vencidos',
  test_type: 'expired',
  expected_document_id: DOCS.locacaoExpired,
  required_source_document_id: DOCS.locacaoExpired,
  question: 'Existe contrato de locação da sede de 1996 a 2016?',
  required_words: ['locação', '1996'],
});
add({
  code: code(),
  name: 'Estacionamento pacientes',
  group_name: 'Financeiro',
  test_type: 'pdf',
  expected_document_id: DOCS.estacionamento,
  required_source_document_id: DOCS.estacionamento,
  question: 'Há contrato de locação de estacionamento de pacientes com Satyro Silva Oliveira?',
  required_words: ['estacionamento', 'Satyro'],
});
add({
  code: code(),
  name: 'Regimento enfermagem',
  group_name: 'Normas',
  test_type: 'approximate',
  expected_document_id: DOCS.regimentoEnf,
  required_source_document_id: DOCS.regimentoEnf,
  question: 'Onde está o regimento interno do serviço de enfermagem?',
  required_words: ['regimento', 'enfermagem'],
});
add({
  code: code(),
  name: 'Contrato social 11ª alteração',
  group_name: 'Documentos',
  test_type: 'pdf',
  expected_document_id: DOCS.contratoSocial11,
  required_source_document_id: DOCS.contratoSocial11,
  question: 'Qual a 11ª alteração do contrato social?',
  required_words: ['contrato social', '11'],
});
add({
  code: code(),
  name: 'Comodato Leandro',
  group_name: 'Médicos',
  test_type: 'pdf',
  expected_document_id: DOCS.comodatoLeandro,
  required_source_document_id: DOCS.comodatoLeandro,
  question: 'Existe contrato de comodato de consultório do Dr Leandro Araujo Fernandes?',
  required_words: ['Leandro', 'comodato'],
});
add({
  code: code(),
  name: 'Comodato Renato',
  group_name: 'Médicos',
  test_type: 'pdf',
  expected_document_id: DOCS.comodatoRenato,
  required_source_document_id: DOCS.comodatoRenato,
  question: 'Existe contrato de comodato de consultório do Dr Renato Velloso Vianna?',
  required_words: ['Renato', 'comodato'],
});
add({
  code: code(),
  name: 'Comodato Maria Flávia',
  group_name: 'Médicos',
  test_type: 'pdf',
  expected_document_id: DOCS.comodatoMaria,
  required_source_document_id: DOCS.comodatoMaria,
  question: 'Existe contrato de comodato de consultório da Dra Maria Flávia Meireles?',
  required_words: ['Maria Flávia', 'comodato'],
});

// --- Negativos / ambíguos / inexistentes ---
add({
  code: code(),
  name: 'Documento inexistente unicórnio',
  group_name: 'Casos negativos',
  test_type: 'no_answer',
  expect_no_answer: true,
  question: 'Qual o protocolo secreto de teletransporte ocular do setor unicorn?',
  forbidden_words: [],
  min_score: 60,
  notes: 'Deve recusar — informação inexistente',
});
add({
  code: code(),
  name: 'Preço exame inexistente XYZ999',
  group_name: 'Casos negativos',
  test_type: 'no_answer',
  expect_no_answer: true,
  question: 'Qual o valor do procedimento XYZ999 no convênio Galáctico?',
  min_score: 60,
  depends_on_missing_docs: true,
  notes: 'Não há tabela de convênios completa na base; espera-se recusa ou ausência de código XYZ999',
});
add({
  code: code(),
  name: 'POP inexistente laser espacial',
  group_name: 'Casos negativos',
  test_type: 'no_answer',
  expect_no_answer: true,
  question: 'Qual o POP de calibragem do laser espacial modelo ZX-9000?',
  min_score: 60,
});
add({
  code: code(),
  name: 'Ambiguidade certidões COREN',
  group_name: 'Casos ambíguos',
  test_type: 'ambiguous',
  question: 'Qual a certidão de regularidade COREN mais recente?',
  required_words: ['COREN'],
  min_score: 50,
  notes: 'Várias certidões similares; valida presença temática',
});
add({
  code: code(),
  name: 'Conflito AVCB datas',
  group_name: 'Casos conflitantes',
  test_type: 'conflicting',
  question: 'Quais AVCBs do Corpo de Bombeiros existem na base?',
  required_words: ['Bombeiros'],
  min_score: 55,
  notes: 'Existem AVCB 2024 e 2029',
});
add({
  code: code(),
  name: 'Proibido inventar CPF',
  group_name: 'Casos negativos',
  test_type: 'no_answer',
  expect_no_answer: true,
  question: 'Qual o CPF do Dr Satoshi Nakamoto oftálmico?',
  forbidden_words: ['000.000.000-00'],
  min_score: 60,
});

// Expand near-duplicates for volume toward ~100
const expandDocs = [
  [DOCS.excelRh, 'planilha', 'Quem aparece na relação de funcionários em Excel?', ['funcionários'], 'Planilhas', 'excel'],
  [DOCS.wordRh, 'word', 'A relação de funcionários também existe em Word?', ['Word', 'funcionários'], 'RH', 'pdf'],
  [DOCS.nobreak, 'nobreak2', 'Há POP relacionado a nobreak?', ['nobreak'], 'POP', 'approximate'],
  [DOCS.fisOx, 'ox2', 'FISPQ oxigênio medicinal está cadastrada?', ['oxigênio'], 'Normas', 'pdf'],
  [DOCS.fisNitro, 'nitro2', 'FISPQ nitrogênio medicinal está cadastrada?', ['nitrogênio'], 'Normas', 'pdf'],
  [DOCS.tabelaPrecos, 'precos2', 'Onde consulto preços particulares de exames?', ['preços'], 'Exames', 'approximate'],
  [DOCS.regimentoEnf, 'reg2', 'Há regimento interno de enfermagem?', ['regimento'], 'Normas', 'approximate'],
  [DOCS.cnpj, 'cnpj2', 'Qual documento traz o cartão CNPJ?', ['CNPJ'], 'Documentos', 'pdf'],
  [DOCS.cadMob, 'mob2', 'Cadastro mobiliário municipal existe?', ['mobiliário'], 'Documentos', 'pdf'],
  [DOCS.ambiental, 'amb2', 'Certificado de licenciamento ambiental está na base?', ['ambiental'], 'Documentos', 'pdf'],
  [DOCS.manutEquip, 'man2', 'Contrato de manutenção de equipamentos está disponível?', ['manutenção'], 'Financeiro', 'pdf'],
  [DOCS.arCond, 'ar2', 'Contrato de ar condicionado está disponível?', ['ar condicionado'], 'Financeiro', 'pdf'],
  [DOCS.lavanderia, 'lav2', 'Contrato FAEPU de lavanderia está na base?', ['FAEPU'], 'Financeiro', 'pdf'],
  [DOCS.atoDir, 'dir2', 'Ato constitutório da diretoria está cadastrado?', ['diretoria'], 'Documentos', 'pdf'],
  [DOCS.contratoSocial11, 'cs2', 'Contrato social 11ª alteração existe?', ['11'], 'Documentos', 'pdf'],
  [DOCS.locacaoAssinado, 'loc2', 'Aditivo de locação até 2045 existe?', ['2045'], 'Financeiro', 'pdf'],
  [DOCS.estacionamento, 'est2', 'Contrato de estacionamento Satyro existe?', ['estacionamento'], 'Financeiro', 'pdf'],
  [DOCS.avcbValid, 'avcb2', 'AVCB válido até 2029 está na base?', ['2029'], 'Documentos', 'pdf'],
  [DOCS.crmDir, 'crm2', 'Certidão de direção técnica CRM está na base?', ['CRM'], 'Médicos', 'pdf'],
  [DOCS.crmReg, 'crm3', 'Certificado de regularidade técnica 2026 está na base?', ['2026'], 'Médicos', 'pdf'],
  [DOCS.pgtRev03, 'pgt2', 'PGT revisão 03 está cadastrado?', ['03'], 'Normas', 'pdf'],
  [DOCS.declaracaoSan, 'san2', 'Declaração de andamento de alvará sanitário existe?', ['andamento'], 'Documentos', 'pdf'],
  [DOCS.protocoloSan, 'san3', 'Protocolo de alvará sanitário existe?', ['protocolo'], 'Documentos', 'pdf'],
  [DOCS.termoLio, 'lio2', 'Termo de lente intra ocular existe?', ['lente'], 'Exames', 'pdf'],
  [DOCS.biometria, 'bio2', 'Documento de biometria e cálculo de LIO existe?', ['biometria'], 'Exames', 'pdf'],
  [DOCS.cnesLocal, 'cnes2', 'CNES base local está disponível?', ['CNES'], 'Documentos', 'pdf'],
  [DOCS.cnesNac, 'cnes3', 'CNES base nacional está disponível?', ['nacional'], 'Documentos', 'pdf'],
  [DOCS.comodatoLeandro, 'com2', 'Comodato do Dr Leandro existe?', ['Leandro'], 'Médicos', 'pdf'],
  [DOCS.comodatoRenato, 'com3', 'Comodato do Dr Renato existe?', ['Renato'], 'Médicos', 'pdf'],
  [DOCS.comodatoMaria, 'com4', 'Comodato da Dra Maria Flávia existe?', ['Maria'], 'Médicos', 'pdf'],
  [DOCS.aditivoManut, 'ad2', 'Aditivo de manutenção de equipamentos existe?', ['aditivo'], 'Financeiro', 'pdf'],
  [DOCS.lavanderiaAd2, 'lav3', 'Segundo aditivo lavanderia 2026 existe?', ['2026'], 'Financeiro', 'pdf'],
  [DOCS.artJordana, 'art2', 'ART COREN Jordana 2026 existe?', ['Jordana', '2026'], 'RH', 'pdf'],
  [DOCS.bianca, 'cert2', 'Certidão COREN Bianca está na base?', ['Bianca'], 'RH', 'pdf'],
  [DOCS.jordana, 'cert3', 'Certidão COREN Jordana está na base?', ['Jordana'], 'RH', 'pdf'],
  [DOCS.mariana, 'cert4', 'Certidão COREN Mariana está na base?', ['Mariana'], 'RH', 'pdf'],
  [DOCS.dayana, 'cert5', 'Certidão COREN Dayana está na base?', ['Dayana'], 'RH', 'pdf'],
  [DOCS.alvaraLoc, 'alv2', 'Alvará de localização e funcionamento existe?', ['funcionamento'], 'Documentos', 'pdf'],
  [DOCS.bombeirosArt, 'bomb2', 'ART de projeto de incêndio existe?', ['incêndio'], 'Documentos', 'pdf'],
];

for (const [docId, , question, words, group, type] of expandDocs) {
  add({
    code: code(),
    name: question.slice(0, 60),
    group_name: group,
    test_type: type,
    expected_document_id: docId,
    required_source_document_id: docId,
    question,
    required_words: words,
  });
}

// Placeholders for missing categories
add({
  code: code(),
  name: 'Convênio Unimed OCT (estrutura)',
  group_name: 'Convênios',
  test_type: 'no_answer',
  expect_no_answer: true,
  question: 'Qual o código e valor do exame OCT no convênio Unimed?',
  min_score: 55,
  depends_on_missing_docs: true,
  notes: 'Categoria TABELAS DE PREÇOS/CONVÊNIOS ainda sem cobertura completa — caso estrutural',
});
add({
  code: code(),
  name: 'CSV lista preços (estrutura)',
  group_name: 'Planilhas',
  test_type: 'csv',
  expect_no_answer: true,
  question: 'Qual o preço do exame OCT no arquivo CSV de preços?',
  min_score: 55,
  depends_on_missing_docs: true,
  notes: 'Não há CSV de preços na base atual',
});
add({
  code: code(),
  name: 'OCR PDF escaneado (estrutura)',
  group_name: 'OCR',
  test_type: 'ocr',
  expect_no_answer: true,
  question: 'Qual o texto OCR do contrato social escaneado de baixa qualidade?',
  min_score: 50,
  depends_on_missing_docs: true,
  notes: 'Caso estrutural OCR — depende de documento OCR SUCCESS com texto rico',
});

cases.push(...[{"status":"active","version":1,"min_score":70,"required_words":["099.446.406-11","Bianca"],"forbidden_words":[],"expected_document_ids":["d33816da-475a-46e9-bdb4-9e68bc9c7139"],"expect_no_answer":false,"depends_on_missing_docs":false,"notes":"Caso tabular XLSX","code":"TC-095","name":"CPF Bianca na planilha (variante)","group_name":"RH","test_type":"excel","category_name":"ALVARÁS - LICENÇAS - ART","subcategory_name":"COREN","expected_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","required_source_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","question":"Qual o CPF da enfermeira Bianca na relação de funcionários na base documental?"},{"status":"active","version":1,"min_score":70,"required_words":["Barbara","CENTRO CIRÚRGICO"],"forbidden_words":[],"expected_document_ids":["d33816da-475a-46e9-bdb4-9e68bc9c7139"],"expect_no_answer":false,"depends_on_missing_docs":false,"notes":null,"code":"TC-096","name":"Setor Barbara (variante)","group_name":"RH","test_type":"excel","expected_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","required_source_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","question":"Em qual setor trabalha Barbara Aparecida Muniz de Lima na base documental?"},{"status":"active","version":1,"min_score":70,"required_words":["Dayana"],"forbidden_words":[],"expected_document_ids":["d33816da-475a-46e9-bdb4-9e68bc9c7139"],"expect_no_answer":false,"depends_on_missing_docs":false,"notes":null,"code":"TC-097","name":"COREN Dayana (variante)","group_name":"RH","test_type":"excel","expected_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","required_source_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","question":"Qual o número de registro COREN da técnica Dayana na base documental?"},{"status":"active","version":1,"min_score":70,"required_words":["Jordana"],"forbidden_words":[],"expected_document_ids":["d33816da-475a-46e9-bdb4-9e68bc9c7139"],"expect_no_answer":false,"depends_on_missing_docs":false,"notes":null,"code":"TC-098","name":"Responsável técnica Jordana (variante)","group_name":"RH","test_type":"approximate","expected_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","required_source_document_id":"d33816da-475a-46e9-bdb4-9e68bc9c7139","question":"Quem é a responsável técnica no quadro de enfermagem na base documental?"},{"status":"active","version":1,"min_score":70,"required_words":["enfermagem"],"forbidden_words":[],"expected_document_ids":["dc44a492-d463-4028-b907-37117124163d"],"expect_no_answer":false,"depends_on_missing_docs":false,"notes":null,"code":"TC-099","name":"Lista funcionários Word (variante)","group_name":"RH","test_type":"pdf","expected_document_id":"dc44a492-d463-4028-b907-37117124163d","required_source_document_id":"dc44a492-d463-4028-b907-37117124163d","question":"Existe relação de funcionários do quadro de enfermagem em arquivo Word na base documental?"},{"status":"active","version":1,"min_score":70,"required_words":["Bianca","COREN"],"forbidden_words":[],"expected_document_ids":["9db556e3-8140-4cb8-94d1-7b5173c199ad"],"expect_no_answer":false,"depends_on_missing_docs":false,"notes":null,"code":"TC-100","name":"Certidão COREN Bianca (variante)","group_name":"RH","test_type":"pdf","category_name":"ALVARÁS - LICENÇAS - ART","subcategory_name":"COREN","expected_document_id":"9db556e3-8140-4cb8-94d1-7b5173c199ad","required_source_document_id":"9db556e3-8140-4cb8-94d1-7b5173c199ad","question":"Existe certidão de regularidade COREN da enfermeira Bianca na base documental?"}]);
module.exports = { cases, DOCS };
