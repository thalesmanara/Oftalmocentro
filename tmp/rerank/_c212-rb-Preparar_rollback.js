const norm=$('Normalizar request').first().json||{};
const body=norm.body||{}; let auth={}; try{auth=$('Validar auth').first().json||{};}catch(_){}
const reason=String(body.reason||'').trim();
const errors=[];
if(!body.targetVersionId) errors.push({field:'targetVersionId',message:'obrigatório'});
if(!reason) errors.push({field:'reason',message:'motivo obrigatório'});
if(errors.length) return [{json:{blocked:true,data:{ok:false,code:'VALIDATION_ERROR',errors,fields:errors},statusCode:400,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];
return [{json:{blocked:false,targetVersionId:body.targetVersionId,reason,requestId:norm.requestId,requestStartedAtMs:norm.requestStartedAtMs,method:norm.method,path:norm.path,userId:auth.userId||'',sessionId:auth.sessionId||''}}];