const items = $input.all();

const classification =
  $('Classificar pergunta').first().json;

const question = classification.question ?? '';

const categoryId =
  classification.categoryId ?? null;

const categoryName =
  classification.categoryName ?? null;

const categoryDescription =
  classification.categoryDescription ?? null;

const subcategoryId =
  classification.subcategoryId ?? null;

const subcategoryName =
  classification.subcategoryName ?? null;

const subcategoryDescription =
  classification.subcategoryDescription ?? null;

/*
 * Cada item é um chunk retornado pelo PostgreSQL.
 */
const contextChunks = items.map((item, index) => {
  const row = item.json;

  return {
    index: index + 1,

    documentId: row.documentId,
    documentTitle: row.documentTitle,

    sectorId: row.sectorId ?? null,
    sectorName: row.sectorName ?? null,

    categoryId: row.categoryId ?? null,
    categoryName: row.categoryName ?? null,
    categoryDescription:
      row.categoryDescription ?? null,

    subcategoryId: row.subcategoryId ?? null,
    subcategoryName: row.subcategoryName ?? null,
    subcategoryDescription:
      row.subcategoryDescription ?? null,

    vigencyDate: row.vigencyDate ?? null,

    chunkOrder: row.chunkOrder,
    relevance: row.relevance ?? 0,

    text: row.chunkText ?? ''
  };
});

/*
 * Texto enviado à OpenAI.
 */
const context = contextChunks
  .map(source => {
    return `
[Fontes ${source.index}]

Documento: ${source.documentTitle || 'Não informado'}
Setor: ${source.sectorName || 'Não informado'}
Categoria: ${source.categoryName || 'Não informada'}
Subcategoria: ${source.subcategoryName || 'Não informada'}
Data de vigência: ${source.vigencyDate || 'Não informada'}
Ordem do trecho: ${source.chunkOrder}
Relevância calculada: ${source.relevance}

Trecho documental:
${source.text}
`.trim();
  })
  .join('\n\n------------------------------\n\n');

/*
 * Fontes únicas para o frontend.
 *
 * Um documento pode ter vários chunks, mas deve gerar somente
 * um card em "Fontes consultadas".
 */
const uniqueSourcesMap = new Map();

for (const source of contextChunks) {
  if (!source.documentId) {
    continue;
  }

  const existing =
    uniqueSourcesMap.get(source.documentId);

  if (!existing) {
    uniqueSourcesMap.set(source.documentId, {
      documentId: source.documentId,
      documentTitle: source.documentTitle,

      sectorId: source.sectorId,
      sectorName: source.sectorName,

      categoryId: source.categoryId,
      categoryName: source.categoryName,

      subcategoryId: source.subcategoryId,
      subcategoryName: source.subcategoryName,

      vigencyDate: source.vigencyDate,

      relevance: source.relevance
    });

    continue;
  }

  /*
   * Preserva a maior relevância entre os chunks do documento.
   */
  if (
    Number(source.relevance) >
    Number(existing.relevance)
  ) {
    existing.relevance = source.relevance;
  }
}

const sources = [...uniqueSourcesMap.values()]
  .sort((a, b) => {
    return Number(b.relevance) - Number(a.relevance);
  })
  .map((source, index) => ({
    index: index + 1,

    documentId: source.documentId,
    documentTitle: source.documentTitle,

    sectorId: source.sectorId,
    sectorName: source.sectorName,

    categoryId: source.categoryId,
    categoryName: source.categoryName,

    subcategoryId: source.subcategoryId,
    subcategoryName: source.subcategoryName,

    vigencyDate: source.vigencyDate
  }));

return [
  {
    json: {
      question,

      classification: {
        categoryId,
        categoryName,
        categoryDescription,

        subcategoryId,
        subcategoryName,
        subcategoryDescription
      },

      context,
      sources,

      diagnostic: {
        totalChunks: contextChunks.length,
        totalDocuments: sources.length
      }
    }
  }
];