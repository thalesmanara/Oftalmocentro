SELECT
  c.id AS "categoryId",
  c.name AS "categoryName",
  c.description AS "categoryDescription",

  sc.id AS "subcategoryId",
  sc.name AS "subcategoryName",
  sc.description AS "subcategoryDescription"

FROM categories c

LEFT JOIN subcategories sc
  ON sc.category_id = c.id
  AND sc.active = TRUE

WHERE c.active = TRUE

ORDER BY
  c.name ASC,
  sc.name ASC;