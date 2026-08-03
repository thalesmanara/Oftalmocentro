const dbItem = $input.first().json || {};
const dbFailed = dbItem.ping_ok == null && (dbItem.error != null || dbItem.message != null || Object.keys(dbItem).length === 0);
const tablesCount = Number(dbItem.tables_count ?? 0);
const tablesOk = tablesCount >= 9;
const dbDuration = Number(dbItem.duration_ms ?? dbItem.durationMs ?? 0);
const database = dbFailed
  ? { status: 'down', durationMs: Number.isFinite(dbDuration) ? dbDuration : 0 }
  : { status: tablesOk ? 'ok' : 'degraded', durationMs: Number.isFinite(dbDuration) ? dbDuration : 0 };
const settingsOk = Number(dbItem.settings_count ?? 0) > 0;
const jwtOk = dbItem.jwt_ok === true || dbItem.jwt_ok === 'true' || dbItem.jwt_ok === 't';
const ttlOk = dbItem.ttl_ok === true || dbItem.ttl_ok === 'true' || dbItem.ttl_ok === 't';
const configuration = {
  status: dbFailed ? 'down' : settingsOk && jwtOk && ttlOk ? 'ok' : 'degraded',
  openai: 'unknown',
};
const sessions = dbFailed
  ? { status: 'down' }
  : { status: 'ok', activeCount: Number(dbItem.active_count ?? 0) || 0 };
const audit = dbFailed ? { status: 'down' } : { status: 'ok' };
const versionsTotal = Number(dbItem.versions_total ?? 0) || 0;
const orphanChunks = Number(dbItem.orphan_chunks ?? 0) || 0;
const multiCurrent = Number(dbItem.multi_current ?? 0) || 0;
const versions = {
  status: orphanChunks > 0 || multiCurrent > 0 ? 'degraded' : 'ok',
  versionsTotal,
  orphanChunks,
  multiCurrent,
};
const invalidRecent24h = Number(dbItem.invalid_recent_24h ?? 0) || 0;
const pendingValidating = Number(dbItem.pending_validating ?? 0) || 0;
const validUnprocessed = Number(dbItem.valid_unprocessed ?? 0) || 0;
const stuckValidating = Number(dbItem.stuck_validating ?? 0) || 0;
const maxUploadSizeBytes = Number(dbItem.max_upload_size_bytes ?? 0) || 0;
const allowedRaw = String(dbItem.allowed_file_extensions ?? '').trim();
const allowedExtensions = allowedRaw.includes(',')
  ? allowedRaw.split(',').map((s) => s.trim()).filter(Boolean)
  : allowedRaw;
const files = dbFailed
  ? undefined
  : {
      status: stuckValidating > 0 ? 'degraded' : 'ok',
      maxUploadSizeBytes,
      allowedExtensions,
      invalidRecent24h,
      pendingValidating,
      validUnprocessed,
      stuckValidating,
    };
const documents = dbFailed
  ? { status: 'down' }
  : {
      status: 'ok',
      total: Number(dbItem.documents_total ?? 0) || 0,
      processing: Number(dbItem.documents_processing ?? 0) || 0,
      errors: Number(dbItem.documents_errors ?? 0) || 0,
      missingFiles: Number(dbItem.documents_missing_files ?? 0) || 0,
      processedWithoutChunks: Number(dbItem.documents_processed_without_chunks ?? 0) || 0,
      versions,
      files,
    };
const backupLastFinishedAt = dbItem.backup_last_finished_at || null;
const backupLastStatus = dbItem.backup_last_status || null;
const backupLastType = dbItem.backup_last_type || null;
let backup;
if (dbFailed) {
  backup = { status: 'unknown', lastBackupAt: null, lastBackupStatus: null, lastBackupType: null };
} else if (!backupLastFinishedAt) {
  backup = { status: 'unknown', lastBackupAt: null, lastBackupStatus: null, lastBackupType: null };
} else {
  const ageHours = (Date.now() - new Date(backupLastFinishedAt).getTime()) / 3600000;
  let backupStatus;
  if (ageHours < 48) backupStatus = 'ok';
  else backupStatus = 'degraded';
  backup = {
    status: backupStatus,
    lastBackupAt: backupLastFinishedAt,
    lastBackupStatus: backupLastStatus,
    lastBackupType: backupLastType,
    ageHours: Math.round(ageHours * 10) / 10,
  };
}
const ocrDb = dbFailed
  ? { processing: 0, failed: 0, pending: 0, manualReview: 0, stuck: 0, avgDurationMs: null, avgQualityScore: null, excellentCount: 0, goodCount: 0, acceptableCount: 0, poorCount: 0, manualReviewCount: 0, avgAttempts: null }
  : {
      processing: Number(dbItem.ocr_processing ?? 0) || 0,
      failed: Number(dbItem.ocr_failed ?? 0) || 0,
      pending: Number(dbItem.ocr_pending ?? 0) || 0,
      manualReview: Number(dbItem.ocr_manual_review ?? 0) || 0,
      stuck: Number(dbItem.ocr_stuck ?? 0) || 0,
      avgDurationMs: dbItem.ocr_avg_duration_ms != null ? Number(dbItem.ocr_avg_duration_ms) : null,
      avgQualityScore: dbItem.ocr_quality_avg_score != null ? Number(dbItem.ocr_quality_avg_score) : null,
      excellentCount: Number(dbItem.ocr_quality_excellent ?? 0) || 0,
      goodCount: Number(dbItem.ocr_quality_good ?? 0) || 0,
      acceptableCount: Number(dbItem.ocr_quality_acceptable ?? 0) || 0,
      poorCount: Number(dbItem.ocr_quality_poor ?? 0) || 0,
      manualReviewCount: Number(dbItem.ocr_manual_review ?? 0) || 0,
      avgAttempts: dbItem.ocr_avg_attempts != null ? Number(dbItem.ocr_avg_attempts) : null,
    };
const tabularDb = dbFailed
  ? { processedCount: 0, failCount: 0, avgDurationMs: null, sheetCount: 0, rowCount: 0, chunkCount: 0 }
  : {
      processedCount: Number(dbItem.tabular_processed_count ?? 0) || 0,
      failCount: Number(dbItem.tabular_fail_count ?? 0) || 0,
      avgDurationMs: dbItem.tabular_avg_duration_ms != null ? Number(dbItem.tabular_avg_duration_ms) : null,
      sheetCount: Number(dbItem.tabular_sheet_count ?? 0) || 0,
      rowCount: Number(dbItem.tabular_row_count ?? 0) || 0,
      chunkCount: Number(dbItem.tabular_chunk_count ?? 0) || 0,
    };
const aiEvalDb = dbFailed
  ? { casesCount: 0, lastScore: null, lastRunAt: null, lastRunStatus: null, avgDurationMs: null }
  : {
      casesCount: Number(dbItem.ai_eval_cases_count ?? 0) || 0,
      lastScore: dbItem.ai_eval_last_score != null ? Number(dbItem.ai_eval_last_score) : null,
      lastRunAt: dbItem.ai_eval_last_run_at || null,
      lastRunStatus: dbItem.ai_eval_last_run_status || null,
      avgDurationMs: dbItem.ai_eval_avg_duration_ms != null ? Number(dbItem.ai_eval_avg_duration_ms) : null,
    };
const draftCount = Number(dbItem.ai_prompt_draft_count ?? 0) || 0;
const publishedCount = Number(dbItem.ai_prompt_published_count ?? 0) || 0;
const missingPublished = dbItem.ai_prompt_version_number == null;
const multiplePublished = publishedCount > 1;
const aiPromptsDb = dbFailed
  ? { status: 'down', versionNumber: null, modelName: null, publishedAt: null, validationScore: null, draftCount: 0, publishedCount: 0, missingPublished: true, multiplePublished: false }
  : {
      status: missingPublished || multiplePublished ? 'degraded' : 'ok',
      versionNumber: dbItem.ai_prompt_version_number != null ? Number(dbItem.ai_prompt_version_number) : null,
      modelName: dbItem.ai_prompt_model_name || null,
      publishedAt: dbItem.ai_prompt_published_at || null,
      validationScore: dbItem.ai_prompt_validation_score != null ? Number(dbItem.ai_prompt_validation_score) : null,
      draftCount,
      publishedCount,
      missingPublished,
      multiplePublished,
    };
return [{
  json: {
    mode: String($('Trigger').first().json.mode || 'detailed'),
    _partial: {
      n8n: { status: 'ok', durationMs: 1 },
      database,
      configuration,
      sessions,
      audit,
      documents,
      backup,
      ocrDb,
      tabularDb,
      aiEvalDb,
      aiPromptsDb,
    },
    probePath: '/home/node/files/.health-probe.tmp',
    probeText: 'ok',
    storageStartedAtMs: Date.now(),
  },
}];