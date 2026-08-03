#!/usr/bin/env python3
"""Backfill embeddings -> Qdrant (stdin-based, avoids ARG_MAX)."""
import json
import subprocess
import time
from pathlib import Path

BATCH = 16
COLLECTION = 'oftalmocentro_chunks'
QDRANT = 'http://qdrant:6333'

env = {}
with open('/data/coolify/services/vrv8r1yp224hzobdqqcenajo/.env') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k] = v.strip().strip('"').strip("'")

user = env['SERVICE_USER_POSTGRES']
db = env.get('POSTGRES_DB', 'n8n')


def psql(sql):
    p = subprocess.run(
        [
            'docker', 'exec', '-i', 'postgresql-vrv8r1yp224hzobdqqcenajo',
            'psql', '-U', user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-t', '-A',
        ],
        input=sql,
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout)[:2000])
    return p.stdout.strip()


def qdrant_get(path):
    p = subprocess.run(
        [
            'docker', 'run', '--rm', '--network', 'vrv8r1yp224hzobdqqcenajo',
            'curlimages/curl:8.5.0', '-sS', f'{QDRANT}{path}',
        ],
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        raise RuntimeError(p.stderr or p.stdout)
    return json.loads(p.stdout)


def qdrant_put_points(payload_obj):
    data = json.dumps(payload_obj)
    p = subprocess.run(
        [
            'docker', 'run', '--rm', '-i', '--network', 'vrv8r1yp224hzobdqqcenajo',
            'curlimages/curl:8.5.0', '-sS', '-X', 'PUT',
            f'{QDRANT}/collections/{COLLECTION}/points?wait=true',
            '-H', 'Content-Type: application/json',
            '-d', '@-',
        ],
        input=data,
        capture_output=True,
        text=True,
    )
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout)[:2000])
    return json.loads(p.stdout) if p.stdout.strip() else {}


def fetch_ids():
    sql = f"""
SELECT COALESCE(json_agg(id::text), '[]'::json)
FROM (
  SELECT id FROM document_chunks
  WHERE embedding_status='VALID' AND embedding_vector IS NOT NULL
    AND (embedding_sync_status IS NULL OR embedding_sync_status IN ('PENDING','FAILED','INVALID') OR qdrant_point_id IS NULL)
  ORDER BY created_at, id
  LIMIT {BATCH}
) t;
"""
    return json.loads(psql(sql) or '[]')


def fetch_rows(ids):
    if not ids:
        return []
    id_list = ','.join("'" + i + "'::uuid" for i in ids)
    # Write vectors to a temp table export via COPY to avoid giant -c
    sql = f"""
COPY (
  SELECT json_build_object(
    'id', dc.id,
    'document_id', dc.document_id,
    'document_version_id', dc.document_version_id,
    'chunk_index', dc.chunk_index,
    'chunk_order', dc.chunk_order,
    'chunk_kind', dc.chunk_kind,
    'sheet_name', dc.sheet_name,
    'content_hash', dc.content_hash,
    'embedding_hash', dc.embedding_hash,
    'embedding_model', dc.embedding_model,
    'embedding_vector', dc.embedding_vector,
    'sector_id', d.sector_id,
    'category_id', d.category_id,
    'subcategory_id', d.subcategory_id,
    'document_title', COALESCE(dv.title_snapshot, d.title),
    'is_current', dv.is_current,
    'ocr_quality_grade', dv.ocr_quality_grade
  )
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  JOIN document_versions dv ON dv.id = dc.document_version_id
  WHERE dc.id IN ({id_list})
) TO STDOUT;
"""
    out = psql(sql)
    rows = []
    for line in out.splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def mark_synced(ids, sync_ms):
    id_list = ','.join("'" + i + "'::uuid" for i in ids)
    psql(f"""UPDATE document_chunks SET qdrant_point_id = id::text,
      embedding_sync_status='SYNCED', embedding_synced_at=now(),
      embedding_sync_error=NULL, embedding_sync_ms={int(sync_ms)},
      embedding_hash=COALESCE(embedding_hash, content_hash)
      WHERE id IN ({id_list});""")


def main():
    info = qdrant_get(f'/collections/{COLLECTION}')
    print('collection', info.get('result', {}).get('config', {}).get('params', {}).get('vectors'))
    total = 0
    while True:
        ids = fetch_ids()
        if not ids:
            break
        rows = fetch_rows(ids)
        t0 = time.time()
        points = []
        ok_ids = []
        for r in rows:
            vec = r.get('embedding_vector')
            if isinstance(vec, str):
                vec = json.loads(vec)
            if not isinstance(vec, list) or not vec:
                continue
            ok_ids.append(r['id'])
            points.append({
                'id': r['id'],
                'vector': vec,
                'payload': {
                    'chunkId': r['id'],
                    'documentId': r.get('document_id'),
                    'documentVersionId': r.get('document_version_id'),
                    'sectorId': r.get('sector_id'),
                    'categoryId': r.get('category_id'),
                    'subcategoryId': r.get('subcategory_id'),
                    'documentTitle': r.get('document_title'),
                    'chunkIndex': r.get('chunk_index') if r.get('chunk_index') is not None else r.get('chunk_order'),
                    'embeddingHash': r.get('embedding_hash') or r.get('content_hash'),
                    'embeddingModel': r.get('embedding_model'),
                    'ocrQuality': r.get('ocr_quality_grade'),
                    'chunkKind': r.get('chunk_kind'),
                    'sheetName': r.get('sheet_name'),
                    'pageNumber': None,
                    'isCurrent': bool(r.get('is_current')),
                },
            })
        if not points:
            print('no points built')
            break
        resp = qdrant_put_points({'points': points})
        if resp.get('status') != 'ok':
            raise RuntimeError(json.dumps(resp)[:800])
        sync_ms = int((time.time() - t0) * 1000)
        mark_synced(ok_ids, sync_ms)
        total += len(ok_ids)
        print('batch=%d total=%d ms=%d' % (len(ok_ids), total, sync_ms))

    psql("""
UPDATE document_versions dv SET
  qdrant_synced_count = s.synced,
  qdrant_pending_count = s.pending,
  qdrant_failed_count = s.failed,
  qdrant_sync_status = CASE
    WHEN s.total_valid = 0 THEN NULL
    WHEN s.pending = 0 AND s.failed = 0 THEN 'SYNCED'
    WHEN s.failed > 0 THEN 'FAILED'
    ELSE 'PENDING'
  END,
  qdrant_collection = 'oftalmocentro_chunks',
  qdrant_synced_at = CASE WHEN s.pending = 0 AND s.failed = 0 AND s.total_valid > 0 THEN now() ELSE dv.qdrant_synced_at END
FROM (
  SELECT document_version_id AS id,
    COUNT(*) FILTER (WHERE embedding_status='VALID')::int AS total_valid,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND embedding_sync_status='SYNCED')::int AS synced,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND (embedding_sync_status IS NULL OR embedding_sync_status IN ('PENDING','INVALID')))::int AS pending,
    COUNT(*) FILTER (WHERE embedding_status='VALID' AND embedding_sync_status='FAILED')::int AS failed
  FROM document_chunks GROUP BY document_version_id
) s WHERE dv.id = s.id;
""")
    col = qdrant_get(f'/collections/{COLLECTION}')
    print(json.dumps({
        'points_count': col.get('result', {}).get('points_count'),
        'synced': int(psql("SELECT COUNT(*) FROM document_chunks WHERE embedding_sync_status='SYNCED';") or 0),
        'pending': int(psql("SELECT COUNT(*) FROM document_chunks WHERE embedding_sync_status='PENDING';") or 0),
        'total_synced_this_run': total,
    }))


if __name__ == '__main__':
    main()
