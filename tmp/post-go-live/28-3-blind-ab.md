# Etapa 28.3 — Blind semantic A/B (hybrid-v1 vs hybrid-v2)

**Data:** 2026-08-08T21:31:51.711Z

## Config
- hybrid-v1: `63631806-f1ba-4ff4-8b24-265a468229fb` (ARCHIVED)
- hybrid-v2: `eb5779b1-b653-4679-b7ea-89b66accb279` (PUBLISHED)
- Dictionary keys (v2): 12 — pairs **not** added during test

## Casos
- Total: **39** (todos `wasInDictionary: false` nos pares inventados)
- semantic: 10 | paraphrase: 10 | technical_vs_popular: 5 | verb_vs_noun: 5 | abbreviation: 5
- extras: exact CNPJ, OCR-ish, tabular, negative

## Métricas (sources)

| Métrica | hybrid-v1 | hybrid-v2 | Δ |
|---------|-----------|-----------|---|
| Hit Rate | 71.8% | 66.7% | -5.1pp |
| MRR | 0.542 | 0.513 | -0.029 |
| Recall@K | 0.718 | 0.667 | -0.051 |
| Precision (rough) | 0.259 | 0.240 | -0.019 |
| Latência média | 9072ms | 8011ms | -1060ms |

**Unknown+Paraphrase hit:** v1 80.0% → v2 75.0%

## Summary warning
- explicit-resumo: OK (flagged=true, warning=true)
- pontual-cnpj: OK (flagged=false, warning=false)

## Decisão
**recommendKeepHybridV2: false**

hybrid-v2 não supera hybrid-v1 em generalização semântica ou regrediu em exact

Hit v1/v2: 71.8% / 66.7% | MRR v1/v2: 0.542 / 0.513
