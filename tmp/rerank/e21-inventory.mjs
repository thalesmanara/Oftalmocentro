#!/usr/bin/env node
/**
 * Inventory Consulta IA retrieval graph for Etapa 21 consolidation.
 */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, nodes, connections, "activeVersionId", active
   FROM workflow_entity WHERE id='8EXk5RkFW5cxnenL'`,
);
const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
const connections =
  typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;

const summary = nodes.map((n) => ({
  name: n.name,
  type: n.type,
  typeVersion: n.typeVersion,
  position: n.position,
  workflowId: n.parameters?.workflowId?.value || n.parameters?.workflowId || null,
  hasQuery: !!n.parameters?.query,
  hasJs: !!n.parameters?.jsCode,
  jsLen: n.parameters?.jsCode?.length || 0,
}));

// Build adjacency
const edges = [];
for (const [from, conn] of Object.entries(connections)) {
  for (const [bi, branch] of (conn.main || []).entries()) {
    for (const link of branch || []) {
      edges.push({ from, to: link.node, branch: bi });
    }
  }
}

// Find related workflows by name
const related = await client.query(`
  SELECT id, name, active, "activeVersionId",
         jsonb_array_length(nodes::jsonb) AS node_count
  FROM workflow_entity
  WHERE name ILIKE '%RETRIEVAL%'
     OR name ILIKE '%RE-RANQUEAR%'
     OR name ILIKE '%RERANK%'
     OR name ILIKE '%QDRANT%'
     OR name ILIKE '%BUSCAR%'
     OR name ILIKE '%Consulta IA%'
     OR name ILIKE '%RECUPERAR%'
     OR name ILIKE '%contexto%'
  ORDER BY name
`);

writeFileSync(
  new URL('./_e21-inventory.json', import.meta.url),
  JSON.stringify(
    {
      consulta: {
        id: rows[0].id,
        active: rows[0].active,
        activeVersionId: rows[0].activeVersionId,
        nodes: summary,
        edges,
      },
      related: related.rows,
    },
    null,
    2,
  ),
);

// Dump key code nodes
const keyNames = [
  'Classificar pergunta',
  'Buscar chunks relevantes',
  'Montar contexto',
  'Merge híbrido',
  'Carregar retrieval config',
  'Preparar seleção retrieval',
  'Usar re-ranking?',
  'Chamar RE-RANQUEAR',
  'Resolver ranking final',
  'Corte hybrid padrão',
  'Montar resposta',
  'Busca vetorial Qdrant',
  'Preparar embedding pergunta',
  'Aguardar recuperações',
];
const dumps = {};
for (const name of keyNames) {
  const n = nodes.find((x) => x.name === name);
  if (!n) continue;
  dumps[name] = {
    type: n.type,
    params: {
      ...n.parameters,
      jsCode: n.parameters?.jsCode
        ? n.parameters.jsCode.slice(0, 4000)
        : undefined,
      query: n.parameters?.query ? n.parameters.query.slice(0, 2000) : undefined,
    },
    credentials: n.credentials || null,
  };
}
writeFileSync(new URL('./_e21-key-nodes.json', import.meta.url), JSON.stringify(dumps, null, 2));

console.log(
  JSON.stringify(
    {
      nodeCount: nodes.length,
      names: summary.map((s) => s.name),
      related: related.rows,
      edgesFromRetrieval: edges.filter((e) =>
        /retrieval|rank|merge|contexto|chunk|qdrant|embed|texto|hybrid|rerank/i.test(
          e.from + e.to,
        ),
      ),
    },
    null,
    2,
  ),
);
await client.end();
