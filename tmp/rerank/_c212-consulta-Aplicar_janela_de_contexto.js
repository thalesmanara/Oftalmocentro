const win=$input.first().json||{};
const prompt=$('Aplicar prompt carregado').first().json||{};
const ret=$('Aplicar contexto recuperado').first().json||{};
const cls=win.classification||ret.classification||{};
const context=String(win.context||ret.context||'');
const question=String(win.question||ret.question||'');
const systemContent=String(prompt.systemPrompt||prompt.content||'');
const userContent = 'Pergunta do usuário:\n\n' + question +
  '\n\nCategoria identificada:\n\n' + (cls.categoryName || 'Não identificada') +
  '\n\nDescrição da categoria:\n\n' + (cls.categoryDescription || 'Não informada') +
  '\n\nSubcategoria identificada:\n\n' + (cls.subcategoryName || 'Não identificada') +
  '\n\nDescrição da subcategoria:\n\n' + (cls.subcategoryDescription || 'Não informada') +
  '\n\nContexto documental recuperado:\n\n' + context +
  '\n\nResponda exclusivamente com base no contexto documental acima.';
return [{json:{
  question,
  classification: cls,
  context,
  sources: Array.isArray(win.sources) ? win.sources : (ret.sources || []),
  retrievalMeta: win.retrievalMeta || ret.retrievalMeta || null,
  contextMeta: win.contextMeta || null,
  modelName: prompt.modelName || 'gpt-4.1-mini',
  temperature: prompt.temperature ?? 0.1,
  maxTokens: prompt.maxTokens ?? 800,
  systemContent,
  userContent,
  promptVersionId: prompt.promptVersionId || null,
  promptCode: prompt.promptCode || null,
  versionNumber: prompt.versionNumber ?? null,
  contentHash: prompt.contentHash || null,
}}];