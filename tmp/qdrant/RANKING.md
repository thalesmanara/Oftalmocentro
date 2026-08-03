# Ranking híbrido — Oftalmocentro

## Fórmula

```
mergedScore = 0.65 * vectorNorm + 0.35 * textNorm + boosts
```

Onde:

- `vectorNorm` = score Cosine do Qdrant (0–1)
- `textNorm` = `relevance_textual / max(relevance_textual)` na janela Top-K textual
- Pesos padrão (`app_secrets`): `qdrant_weight_vector=0.65`, `qdrant_weight_text=0.35`

## Boosts (aditivos)

| Sinal | Boost |
|-------|-------|
| subcategoryId classificado = chunk | +0.15 |
| categoryId classificado = chunk (se sem sub) | +0.10 |
| OCR EXCELLENT/GOOD | +0.05 |
| chunkKind = tabular | +0.05 |
| documento vigente (isCurrent) | +0.05 |

## Pipeline

1. Classificação determinística (categoria/subcategoria/termos)
2. Embedding da pergunta (`text-embedding-3-small`)
3. Top-K vetorial Qdrant (filtro `isCurrent`, soft category/subcategory)
4. Top-K textual PostgreSQL (SQL ILIKE existente)
5. Merge + dedupe por `documentId:chunkOrder`
6. Ranking por `mergedScore`
7. Top híbrido → Montar contexto → Prompt

## Fallback

Se Qdrant falhar ou não retornar hits com texto hidratável, usa-se apenas a busca textual (`retrieval_mode=text_fallback`).
