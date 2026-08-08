# Dataset pós-ajustes (Etapa 28.1)

## Escopo executado

Smoke funcional pós-Go-Live (login, senha <8, listagem `isActive`, consulta IA, aviso de resumo).

## Governança — sem publish sem A/B

| Candidato | Status | Motivo |
|-----------|--------|--------|
| hybrid-v2 + lexicalExpansion | DRAFT | A/B Recall/Precision/MRR pendente |
| AI_QUERY_MAIN v2 max_tokens=1500 | DRAFT | A/B qualidade/latência/alucinação pendente |
| response-quality-v2 | PUBLISHED | inalterado |
| hybrid-v1 | PUBLISHED | mantido em produção |

## Casos de similaridade (checklist A/B — não publicados)

1. equipamento ↔ máquina  
2. máquina ↔ equipamento  
3. aparelho ↔ equipamento  
4. funcionário ↔ colaborador  
5. colaborador ↔ funcionário  
6. comprar ↔ adquirir  
7. adquirir ↔ comprar  
8. manutenção ↔ conserto  
9. reparo ↔ manutenção  
10. termo exato  
11. código  
12. CPF  
13. planilha  
14. OCR  
15. negativos  
16. múltiplas fontes  

Ver: `tmp/post-go-live/lexical-investigation.md`

## Conclusão

Produção permanece em **hybrid-v1** + **max_tokens 800**. Melhorias de similaridade e completude ficam em DRAFT até dataset/A-B formal.
