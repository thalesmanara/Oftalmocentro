/**
 * Corrige falha ao substituir arquivo na edição de documentos.
 *
 * Problemas encontrados:
 * 1) Processar documento: expressões Postgres com IIFE/Buffer viravam SQL `undefined`
 *    em "Atualizar texto extraído" e "Salvar chunks" (n8n task runner).
 * 2) OCR ok? ligava "Marcar falha OCR" no ramo TRUE — sucesso também marcava FAILED.
 * 3) Upload/Process: permissão só cadastrar_documentos (agora also editar via requiredAnyOf).
 * 4) DUPLICATE_FILE bloqueava reenvio no mesmo documento sem replace=true.
 *
 * Este arquivo documenta o diagnóstico. As correções foram aplicadas/publicadas
 * nos workflows n8n:
 * - Processar documento (vNDpCzOdR7ATnHDP)
 * - Upload Arquivo (vymsco8fVdIvgW4b)
 *
 * Frontend:
 * - DocumentForm: CTA "Substituir arquivo" na edição
 * - DocumentEditPage / documentsService: upload com replace=true
 * - processDocument: não trata resposta vazia como sucesso
 */
console.log('Ver docs/comentários neste arquivo. Correções já publicadas no n8n.')
