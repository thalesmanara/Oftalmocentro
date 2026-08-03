const prep=$('Preparar rollback').first().json; const row=$input.first().json||{};
if(!row.id) return [{json:{data:{ok:false,code:'ROLLBACK_FAILED'},statusCode:400,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId}}];
return [{json:{data:{ok:true,version:{id:row.id,versionLabel:row.version_label,mode:row.mode,status:row.status,publishedAt:row.published_at,versionNumber:Number(row.version_number)}},
statusCode:200,requestId:prep.requestId,requestStartedAtMs:prep.requestStartedAtMs,method:prep.method,path:prep.path,userId:prep.userId,sessionId:prep.sessionId,
auditAction:'AI_CONTEXT_CONFIG_ROLLBACK', auditResourceId:row.id}}];