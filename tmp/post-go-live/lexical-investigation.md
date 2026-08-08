# Expansão léxica por sinônimos — investigação (Etapa 28.1)

## Pergunta

Por que perguntas com "máquina" não recuperam documentos que falam em "equipamento"
(e casos equivalentes: funcionário/colaborador, comprar/adquirir, manutenção/reparo,
remarcar/reagendar)?

## Achados

**1. `hybrid-v1` não tem nenhuma forma de expansão de sinônimos.**
A configuração publicada (`ai_retrieval_config_versions`, `version_label = hybrid-v1`)
contém apenas `weights`, `boosts`, `penalties`, `normalization` e limites. Não existe
dicionário, tesauro, nem `websearch_to_tsquery` com sinônimos.

**2. O caminho léxico é casamento literal, não stemming nem tesauro.**
O nó `Buscar chunks relevantes` (workflow `bae8872eeb164a27`) pontua com `ILIKE '%termo%'`
sobre `chunk_text`, título, descrição semântica, `sheet_name` e `headers_json`. Os termos
vêm de `classification.searchTerms`, e a SQL só lê **8 posições** (`term0`..`term7`).
Consequência direta: se a pergunta traz "máquina", o documento que só escreve "equipamento"
recebe **zero** pontos léxicos — não há sinonímia nem radicalização envolvida.

**3. O caminho vetorial deveria cobrir esse caso, mas o merge híbrido limita o ganho.**
O embedding tende a aproximar máquina/equipamento. Porém o nó `Merge híbrido` mantém como
candidato apenas o chunk que também aparece no resultado léxico (é dele que vem o
`chunkText`). Na prática, um acerto **exclusivamente vetorial** não sobrevive à combinação,
então a recuperação depende mais do léxico do que os pesos sugerem.

**4. O peso léxico de 0.35 não é o gargalo — a ausência do termo é.**
Com `weights.lexical = 0.35` e `weights.semantic = 0.65`, mesmo um peso léxico baixo é
suficiente para eliminar o candidato quando o score léxico é exatamente zero, por causa do
comportamento de merge descrito acima. Aumentar o peso semântico não resolve; o que resolve
é fazer o termo existir na busca léxica.

## O que foi entregue

Foi criada **apenas a versão DRAFT** `hybrid-v2` (id `eb5779b1-b653-4679-b7ea-89b66accb279`,
`version_number` 8), igual a `hybrid-v1` mais o bloco:

```json
"lexicalExpansion": {
  "enabled": true,
  "maxSynonymsPerTerm": 4,
  "dictionary": {
    "equipamento": ["máquina", "aparelho"],
    "máquina": ["equipamento", "aparelho"],
    "aparelho": ["equipamento", "máquina"],
    "funcionário": ["colaborador", "empregado"],
    "colaborador": ["funcionário", "empregado"],
    "comprar": ["adquirir", "aquisição"],
    "adquirir": ["comprar", "aquisição"],
    "manutenção": ["reparo", "conserto"],
    "reparo": ["manutenção", "conserto"],
    "conserto": ["manutenção", "reparo"],
    "remarcar": ["reagendar", "alterar agendamento"],
    "reagendar": ["remarcar", "alterar agendamento"]
  }
}
```

Nada foi publicado: `hybrid-v1` continua sendo a única versão `PUBLISHED` e
`app_secrets.retrieval_active_mode` / `retrieval_active_version` não foram alterados.

O workflow `IA - VALIDAR RETRIEVAL CONFIG` passou a reconhecer e validar `lexicalExpansion`.
Isso foi necessário porque o validador reconstrói a configuração a partir de uma allow-list:
sem a mudança, o DRAFT seria reprovado na validação e perderia o bloco silenciosamente na
primeira edição pela tela de administração. Configurações sem `lexicalExpansion` continuam
produzindo exatamente o mesmo `contentHash` de antes.

## Por que a expansão ainda não está ligada

`IA - RECUPERAR CONTEXTO` não lê `lexicalExpansion`. A ligação foi deixada de fora de
propósito: ela muda o conjunto de candidatos de toda pergunta e não há métrica comparativa
ainda. Como o carregador de configuração (`IA - CARREGAR RETRIEVAL CONFIG`) só resolve a
versão `PUBLISHED` — salvo quando recebe um `versionId` explícito — o DRAFT não tem nenhum
efeito em produção enquanto não for publicado.

## Plano de ligação (quando for aprovado)

1. No nó `Preparar busca texto` (que já roda **depois** de `Carregar retrieval config`),
   expandir `searchTerms` com o dicionário de `configuration.lexicalExpansion`, respeitando
   `maxSynonymsPerTerm` e a normalização sem acentos já usada na classificação.
2. Respeitar o teto de 8 termos da SQL: preservar os termos originais e preencher o restante
   com sinônimos, ou ampliar `term0..term7` na query. Estourar o limite é a falha mais
   provável dessa ligação.
3. Considerar pontuar sinônimo com peso menor que o termo original (hoje todo termo vale 15),
   para que a expansão amplie o recall sem distorcer o ranking.
4. Ler sempre da configuração carregada, nunca de constante no código — assim o DRAFT só
   passa a valer quando publicado.

## Recomendação

Rodar um A/B antes de publicar. `IA - RECUPERAR CONTEXTO` aceita `versionId` (com
`modeOverrideAllowed`), o que permite executar o mesmo conjunto de perguntas contra
`hybrid-v1` e contra `hybrid-v2` sem tocar em produção. Perguntas sugeridas: as próprias
duplas do dicionário (máquina/equipamento, remarcar/reagendar, comprar/adquirir). Publicar
só se o recall subir sem aumentar o ruído — o risco real da expansão é trazer documento
vagamente relacionado para dentro do contexto e piorar a precisão da resposta.
