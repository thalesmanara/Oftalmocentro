const prep=$('Preparar entrada').first().json||{};
const cfg=$input.first().json||{};
if(!cfg.ok){
  return [{json:{...prep, configuration:{}, mode:'LEGACY', versionId:null, versionLabel:null, code:'AI_QUERY_CONTEXT', loadError:cfg.error||cfg.code||'missing'}}];
}
return [{json:{...prep, ...cfg}}];