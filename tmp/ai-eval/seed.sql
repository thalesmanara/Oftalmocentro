BEGIN;
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-001', 'CPF Bianca na planilha', 'RH', 'excel',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Qual o CPF da enfermeira Bianca na relação de funcionários?',
  NULL,
  ARRAY['099.446.406-11','Bianca']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, 'Caso tabular XLSX',
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-002', 'Setor Barbara', 'RH', 'excel',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Em qual setor trabalha Barbara Aparecida Muniz de Lima?',
  NULL,
  ARRAY['Barbara','CENTRO CIRÚRGICO']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-003', 'COREN Dayana', 'RH', 'excel',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Qual o número de registro COREN da técnica Dayana?',
  NULL,
  ARRAY['Dayana']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-004', 'Responsável técnica Jordana', 'RH', 'approximate',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Quem é a responsável técnica no quadro de enfermagem?',
  NULL,
  ARRAY['Jordana']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-005', 'Lista funcionários Word', 'RH', 'pdf',
  NULL,
  NULL,
  'dc44a492-d463-4028-b907-37117124163d'::uuid, ARRAY['dc44a492-d463-4028-b907-37117124163d'::uuid],
  'Existe relação de funcionários do quadro de enfermagem em arquivo Word?',
  NULL,
  ARRAY['enfermagem']::text[], '{}'::text[],
  'dc44a492-d463-4028-b907-37117124163d'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-006', 'Certidão COREN Bianca', 'RH', 'pdf',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  '9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid, ARRAY['9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid],
  'Existe certidão de regularidade COREN da enfermeira Bianca?',
  NULL,
  ARRAY['Bianca','COREN']::text[], '{}'::text[],
  '9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-007', 'Certidão COREN Jordana', 'RH', 'pdf',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  'e61eeda6-3045-4a2d-bb5b-4bcbe4756207'::uuid, ARRAY['e61eeda6-3045-4a2d-bb5b-4bcbe4756207'::uuid],
  'Existe certidão de regularidade COREN da enfermeira Jordana?',
  NULL,
  ARRAY['Jordana','COREN']::text[], '{}'::text[],
  'e61eeda6-3045-4a2d-bb5b-4bcbe4756207'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-008', 'Certidão COREN Mariana', 'RH', 'pdf',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  'c8f367df-8ada-4424-baf7-24c6bc5dff09'::uuid, ARRAY['c8f367df-8ada-4424-baf7-24c6bc5dff09'::uuid],
  'Existe certidão de regularidade COREN da enfermeira Mariana?',
  NULL,
  ARRAY['Mariana','COREN']::text[], '{}'::text[],
  'c8f367df-8ada-4424-baf7-24c6bc5dff09'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-009', 'Certidão COREN Dayana', 'RH', 'pdf',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  '7d995627-21ac-4607-b221-8ff59c15d389'::uuid, ARRAY['7d995627-21ac-4607-b221-8ff59c15d389'::uuid],
  'Existe certidão de regularidade COREN da técnica Dayana?',
  NULL,
  ARRAY['Dayana','COREN']::text[], '{}'::text[],
  '7d995627-21ac-4607-b221-8ff59c15d389'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-010', 'ART Jordana 2026', 'RH', 'pdf',
  NULL,
  NULL,
  'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1'::uuid, ARRAY['c4329f73-b6e5-42ce-99b9-a1d2e93f28c1'::uuid],
  'Qual documento registra a anotação de responsabilidade técnica COREN de Jordana Borges 2026?',
  NULL,
  ARRAY['Jordana','responsabilidade']::text[], '{}'::text[],
  'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-011', 'AVCB válido 2029', 'Documentos', 'pdf',
  NULL,
  NULL,
  'a302ac20-dc23-4e4c-b49b-9d57808a8f77'::uuid, ARRAY['a302ac20-dc23-4e4c-b49b-9d57808a8f77'::uuid],
  'Qual é a validade do AVCB do Corpo de Bombeiros de 21/11/2029?',
  NULL,
  ARRAY['2029','Bombeiros']::text[], '{}'::text[],
  'a302ac20-dc23-4e4c-b49b-9d57808a8f77'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-012', 'AVCB expirado 2024', 'Casos vencidos', 'expired',
  NULL,
  NULL,
  'e8a7bfff-c0a0-462c-a5cd-780f78875d03'::uuid, ARRAY['e8a7bfff-c0a0-462c-a5cd-780f78875d03'::uuid],
  'Existe AVCB do Corpo de Bombeiros com data 25/10/2024?',
  NULL,
  ARRAY['Bombeiros','2024']::text[], '{}'::text[],
  'e8a7bfff-c0a0-462c-a5cd-780f78875d03'::uuid, 70,
  false, 'Documento marcado como vencido no cadastro',
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-013', 'ART projeto incêndio', 'Documentos', 'pdf',
  NULL,
  NULL,
  'abe008c7-c9b8-4d6b-bc5f-a0f197722484'::uuid, ARRAY['abe008c7-c9b8-4d6b-bc5f-a0f197722484'::uuid],
  'Há anotação de responsabilidade técnica para elaboração de projeto de incêndio?',
  NULL,
  ARRAY['incêndio','responsabilidade']::text[], '{}'::text[],
  'abe008c7-c9b8-4d6b-bc5f-a0f197722484'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-014', 'Alvará sanitário vencido 2023', 'Casos vencidos', 'expired',
  NULL,
  NULL,
  'd19ac5f2-cc0d-4da4-abdb-9ebbb38fd6f3'::uuid, ARRAY['d19ac5f2-cc0d-4da4-abdb-9ebbb38fd6f3'::uuid],
  'Há alvará de licença sanitária emitido em 13/07/2023?',
  NULL,
  ARRAY['sanit','2023']::text[], '{}'::text[],
  'd19ac5f2-cc0d-4da4-abdb-9ebbb38fd6f3'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-015', 'Alvará localização', 'Documentos', 'pdf',
  NULL,
  NULL,
  'd3d4dc55-648f-4e56-bf8e-086dd6272a3f'::uuid, ARRAY['d3d4dc55-648f-4e56-bf8e-086dd6272a3f'::uuid],
  'Existe alvará de licença, localização e funcionamento?',
  NULL,
  ARRAY['localização','funcionamento']::text[], '{}'::text[],
  'd3d4dc55-648f-4e56-bf8e-086dd6272a3f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-016', 'Licenciamento ambiental', 'Documentos', 'pdf',
  NULL,
  NULL,
  'ed7aa0c2-1b20-4480-84d1-f7627b45a7d8'::uuid, ARRAY['ed7aa0c2-1b20-4480-84d1-f7627b45a7d8'::uuid],
  'Qual documento comprova o licenciamento ambiental?',
  NULL,
  ARRAY['ambiental']::text[], '{}'::text[],
  'ed7aa0c2-1b20-4480-84d1-f7627b45a7d8'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-017', 'Declaração andamento alvará', 'Documentos', 'pdf',
  NULL,
  NULL,
  'c38d5903-35a6-49b2-82d4-c3e354bd39e0'::uuid, ARRAY['c38d5903-35a6-49b2-82d4-c3e354bd39e0'::uuid],
  'Há declaração de andamento de processo de emissão de alvará sanitário?',
  NULL,
  ARRAY['andamento','sanit']::text[], '{}'::text[],
  'c38d5903-35a6-49b2-82d4-c3e354bd39e0'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-018', 'Protocolo alvará sanitário', 'Documentos', 'pdf',
  NULL,
  NULL,
  '14e1260e-c935-4526-a703-095812c9a3da'::uuid, ARRAY['14e1260e-c935-4526-a703-095812c9a3da'::uuid],
  'Existe protocolo de requerimento de alvará de licença sanitária?',
  NULL,
  ARRAY['protocolo','sanit']::text[], '{}'::text[],
  '14e1260e-c935-4526-a703-095812c9a3da'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-019', 'Direção técnica CRM', 'Médicos', 'pdf',
  NULL,
  NULL,
  'c0009c91-d64e-44c1-bc28-e892f4ea358b'::uuid, ARRAY['c0009c91-d64e-44c1-bc28-e892f4ea358b'::uuid],
  'Existe certidão de direção técnica CRMMG?',
  NULL,
  ARRAY['direção','CRM']::text[], '{}'::text[],
  'c0009c91-d64e-44c1-bc28-e892f4ea358b'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-020', 'Regularidade técnica CRM 2026', 'Médicos', 'pdf',
  NULL,
  NULL,
  'bf7bca54-5db5-4135-8b04-2aa8fb63a374'::uuid, ARRAY['bf7bca54-5db5-4135-8b04-2aa8fb63a374'::uuid],
  'Há certificado de regularidade técnica 2026 do CRM?',
  NULL,
  ARRAY['regularidade','2026']::text[], '{}'::text[],
  'bf7bca54-5db5-4135-8b04-2aa8fb63a374'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-021', 'POP nobreak', 'POP', 'approximate',
  NULL,
  NULL,
  '1a3520b6-a0db-4b96-8459-4ff825008337'::uuid, ARRAY['1a3520b6-a0db-4b96-8459-4ff825008337'::uuid],
  'Qual o procedimento operacional padrão de verificação de nobreak?',
  NULL,
  ARRAY['nobreak']::text[], '{}'::text[],
  '1a3520b6-a0db-4b96-8459-4ff825008337'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-022', 'PGT revisão 03', 'Normas', 'pdf',
  NULL,
  NULL,
  'a692cd00-aea8-4975-bcb1-231c70b6b700'::uuid, ARRAY['a692cd00-aea8-4975-bcb1-231c70b6b700'::uuid],
  'Qual a revisão mais recente do Plano de Gerenciamento de Tecnologias?',
  NULL,
  ARRAY['revisão','03']::text[], '{}'::text[],
  'a692cd00-aea8-4975-bcb1-231c70b6b700'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-023', 'PGT expirado', 'Casos vencidos', 'expired',
  NULL,
  NULL,
  '571f818d-2f24-4173-8dee-3036cb7c0f83'::uuid, ARRAY['571f818d-2f24-4173-8dee-3036cb7c0f83'::uuid],
  'Existe Plano de Gerenciamento de Tecnologias com validade em 2024?',
  NULL,
  ARRAY['gerenciamento','tecnologias']::text[], '{}'::text[],
  '571f818d-2f24-4173-8dee-3036cb7c0f83'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-024', 'FISPQ oxigênio', 'Normas', 'pdf',
  NULL,
  NULL,
  'bc733c80-d0e0-4d90-ba12-1598244a3404'::uuid, ARRAY['bc733c80-d0e0-4d90-ba12-1598244a3404'::uuid],
  'Onde está a FISPQ de oxigênio medicinal?',
  NULL,
  ARRAY['oxigênio','FISPQ']::text[], '{}'::text[],
  'bc733c80-d0e0-4d90-ba12-1598244a3404'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-025', 'FISPQ nitrogênio', 'Normas', 'pdf',
  NULL,
  NULL,
  '20160a33-fa4e-48b5-9ff1-be69d80a8c78'::uuid, ARRAY['20160a33-fa4e-48b5-9ff1-be69d80a8c78'::uuid],
  'Existe FISPQ de nitrogênio medicinal?',
  NULL,
  ARRAY['nitrogênio']::text[], '{}'::text[],
  '20160a33-fa4e-48b5-9ff1-be69d80a8c78'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-026', 'Contrato manutenção equipamentos', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'cd401398-9891-4259-9294-bdcb3be5a78a'::uuid, ARRAY['cd401398-9891-4259-9294-bdcb3be5a78a'::uuid],
  'Há contrato de manutenção de equipamentos?',
  NULL,
  ARRAY['manutenção','equipamentos']::text[], '{}'::text[],
  'cd401398-9891-4259-9294-bdcb3be5a78a'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-027', 'Aditivo manutenção', 'Financeiro', 'pdf',
  NULL,
  NULL,
  '60a04d2a-7c93-423b-8c6d-721cf2b026bd'::uuid, ARRAY['60a04d2a-7c93-423b-8c6d-721cf2b026bd'::uuid],
  'Existe aditivo contratual ao contrato de manutenção de equipamentos?',
  NULL,
  ARRAY['aditivo','manutenção']::text[], '{}'::text[],
  '60a04d2a-7c93-423b-8c6d-721cf2b026bd'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-028', 'Manutenção ar condicionado', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'c9428c52-8d23-492a-bd95-537e04856498'::uuid, ARRAY['c9428c52-8d23-492a-bd95-537e04856498'::uuid],
  'Qual o contrato de manutenção de aparelhos de ar condicionado?',
  NULL,
  ARRAY['ar condicionado']::text[], '{}'::text[],
  'c9428c52-8d23-492a-bd95-537e04856498'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-029', 'Tabela preços particulares', 'Exames', 'approximate',
  NULL,
  NULL,
  '791232df-765c-412d-8bc2-2b2ecfd15f4f'::uuid, ARRAY['791232df-765c-412d-8bc2-2b2ecfd15f4f'::uuid],
  'Existe tabela de preços de consultas e exames particulares?',
  NULL,
  ARRAY['preços','exames']::text[], '{}'::text[],
  '791232df-765c-412d-8bc2-2b2ecfd15f4f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-030', 'Termo LIO', 'Exames', 'pdf',
  NULL,
  NULL,
  'a02d647e-6487-47ce-9b37-6ea7ee5e8c09'::uuid, ARRAY['a02d647e-6487-47ce-9b37-6ea7ee5e8c09'::uuid],
  'Há termo de ciência de lente intra ocular?',
  NULL,
  ARRAY['lente','intra']::text[], '{}'::text[],
  'a02d647e-6487-47ce-9b37-6ea7ee5e8c09'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-031', 'Biometria LIO teoria', 'Exames', 'pdf',
  NULL,
  NULL,
  'b533f80a-9b19-47c0-b4ab-210590846228'::uuid, ARRAY['b533f80a-9b19-47c0-b4ab-210590846228'::uuid],
  'Existe material sobre biometria e cálculo de lentes intra oculares?',
  NULL,
  ARRAY['biometria']::text[], '{}'::text[],
  'b533f80a-9b19-47c0-b4ab-210590846228'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-032', 'Contrato lavanderia FAEPU', 'Financeiro', 'pdf',
  NULL,
  NULL,
  '63e80ccb-2ebe-4464-9ad5-ff483a8a8bec'::uuid, ARRAY['63e80ccb-2ebe-4464-9ad5-ff483a8a8bec'::uuid],
  'Qual o contrato de prestação de serviços de lavanderia FAEPU?',
  NULL,
  ARRAY['lavanderia','FAEPU']::text[], '{}'::text[],
  '63e80ccb-2ebe-4464-9ad5-ff483a8a8bec'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-033', 'Segundo aditivo lavanderia', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'cddc0ca8-4794-4556-8093-553a9bdab8a2'::uuid, ARRAY['cddc0ca8-4794-4556-8093-553a9bdab8a2'::uuid],
  'Há segundo aditivo ao contrato de lavanderia FAEPU assinado em 2026?',
  NULL,
  ARRAY['aditivo','lavanderia']::text[], '{}'::text[],
  'cddc0ca8-4794-4556-8093-553a9bdab8a2'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-034', 'Ato constitutório diretoria', 'Documentos', 'pdf',
  NULL,
  NULL,
  'af8f1ffa-8146-4645-8026-90583990984f'::uuid, ARRAY['af8f1ffa-8146-4645-8026-90583990984f'::uuid],
  'Onde está o ato constitutório da diretoria da Oftalmocentro?',
  NULL,
  ARRAY['diretoria']::text[], '{}'::text[],
  'af8f1ffa-8146-4645-8026-90583990984f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-035', 'CNES base local', 'Documentos', 'pdf',
  NULL,
  NULL,
  'c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f'::uuid, ARRAY['c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f'::uuid],
  'Existe cadastro CNES base local?',
  NULL,
  ARRAY['CNES']::text[], '{}'::text[],
  'c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-036', 'CNES base nacional', 'Documentos', 'pdf',
  NULL,
  NULL,
  'd80deafd-f0f2-4fd5-a2d7-2a4929565d23'::uuid, ARRAY['d80deafd-f0f2-4fd5-a2d7-2a4929565d23'::uuid],
  'Existe cadastro CNES base nacional?',
  NULL,
  ARRAY['CNES','nacional']::text[], '{}'::text[],
  'd80deafd-f0f2-4fd5-a2d7-2a4929565d23'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-037', 'Cartão CNPJ', 'Documentos', 'pdf',
  NULL,
  NULL,
  '206e4db5-10b6-42a6-995b-4d1a2b15edc6'::uuid, ARRAY['206e4db5-10b6-42a6-995b-4d1a2b15edc6'::uuid],
  'Há cartão CNPJ da Oftalmocentro?',
  NULL,
  ARRAY['CNPJ']::text[], '{}'::text[],
  '206e4db5-10b6-42a6-995b-4d1a2b15edc6'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-038', 'Cadastro mobiliário', 'Documentos', 'pdf',
  NULL,
  NULL,
  '59a181fe-702d-48aa-ad6f-959a6840933c'::uuid, ARRAY['59a181fe-702d-48aa-ad6f-959a6840933c'::uuid],
  'Existe cadastro mobiliário da Prefeitura de Uberaba?',
  NULL,
  ARRAY['mobiliário','Uberaba']::text[], '{}'::text[],
  '59a181fe-702d-48aa-ad6f-959a6840933c'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-039', 'Locação sede 2025-2045', 'Financeiro', 'pdf',
  NULL,
  NULL,
  '102e4aa0-261f-4bea-b252-1554074c2359'::uuid, ARRAY['102e4aa0-261f-4bea-b252-1554074c2359'::uuid],
  'Qual o aditivo contratual de locação da sede 2025 a 2045?',
  NULL,
  ARRAY['locação','2045']::text[], '{}'::text[],
  '102e4aa0-261f-4bea-b252-1554074c2359'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-040', 'Locação sede antiga vencida', 'Casos vencidos', 'expired',
  NULL,
  NULL,
  '9bee2362-31bb-44ec-a3b6-e1d52071a1ce'::uuid, ARRAY['9bee2362-31bb-44ec-a3b6-e1d52071a1ce'::uuid],
  'Existe contrato de locação da sede de 1996 a 2016?',
  NULL,
  ARRAY['locação','1996']::text[], '{}'::text[],
  '9bee2362-31bb-44ec-a3b6-e1d52071a1ce'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-041', 'Estacionamento pacientes', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'a90d7c80-1693-4a7a-93f1-ec2206e3680c'::uuid, ARRAY['a90d7c80-1693-4a7a-93f1-ec2206e3680c'::uuid],
  'Há contrato de locação de estacionamento de pacientes com Satyro Silva Oliveira?',
  NULL,
  ARRAY['estacionamento','Satyro']::text[], '{}'::text[],
  'a90d7c80-1693-4a7a-93f1-ec2206e3680c'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-042', 'Regimento enfermagem', 'Normas', 'approximate',
  NULL,
  NULL,
  '9022fe88-4da1-43c6-87db-57ddc6e0270e'::uuid, ARRAY['9022fe88-4da1-43c6-87db-57ddc6e0270e'::uuid],
  'Onde está o regimento interno do serviço de enfermagem?',
  NULL,
  ARRAY['regimento','enfermagem']::text[], '{}'::text[],
  '9022fe88-4da1-43c6-87db-57ddc6e0270e'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-043', 'Contrato social 11ª alteração', 'Documentos', 'pdf',
  NULL,
  NULL,
  '6bf331ee-0884-4b38-8a9e-faedf937f8a3'::uuid, ARRAY['6bf331ee-0884-4b38-8a9e-faedf937f8a3'::uuid],
  'Qual a 11ª alteração do contrato social?',
  NULL,
  ARRAY['contrato social','11']::text[], '{}'::text[],
  '6bf331ee-0884-4b38-8a9e-faedf937f8a3'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-044', 'Comodato Leandro', 'Médicos', 'pdf',
  NULL,
  NULL,
  '47f9c125-b4df-439c-89de-54a34b751c1b'::uuid, ARRAY['47f9c125-b4df-439c-89de-54a34b751c1b'::uuid],
  'Existe contrato de comodato de consultório do Dr Leandro Araujo Fernandes?',
  NULL,
  ARRAY['Leandro','comodato']::text[], '{}'::text[],
  '47f9c125-b4df-439c-89de-54a34b751c1b'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-045', 'Comodato Renato', 'Médicos', 'pdf',
  NULL,
  NULL,
  '9c4350c9-36ee-44fe-a2c0-236e523a8b21'::uuid, ARRAY['9c4350c9-36ee-44fe-a2c0-236e523a8b21'::uuid],
  'Existe contrato de comodato de consultório do Dr Renato Velloso Vianna?',
  NULL,
  ARRAY['Renato','comodato']::text[], '{}'::text[],
  '9c4350c9-36ee-44fe-a2c0-236e523a8b21'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-046', 'Comodato Maria Flávia', 'Médicos', 'pdf',
  NULL,
  NULL,
  '886df516-d267-49cb-af94-e023e91cf820'::uuid, ARRAY['886df516-d267-49cb-af94-e023e91cf820'::uuid],
  'Existe contrato de comodato de consultório da Dra Maria Flávia Meireles?',
  NULL,
  ARRAY['Maria Flávia','comodato']::text[], '{}'::text[],
  '886df516-d267-49cb-af94-e023e91cf820'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-047', 'Documento inexistente unicórnio', 'Casos negativos', 'no_answer',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o protocolo secreto de teletransporte ocular do setor unicorn?',
  NULL,
  '{}'::text[], '{}'::text[],
  NULL, 60,
  true, 'Deve recusar — informação inexistente',
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-048', 'Preço exame inexistente XYZ999', 'Casos negativos', 'no_answer',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o valor do procedimento XYZ999 no convênio Galáctico?',
  NULL,
  '{}'::text[], '{}'::text[],
  NULL, 60,
  true, 'Não há tabela de convênios completa na base; espera-se recusa ou ausência de código XYZ999',
  'active', 1, true
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-049', 'POP inexistente laser espacial', 'Casos negativos', 'no_answer',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o POP de calibragem do laser espacial modelo ZX-9000?',
  NULL,
  '{}'::text[], '{}'::text[],
  NULL, 60,
  true, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-050', 'Ambiguidade certidões COREN', 'Casos ambíguos', 'ambiguous',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual a certidão de regularidade COREN mais recente?',
  NULL,
  ARRAY['COREN']::text[], '{}'::text[],
  NULL, 50,
  false, 'Várias certidões similares; valida presença temática',
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-051', 'Conflito AVCB datas', 'Casos conflitantes', 'conflicting',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Quais AVCBs do Corpo de Bombeiros existem na base?',
  NULL,
  ARRAY['Bombeiros']::text[], '{}'::text[],
  NULL, 55,
  false, 'Existem AVCB 2024 e 2029',
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-052', 'Proibido inventar CPF', 'Casos negativos', 'no_answer',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o CPF do Dr Satoshi Nakamoto oftálmico?',
  NULL,
  '{}'::text[], ARRAY['000.000.000-00']::text[],
  NULL, 60,
  true, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-053', 'Quem aparece na relação de funcionários em Excel?', 'Planilhas', 'excel',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Quem aparece na relação de funcionários em Excel?',
  NULL,
  ARRAY['funcionários']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-054', 'A relação de funcionários também existe em Word?', 'RH', 'pdf',
  NULL,
  NULL,
  'dc44a492-d463-4028-b907-37117124163d'::uuid, ARRAY['dc44a492-d463-4028-b907-37117124163d'::uuid],
  'A relação de funcionários também existe em Word?',
  NULL,
  ARRAY['Word','funcionários']::text[], '{}'::text[],
  'dc44a492-d463-4028-b907-37117124163d'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-055', 'Há POP relacionado a nobreak?', 'POP', 'approximate',
  NULL,
  NULL,
  '1a3520b6-a0db-4b96-8459-4ff825008337'::uuid, ARRAY['1a3520b6-a0db-4b96-8459-4ff825008337'::uuid],
  'Há POP relacionado a nobreak?',
  NULL,
  ARRAY['nobreak']::text[], '{}'::text[],
  '1a3520b6-a0db-4b96-8459-4ff825008337'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-056', 'FISPQ oxigênio medicinal está cadastrada?', 'Normas', 'pdf',
  NULL,
  NULL,
  'bc733c80-d0e0-4d90-ba12-1598244a3404'::uuid, ARRAY['bc733c80-d0e0-4d90-ba12-1598244a3404'::uuid],
  'FISPQ oxigênio medicinal está cadastrada?',
  NULL,
  ARRAY['oxigênio']::text[], '{}'::text[],
  'bc733c80-d0e0-4d90-ba12-1598244a3404'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-057', 'FISPQ nitrogênio medicinal está cadastrada?', 'Normas', 'pdf',
  NULL,
  NULL,
  '20160a33-fa4e-48b5-9ff1-be69d80a8c78'::uuid, ARRAY['20160a33-fa4e-48b5-9ff1-be69d80a8c78'::uuid],
  'FISPQ nitrogênio medicinal está cadastrada?',
  NULL,
  ARRAY['nitrogênio']::text[], '{}'::text[],
  '20160a33-fa4e-48b5-9ff1-be69d80a8c78'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-058', 'Onde consulto preços particulares de exames?', 'Exames', 'approximate',
  NULL,
  NULL,
  '791232df-765c-412d-8bc2-2b2ecfd15f4f'::uuid, ARRAY['791232df-765c-412d-8bc2-2b2ecfd15f4f'::uuid],
  'Onde consulto preços particulares de exames?',
  NULL,
  ARRAY['preços']::text[], '{}'::text[],
  '791232df-765c-412d-8bc2-2b2ecfd15f4f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-059', 'Há regimento interno de enfermagem?', 'Normas', 'approximate',
  NULL,
  NULL,
  '9022fe88-4da1-43c6-87db-57ddc6e0270e'::uuid, ARRAY['9022fe88-4da1-43c6-87db-57ddc6e0270e'::uuid],
  'Há regimento interno de enfermagem?',
  NULL,
  ARRAY['regimento']::text[], '{}'::text[],
  '9022fe88-4da1-43c6-87db-57ddc6e0270e'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-060', 'Qual documento traz o cartão CNPJ?', 'Documentos', 'pdf',
  NULL,
  NULL,
  '206e4db5-10b6-42a6-995b-4d1a2b15edc6'::uuid, ARRAY['206e4db5-10b6-42a6-995b-4d1a2b15edc6'::uuid],
  'Qual documento traz o cartão CNPJ?',
  NULL,
  ARRAY['CNPJ']::text[], '{}'::text[],
  '206e4db5-10b6-42a6-995b-4d1a2b15edc6'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-061', 'Cadastro mobiliário municipal existe?', 'Documentos', 'pdf',
  NULL,
  NULL,
  '59a181fe-702d-48aa-ad6f-959a6840933c'::uuid, ARRAY['59a181fe-702d-48aa-ad6f-959a6840933c'::uuid],
  'Cadastro mobiliário municipal existe?',
  NULL,
  ARRAY['mobiliário']::text[], '{}'::text[],
  '59a181fe-702d-48aa-ad6f-959a6840933c'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-062', 'Certificado de licenciamento ambiental está na base?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'ed7aa0c2-1b20-4480-84d1-f7627b45a7d8'::uuid, ARRAY['ed7aa0c2-1b20-4480-84d1-f7627b45a7d8'::uuid],
  'Certificado de licenciamento ambiental está na base?',
  NULL,
  ARRAY['ambiental']::text[], '{}'::text[],
  'ed7aa0c2-1b20-4480-84d1-f7627b45a7d8'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-063', 'Contrato de manutenção de equipamentos está disponível?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'cd401398-9891-4259-9294-bdcb3be5a78a'::uuid, ARRAY['cd401398-9891-4259-9294-bdcb3be5a78a'::uuid],
  'Contrato de manutenção de equipamentos está disponível?',
  NULL,
  ARRAY['manutenção']::text[], '{}'::text[],
  'cd401398-9891-4259-9294-bdcb3be5a78a'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-064', 'Contrato de ar condicionado está disponível?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'c9428c52-8d23-492a-bd95-537e04856498'::uuid, ARRAY['c9428c52-8d23-492a-bd95-537e04856498'::uuid],
  'Contrato de ar condicionado está disponível?',
  NULL,
  ARRAY['ar condicionado']::text[], '{}'::text[],
  'c9428c52-8d23-492a-bd95-537e04856498'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-065', 'Contrato FAEPU de lavanderia está na base?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  '63e80ccb-2ebe-4464-9ad5-ff483a8a8bec'::uuid, ARRAY['63e80ccb-2ebe-4464-9ad5-ff483a8a8bec'::uuid],
  'Contrato FAEPU de lavanderia está na base?',
  NULL,
  ARRAY['FAEPU']::text[], '{}'::text[],
  '63e80ccb-2ebe-4464-9ad5-ff483a8a8bec'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-066', 'Ato constitutório da diretoria está cadastrado?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'af8f1ffa-8146-4645-8026-90583990984f'::uuid, ARRAY['af8f1ffa-8146-4645-8026-90583990984f'::uuid],
  'Ato constitutório da diretoria está cadastrado?',
  NULL,
  ARRAY['diretoria']::text[], '{}'::text[],
  'af8f1ffa-8146-4645-8026-90583990984f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-067', 'Contrato social 11ª alteração existe?', 'Documentos', 'pdf',
  NULL,
  NULL,
  '6bf331ee-0884-4b38-8a9e-faedf937f8a3'::uuid, ARRAY['6bf331ee-0884-4b38-8a9e-faedf937f8a3'::uuid],
  'Contrato social 11ª alteração existe?',
  NULL,
  ARRAY['11']::text[], '{}'::text[],
  '6bf331ee-0884-4b38-8a9e-faedf937f8a3'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-068', 'Aditivo de locação até 2045 existe?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  '102e4aa0-261f-4bea-b252-1554074c2359'::uuid, ARRAY['102e4aa0-261f-4bea-b252-1554074c2359'::uuid],
  'Aditivo de locação até 2045 existe?',
  NULL,
  ARRAY['2045']::text[], '{}'::text[],
  '102e4aa0-261f-4bea-b252-1554074c2359'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-069', 'Contrato de estacionamento Satyro existe?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'a90d7c80-1693-4a7a-93f1-ec2206e3680c'::uuid, ARRAY['a90d7c80-1693-4a7a-93f1-ec2206e3680c'::uuid],
  'Contrato de estacionamento Satyro existe?',
  NULL,
  ARRAY['estacionamento']::text[], '{}'::text[],
  'a90d7c80-1693-4a7a-93f1-ec2206e3680c'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-070', 'AVCB válido até 2029 está na base?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'a302ac20-dc23-4e4c-b49b-9d57808a8f77'::uuid, ARRAY['a302ac20-dc23-4e4c-b49b-9d57808a8f77'::uuid],
  'AVCB válido até 2029 está na base?',
  NULL,
  ARRAY['2029']::text[], '{}'::text[],
  'a302ac20-dc23-4e4c-b49b-9d57808a8f77'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-071', 'Certidão de direção técnica CRM está na base?', 'Médicos', 'pdf',
  NULL,
  NULL,
  'c0009c91-d64e-44c1-bc28-e892f4ea358b'::uuid, ARRAY['c0009c91-d64e-44c1-bc28-e892f4ea358b'::uuid],
  'Certidão de direção técnica CRM está na base?',
  NULL,
  ARRAY['CRM']::text[], '{}'::text[],
  'c0009c91-d64e-44c1-bc28-e892f4ea358b'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-072', 'Certificado de regularidade técnica 2026 está na base?', 'Médicos', 'pdf',
  NULL,
  NULL,
  'bf7bca54-5db5-4135-8b04-2aa8fb63a374'::uuid, ARRAY['bf7bca54-5db5-4135-8b04-2aa8fb63a374'::uuid],
  'Certificado de regularidade técnica 2026 está na base?',
  NULL,
  ARRAY['2026']::text[], '{}'::text[],
  'bf7bca54-5db5-4135-8b04-2aa8fb63a374'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-073', 'PGT revisão 03 está cadastrado?', 'Normas', 'pdf',
  NULL,
  NULL,
  'a692cd00-aea8-4975-bcb1-231c70b6b700'::uuid, ARRAY['a692cd00-aea8-4975-bcb1-231c70b6b700'::uuid],
  'PGT revisão 03 está cadastrado?',
  NULL,
  ARRAY['03']::text[], '{}'::text[],
  'a692cd00-aea8-4975-bcb1-231c70b6b700'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-074', 'Declaração de andamento de alvará sanitário existe?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'c38d5903-35a6-49b2-82d4-c3e354bd39e0'::uuid, ARRAY['c38d5903-35a6-49b2-82d4-c3e354bd39e0'::uuid],
  'Declaração de andamento de alvará sanitário existe?',
  NULL,
  ARRAY['andamento']::text[], '{}'::text[],
  'c38d5903-35a6-49b2-82d4-c3e354bd39e0'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-075', 'Protocolo de alvará sanitário existe?', 'Documentos', 'pdf',
  NULL,
  NULL,
  '14e1260e-c935-4526-a703-095812c9a3da'::uuid, ARRAY['14e1260e-c935-4526-a703-095812c9a3da'::uuid],
  'Protocolo de alvará sanitário existe?',
  NULL,
  ARRAY['protocolo']::text[], '{}'::text[],
  '14e1260e-c935-4526-a703-095812c9a3da'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-076', 'Termo de lente intra ocular existe?', 'Exames', 'pdf',
  NULL,
  NULL,
  'a02d647e-6487-47ce-9b37-6ea7ee5e8c09'::uuid, ARRAY['a02d647e-6487-47ce-9b37-6ea7ee5e8c09'::uuid],
  'Termo de lente intra ocular existe?',
  NULL,
  ARRAY['lente']::text[], '{}'::text[],
  'a02d647e-6487-47ce-9b37-6ea7ee5e8c09'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-077', 'Documento de biometria e cálculo de LIO existe?', 'Exames', 'pdf',
  NULL,
  NULL,
  'b533f80a-9b19-47c0-b4ab-210590846228'::uuid, ARRAY['b533f80a-9b19-47c0-b4ab-210590846228'::uuid],
  'Documento de biometria e cálculo de LIO existe?',
  NULL,
  ARRAY['biometria']::text[], '{}'::text[],
  'b533f80a-9b19-47c0-b4ab-210590846228'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-078', 'CNES base local está disponível?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f'::uuid, ARRAY['c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f'::uuid],
  'CNES base local está disponível?',
  NULL,
  ARRAY['CNES']::text[], '{}'::text[],
  'c4adf0b5-83e7-4e91-aa94-8e82bffe6a3f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-079', 'CNES base nacional está disponível?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'd80deafd-f0f2-4fd5-a2d7-2a4929565d23'::uuid, ARRAY['d80deafd-f0f2-4fd5-a2d7-2a4929565d23'::uuid],
  'CNES base nacional está disponível?',
  NULL,
  ARRAY['nacional']::text[], '{}'::text[],
  'd80deafd-f0f2-4fd5-a2d7-2a4929565d23'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-080', 'Comodato do Dr Leandro existe?', 'Médicos', 'pdf',
  NULL,
  NULL,
  '47f9c125-b4df-439c-89de-54a34b751c1b'::uuid, ARRAY['47f9c125-b4df-439c-89de-54a34b751c1b'::uuid],
  'Comodato do Dr Leandro existe?',
  NULL,
  ARRAY['Leandro']::text[], '{}'::text[],
  '47f9c125-b4df-439c-89de-54a34b751c1b'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-081', 'Comodato do Dr Renato existe?', 'Médicos', 'pdf',
  NULL,
  NULL,
  '9c4350c9-36ee-44fe-a2c0-236e523a8b21'::uuid, ARRAY['9c4350c9-36ee-44fe-a2c0-236e523a8b21'::uuid],
  'Comodato do Dr Renato existe?',
  NULL,
  ARRAY['Renato']::text[], '{}'::text[],
  '9c4350c9-36ee-44fe-a2c0-236e523a8b21'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-082', 'Comodato da Dra Maria Flávia existe?', 'Médicos', 'pdf',
  NULL,
  NULL,
  '886df516-d267-49cb-af94-e023e91cf820'::uuid, ARRAY['886df516-d267-49cb-af94-e023e91cf820'::uuid],
  'Comodato da Dra Maria Flávia existe?',
  NULL,
  ARRAY['Maria']::text[], '{}'::text[],
  '886df516-d267-49cb-af94-e023e91cf820'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-083', 'Aditivo de manutenção de equipamentos existe?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  '60a04d2a-7c93-423b-8c6d-721cf2b026bd'::uuid, ARRAY['60a04d2a-7c93-423b-8c6d-721cf2b026bd'::uuid],
  'Aditivo de manutenção de equipamentos existe?',
  NULL,
  ARRAY['aditivo']::text[], '{}'::text[],
  '60a04d2a-7c93-423b-8c6d-721cf2b026bd'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-084', 'Segundo aditivo lavanderia 2026 existe?', 'Financeiro', 'pdf',
  NULL,
  NULL,
  'cddc0ca8-4794-4556-8093-553a9bdab8a2'::uuid, ARRAY['cddc0ca8-4794-4556-8093-553a9bdab8a2'::uuid],
  'Segundo aditivo lavanderia 2026 existe?',
  NULL,
  ARRAY['2026']::text[], '{}'::text[],
  'cddc0ca8-4794-4556-8093-553a9bdab8a2'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-085', 'ART COREN Jordana 2026 existe?', 'RH', 'pdf',
  NULL,
  NULL,
  'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1'::uuid, ARRAY['c4329f73-b6e5-42ce-99b9-a1d2e93f28c1'::uuid],
  'ART COREN Jordana 2026 existe?',
  NULL,
  ARRAY['Jordana','2026']::text[], '{}'::text[],
  'c4329f73-b6e5-42ce-99b9-a1d2e93f28c1'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-086', 'Certidão COREN Bianca está na base?', 'RH', 'pdf',
  NULL,
  NULL,
  '9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid, ARRAY['9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid],
  'Certidão COREN Bianca está na base?',
  NULL,
  ARRAY['Bianca']::text[], '{}'::text[],
  '9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-087', 'Certidão COREN Jordana está na base?', 'RH', 'pdf',
  NULL,
  NULL,
  'e61eeda6-3045-4a2d-bb5b-4bcbe4756207'::uuid, ARRAY['e61eeda6-3045-4a2d-bb5b-4bcbe4756207'::uuid],
  'Certidão COREN Jordana está na base?',
  NULL,
  ARRAY['Jordana']::text[], '{}'::text[],
  'e61eeda6-3045-4a2d-bb5b-4bcbe4756207'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-088', 'Certidão COREN Mariana está na base?', 'RH', 'pdf',
  NULL,
  NULL,
  'c8f367df-8ada-4424-baf7-24c6bc5dff09'::uuid, ARRAY['c8f367df-8ada-4424-baf7-24c6bc5dff09'::uuid],
  'Certidão COREN Mariana está na base?',
  NULL,
  ARRAY['Mariana']::text[], '{}'::text[],
  'c8f367df-8ada-4424-baf7-24c6bc5dff09'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-089', 'Certidão COREN Dayana está na base?', 'RH', 'pdf',
  NULL,
  NULL,
  '7d995627-21ac-4607-b221-8ff59c15d389'::uuid, ARRAY['7d995627-21ac-4607-b221-8ff59c15d389'::uuid],
  'Certidão COREN Dayana está na base?',
  NULL,
  ARRAY['Dayana']::text[], '{}'::text[],
  '7d995627-21ac-4607-b221-8ff59c15d389'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-090', 'Alvará de localização e funcionamento existe?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'd3d4dc55-648f-4e56-bf8e-086dd6272a3f'::uuid, ARRAY['d3d4dc55-648f-4e56-bf8e-086dd6272a3f'::uuid],
  'Alvará de localização e funcionamento existe?',
  NULL,
  ARRAY['funcionamento']::text[], '{}'::text[],
  'd3d4dc55-648f-4e56-bf8e-086dd6272a3f'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-091', 'ART de projeto de incêndio existe?', 'Documentos', 'pdf',
  NULL,
  NULL,
  'abe008c7-c9b8-4d6b-bc5f-a0f197722484'::uuid, ARRAY['abe008c7-c9b8-4d6b-bc5f-a0f197722484'::uuid],
  'ART de projeto de incêndio existe?',
  NULL,
  ARRAY['incêndio']::text[], '{}'::text[],
  'abe008c7-c9b8-4d6b-bc5f-a0f197722484'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-092', 'Convênio Unimed OCT (estrutura)', 'Convênios', 'no_answer',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o código e valor do exame OCT no convênio Unimed?',
  NULL,
  '{}'::text[], '{}'::text[],
  NULL, 55,
  true, 'Categoria TABELAS DE PREÇOS/CONVÊNIOS ainda sem cobertura completa — caso estrutural',
  'active', 1, true
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-093', 'CSV lista preços (estrutura)', 'Planilhas', 'csv',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o preço do exame OCT no arquivo CSV de preços?',
  NULL,
  '{}'::text[], '{}'::text[],
  NULL, 55,
  true, 'Não há CSV de preços na base atual',
  'active', 1, true
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-094', 'OCR PDF escaneado (estrutura)', 'OCR', 'ocr',
  NULL,
  NULL,
  NULL, '{}'::uuid[],
  'Qual o texto OCR do contrato social escaneado de baixa qualidade?',
  NULL,
  '{}'::text[], '{}'::text[],
  NULL, 50,
  true, 'Caso estrutural OCR — depende de documento OCR SUCCESS com texto rico',
  'active', 1, true
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-095', 'CPF Bianca na planilha (variante)', 'RH', 'excel',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Qual o CPF da enfermeira Bianca na relação de funcionários na base documental?',
  NULL,
  ARRAY['099.446.406-11','Bianca']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, 'Caso tabular XLSX',
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-096', 'Setor Barbara (variante)', 'RH', 'excel',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Em qual setor trabalha Barbara Aparecida Muniz de Lima na base documental?',
  NULL,
  ARRAY['Barbara','CENTRO CIRÚRGICO']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-097', 'COREN Dayana (variante)', 'RH', 'excel',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Qual o número de registro COREN da técnica Dayana na base documental?',
  NULL,
  ARRAY['Dayana']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-098', 'Responsável técnica Jordana (variante)', 'RH', 'approximate',
  NULL,
  NULL,
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, ARRAY['d33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid],
  'Quem é a responsável técnica no quadro de enfermagem na base documental?',
  NULL,
  ARRAY['Jordana']::text[], '{}'::text[],
  'd33816da-475a-46e9-bdb4-9e68bc9c7139'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-099', 'Lista funcionários Word (variante)', 'RH', 'pdf',
  NULL,
  NULL,
  'dc44a492-d463-4028-b907-37117124163d'::uuid, ARRAY['dc44a492-d463-4028-b907-37117124163d'::uuid],
  'Existe relação de funcionários do quadro de enfermagem em arquivo Word na base documental?',
  NULL,
  ARRAY['enfermagem']::text[], '{}'::text[],
  'dc44a492-d463-4028-b907-37117124163d'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
INSERT INTO ai_test_cases (
  code, name, group_name, test_type, category_name, subcategory_name,
  expected_document_id, expected_document_ids, question, expected_answer,
  required_words, forbidden_words, required_source_document_id, min_score,
  expect_no_answer, notes, status, version, depends_on_missing_docs
) VALUES (
  'TC-100', 'Certidão COREN Bianca (variante)', 'RH', 'pdf',
  'ALVARÁS - LICENÇAS - ART',
  'COREN',
  '9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid, ARRAY['9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid],
  'Existe certidão de regularidade COREN da enfermeira Bianca na base documental?',
  NULL,
  ARRAY['Bianca','COREN']::text[], '{}'::text[],
  '9db556e3-8140-4cb8-94d1-7b5173c199ad'::uuid, 70,
  false, NULL,
  'active', 1, false
) ON CONFLICT (code) DO UPDATE SET
  name=EXCLUDED.name, question=EXCLUDED.question, required_words=EXCLUDED.required_words,
  forbidden_words=EXCLUDED.forbidden_words, expected_document_id=EXCLUDED.expected_document_id,
  required_source_document_id=EXCLUDED.required_source_document_id, min_score=EXCLUDED.min_score,
  expect_no_answer=EXCLUDED.expect_no_answer, notes=EXCLUDED.notes, group_name=EXCLUDED.group_name,
  test_type=EXCLUDED.test_type, depends_on_missing_docs=EXCLUDED.depends_on_missing_docs,
  category_name=EXCLUDED.category_name, subcategory_name=EXCLUDED.subcategory_name,
  expected_document_ids=EXCLUDED.expected_document_ids, updated_at=NOW();
COMMIT;
