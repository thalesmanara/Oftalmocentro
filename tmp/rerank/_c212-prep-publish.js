const norm=$('Normalizar request').first().json||{};
const body=norm.body||{}; let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
const errors=[];
if(!body.versionId) errors.push({field:'versionId',message:'obrigatório'});
if(body.forceOverride===true && !String(body.overrideReason||'').trim()) errors.push({field:'overrideReason',message:'motivo obrigatório para override'});
if(errors.length) return [{json:{blocked:true,data:{ok:false,code:'VALIDATION_ERROR',errors,fields:errors},statusCode:400,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];
return [{json:{blocked:false,versionId:body.versionId,forceOverride:!!body.forceOverride,overrideReason:String(body.overrideReason||'').trim(),validationRunId:body.validationRunId||null,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];