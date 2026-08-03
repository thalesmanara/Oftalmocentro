const webhook = $('Webhook').first().json;

const question =
  webhook.body?.question ??
  webhook.question ??
  '';

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const stopWords = new Set([
  'a',
  'o',
  'as',
  'os',
  'um',
  'uma',
  'uns',
  'umas',
  'de',
  'da',
  'do',
  'das',
  'dos',
  'em',
  'no',
  'na',
  'nos',
  'nas',
  'para',
  'por',
  'com',
  'sem',
  'sobre',
  'entre',
  'qual',
  'quais',
  'como',
  'onde',
  'quando',
  'quem',
  'que',
  'e',
  'ou',
  'se',
  'tem',
  'ter',
  'existem',
  'existe',
  'informe',
  'informar',
  'informacao',
  'informacoes',
  'liste',
  'listar',
  'mostre',
  'mostrar'
]);

const normalizedQuestion = normalizeText(question);

const questionTerms = normalizedQuestion
  .split(/\s+/)
  .filter(term => term.length > 2)
  .filter(term => !stopWords.has(term));

const rows = $input.all().map(item => {
  const row = item.json;

  return {
    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? '',
    categoryDescription: row.categoryDescription ?? '',
    subcategoryId: row.subcategoryId ?? null,
    subcategoryName: row.subcategoryName ?? '',
    subcategoryDescription: row.subcategoryDescription ?? '',

    normalizedCategoryName: normalizeText(row.categoryName),
    normalizedCategoryDescription: normalizeText(
      row.categoryDescription
    ),
    normalizedSubcategoryName: normalizeText(
      row.subcategoryName
    ),
    normalizedSubcategoryDescription: normalizeText(
      row.subcategoryDescription
    )
  };
});

const scoredRows = rows.map(row => {
  let categoryScore = 0;
  let subcategoryScore = 0;

  /*
   * Correspondência direta com os nomes.
   */
  if (
    row.normalizedCategoryName &&
    normalizedQuestion.includes(row.normalizedCategoryName)
  ) {
    categoryScore += 80;
  }

  if (
    row.normalizedSubcategoryName &&
    normalizedQuestion.includes(row.normalizedSubcategoryName)
  ) {
    subcategoryScore += 140;
  }

  /*
   * Correspondência termo a termo.
   */
  for (const term of questionTerms) {
    if (
      row.normalizedCategoryName &&
      row.normalizedCategoryName.includes(term)
    ) {
      categoryScore += 25;
    }

    if (
      row.normalizedCategoryDescription &&
      row.normalizedCategoryDescription.includes(term)
    ) {
      categoryScore += 12;
    }

    if (
      row.normalizedSubcategoryName &&
      row.normalizedSubcategoryName.includes(term)
    ) {
      subcategoryScore += 35;
    }

    if (
      row.normalizedSubcategoryDescription &&
      row.normalizedSubcategoryDescription.includes(term)
    ) {
      subcategoryScore += 20;
    }
  }

  return {
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    categoryDescription: row.categoryDescription,

    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    subcategoryDescription: row.subcategoryDescription,

    categoryScore,
    subcategoryScore,
    totalScore: categoryScore + subcategoryScore
  };
});

/*
 * Melhor linha completa: categoria + possível subcategoria.
 */
scoredRows.sort((a, b) => {
  if (b.totalScore !== a.totalScore) {
    return b.totalScore - a.totalScore;
  }

  return b.subcategoryScore - a.subcategoryScore;
});

const bestRow =
  scoredRows.length > 0 && scoredRows[0].totalScore > 0
    ? scoredRows[0]
    : null;

/*
 * Pode existir correspondência com a categoria, mas nenhuma
 * subcategoria específica.
 *
 * Nesse caso mantemos a categoria e deixamos subcategoryId nulo.
 */
let selectedCategory = null;
let selectedSubcategory = null;

if (bestRow) {
  selectedCategory = {
    id: bestRow.categoryId,
    name: bestRow.categoryName,
    description: bestRow.categoryDescription,
    score: bestRow.categoryScore
  };

  if (
    bestRow.subcategoryId &&
    bestRow.subcategoryScore > 0
  ) {
    selectedSubcategory = {
      id: bestRow.subcategoryId,
      name: bestRow.subcategoryName,
      description: bestRow.subcategoryDescription,
      score: bestRow.subcategoryScore
    };
  }
}

/*
 * Termos usados na busca SQL.
 */
const searchTerms = [...new Set(questionTerms)]
  .filter(term => term.length > 3)
  .slice(0, 8);

/*
 * Candidatos servem para depuração.
 * Não precisam ser enviados ao frontend.
 */
const candidates = scoredRows
  .filter(row => row.totalScore > 0)
  .slice(0, 5)
  .map(row => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    subcategoryId: row.subcategoryId,
    subcategoryName: row.subcategoryName,
    categoryScore: row.categoryScore,
    subcategoryScore: row.subcategoryScore,
    totalScore: row.totalScore
  }));

return [
  {
    json: {
      question,

      categoryId: selectedCategory?.id ?? null,
      categoryName: selectedCategory?.name ?? null,
      categoryDescription:
        selectedCategory?.description ?? null,

      subcategoryId: selectedSubcategory?.id ?? null,
      subcategoryName: selectedSubcategory?.name ?? null,
      subcategoryDescription:
        selectedSubcategory?.description ?? null,

      searchTerms,
      classificationCandidates: candidates
    }
  }
];