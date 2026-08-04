# Performance Final — Etapa 28

| Endpoint | avg | p50 | p90 | p99 |
|----------|-----|-----|-----|-----|
| Health | 1010 | 940 | 1321 | 1321 |
| Documentos | 552 | 430 | 888 | 888 |
| Consulta IA | 7359 | 7550 | 7608 | 7608 |

## Concorrência 5

- OK: 5/5
- avg: 13249 ms
- max: 15091 ms

## Limite operacional sugerido

Máximo **5** consultas IA simultâneas na VPS atual (1 vCPU). Concorrência 10 não executada por segurança.
