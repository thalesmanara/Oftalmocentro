WITH params AS (
  SELECT
    '{{ ($json.question || "").replace(/'/g, "''") }}'::text AS question,
    NULLIF('{{ $json.categoryId || "" }}','')::uuid AS category_id,
    NULLIF('{{ $json.subcategoryId || "" }}','')::uuid AS subcategory_id,
    '{{ ($json.categoryName || "").replace(/'/g, "''") }}'::text AS category_name,
    '{{ ($json.subcategoryName || "").replace(/'/g, "''") }}'::text AS subcategory_name,
    '{{ ($json.searchTerms[0] || "").replace(/'/g, "''") }}'::text AS term0,
    '{{ ($json.searchTerms[1] || "").replace(/'/g, "''") }}'::text AS term1,
    '{{ ($json.searchTerms[2] || "").replace(/'/g, "''") }}'::text AS term2,
    '{{ ($json.searchTerms[3] || "").replace(/'/g, "''") }}'::text AS term3,
    '{{ ($json.searchTerms[4] || "").replace(/'/g, "''") }}'::text AS term4,
    '{{ ($json.searchTerms[5] || "").replace(/'/g, "''") }}'::text AS term5,
    '{{ ($json.searchTerms[6] || "").replace(/'/g, "''") }}'::text AS term6,
    '{{ ($json.searchTerms[7] || "").replace(/'/g, "''") }}'::text AS term7
),
ranked_chunks AS (
  SELECT
    dc.document_id AS "documentId",
    COALESCE(dv.title_snapshot, d.title) AS "documentTitle",
    d.sector_id AS "sectorId",
    s.name AS "sectorName",
    d.category_id AS "categoryId",
    c.name AS "categoryName",
    c.description AS "categoryDescription",
    d.subcategory_id AS "subcategoryId",
    sc.name AS "subcategoryName",
    sc.description AS "subcategoryDescription",
    COALESCE(dv.expiration_date, d.expiration_date) AS "vigencyDate",
    d.updated_at AS "documentUpdatedAt",
    dv.version_number AS "versionNumber",
    dv.id AS "versionId",
    dc.chunk_order AS "chunkOrder",
    dc.chunk_text AS "chunkText",
    (
      CASE WHEN (SELECT subcategory_id FROM params) IS NOT NULL AND d.subcategory_id = (SELECT subcategory_id FROM params) THEN 120 ELSE 0 END
      + CASE WHEN (SELECT category_id FROM params) IS NOT NULL AND d.category_id = (SELECT category_id FROM params) THEN 80 ELSE 0 END
      + CASE WHEN (SELECT question FROM params) <> '' AND dc.chunk_text ILIKE '%' || (SELECT question FROM params) || '%' THEN 100 ELSE 0 END
      + CASE WHEN (SELECT subcategory_name FROM params) <> '' AND dc.chunk_text ILIKE '%' || (SELECT subcategory_name FROM params) || '%' THEN 40 ELSE 0 END
      + CASE WHEN (SELECT category_name FROM params) <> '' AND dc.chunk_text ILIKE '%' || (SELECT category_name FROM params) || '%' THEN 20 ELSE 0 END
      + CASE WHEN (SELECT term0 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term0 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term0 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term0 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term1 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term1 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term1 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term1 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term2 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term2 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term2 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term2 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term3 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term3 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term3 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term3 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term4 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term4 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term4 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term4 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term5 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term5 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term5 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term5 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term6 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term6 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term6 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term6 FROM params) || '%') THEN 15 ELSE 0 END
      + CASE WHEN (SELECT term7 FROM params) <> '' AND (dc.chunk_text ILIKE '%' || (SELECT term7 FROM params) || '%' OR COALESCE(dv.title_snapshot, d.title) ILIKE '%' || (SELECT term7 FROM params) || '%' OR COALESCE(dv.description_snapshot, d.semantic_description, '') ILIKE '%' || (SELECT term7 FROM params) || '%') THEN 15 ELSE 0 END
    ) AS relevance
  FROM document_chunks dc
  INNER JOIN document_versions dv ON dv.id = dc.document_version_id AND dv.is_current = true
  INNER JOIN documents d ON d.id = dc.document_id
  LEFT JOIN sectors s ON s.id = d.sector_id
  LEFT JOIN categories c ON c.id = d.category_id
  LEFT JOIN subcategories sc ON sc.id = d.subcategory_id
  WHERE d.deleted_at IS NULL
    AND COALESCE(dv.processing_status, d.processing_status) = 'processed'
    AND COALESCE(dv.validation_status, 'VALID') = 'VALID'
    AND COALESCE(dv.ocr_status, 'NOT_REQUIRED') NOT IN ('PROCESSING','FAILED','REQUIRED','OCR_REQUIRED','MANUAL_REVIEW','OCR_BUSY')
    AND (dv.ocr_quality_grade IS NULL OR dv.ocr_quality_grade IN ('EXCELLENT','GOOD','ACCEPTABLE'))
)
SELECT *
FROM ranked_chunks
WHERE relevance > 0
ORDER BY relevance DESC, "vigencyDate" DESC NULLS LAST, "documentUpdatedAt" DESC, "chunkOrder" ASC
LIMIT 12;