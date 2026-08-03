#!/usr/bin/env node
/** Fix connections after node renames in retrieval admin workflows */
import pg from 'pg';
import { writeFileSync } from 'fs';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

const IDS = [
  'SxDfJMFCQbytHHL6',
  'EdG14rWgluDHiOtt',
  'RjQDc5gcWFYyBQJO',
  'BAHKNoJM7VdYU8UE',
  'FdaMsXY4nXEO0xV8',
  'Ci5BcAlkZCxOxdyA',
  'DesGIYYOTdv0ws9J',
];

function rewriteConnections(connections, renameMap) {
  const out = {};
  for (const [from, ports] of Object.entries(connections || {})) {
    const newFrom = renameMap[from] || from;
    out[newFrom] = JSON.parse(JSON.stringify(ports));
    for (const mains of out[newFrom].main || []) {
      for (const link of mains || []) {
        if (renameMap[link.node]) link.node = renameMap[link.node];
      }
    }
  }
  return out;
}

const report = [];
for (const id of IDS) {
  const { rows } = await client.query(
    `SELECT name, nodes, connections, "activeVersionId" FROM workflow_entity WHERE id=$1`,
    [id],
  );
  const wf = rows[0];
  const nodes = typeof wf.nodes === 'string' ? JSON.parse(wf.nodes) : wf.nodes;
  const connections =
    typeof wf.connections === 'string' ? JSON.parse(wf.connections) : wf.connections;
  const names = new Set(nodes.map((n) => n.name));

  // Detect dangling connection targets
  const dangling = [];
  for (const [from, ports] of Object.entries(connections)) {
    if (!names.has(from)) dangling.push({ type: 'from', name: from });
    for (const mains of ports.main || []) {
      for (const link of mains || []) {
        if (!names.has(link.node)) dangling.push({ type: 'to', from, name: link.node });
      }
    }
  }

  // Common renames from prompts templates
  const renameMap = {};
  if (names.has('Listar retrieval configs')) {
    for (const old of ['Listar prompts', 'Buscar definições', 'Consultar prompts']) {
      if (!names.has(old)) renameMap[old] = 'Listar retrieval configs';
    }
  }
  if (names.has('Coletar lista')) {
    for (const old of ['Coletar lista', 'Montar lista', 'Coletar resposta', 'Montar resposta lista']) {
      // keep
    }
    // find what Restaurar request points to
  }

  // Fix: for each dangling 'to', try fuzzy match
  let conns = connections;
  for (const d of dangling.filter((x) => x.type === 'to')) {
    // if source connects to old postgres/code name, remap
    const candidates = [...names].filter(
      (n) =>
        n.toLowerCase().includes('listar') ||
        n.toLowerCase().includes('coletar') ||
        n.toLowerCase().includes('buscar') ||
        n.toLowerCase().includes('inserir') ||
        n.toLowerCase().includes('publicar') ||
        n.toLowerCase().includes('atualizar') ||
        n.toLowerCase().includes('rollback'),
    );
    // Better approach: wire Restaurar request → first business node → collect → preparar sucesso
  }

  // Rebuild linear path for GET list specifically
  if (id === 'SxDfJMFCQbytHHL6') {
    conns = JSON.parse(JSON.stringify(connections));
    // Find what Restaurar request currently targets
    const restoreTargets = (conns['Restaurar request']?.main?.[0] || []).map((l) => l.node);
    const listName = 'Listar retrieval configs';
    const collectName = nodes.find((n) => n.name === 'Coletar lista')?.name || 'Coletar lista';
    conns['Restaurar request'] = { main: [[{ node: listName, type: 'main', index: 0 }]] };
    conns[listName] = { main: [[{ node: collectName, type: 'main', index: 0 }]] };
    conns[collectName] = { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] };
    // remove old dangling keys
    for (const k of Object.keys(conns)) {
      if (!names.has(k) && k !== listName) delete conns[k];
    }
    report.push({ id, name: wf.name, restoreTargets, fixed: true, danglingBefore: dangling });
  } else if (id === 'EdG14rWgluDHiOtt') {
    conns = JSON.parse(JSON.stringify(connections));
    const pg = nodes.find((n) => n.type === 'n8n-nodes-base.postgres')?.name;
    const code = nodes.find(
      (n) => n.type === 'n8n-nodes-base.code' && n.name !== 'Restaurar request',
    )?.name;
    if (pg && code) {
      conns['Restaurar request'] = { main: [[{ node: pg, type: 'main', index: 0 }]] };
      conns[pg] = { main: [[{ node: code, type: 'main', index: 0 }]] };
      conns[code] = { main: [[{ node: 'Preparar sucesso', type: 'main', index: 0 }]] };
    }
    report.push({ id, name: wf.name, pg, code, danglingBefore: dangling });
  } else {
    // For mutating endpoints, rewire Restaurar → first non-auth business node
    conns = JSON.parse(JSON.stringify(connections));
    const business = nodes.filter(
      (n) =>
        !['Webhook', 'Normalizar request', 'Validar auth', 'Auth ok?', 'Validar permissão', 'Permissão ok?', 'Restaurar request', 'Preparar sucesso', 'Respond to Webhook', 'Preparar erro 401', 'Respond 401', 'Preparar erro 403', 'Respond 403', 'Registrar auditoria'].includes(n.name) &&
        !n.name.startsWith('Respond') &&
        !n.name.startsWith('Preparar erro'),
    );
    report.push({
      id,
      name: wf.name,
      danglingBefore: dangling,
      business: business.map((b) => b.name),
    });
    // If dangling exists, attempt remap old prompt node names to first business postgres/code
    if (dangling.length) {
      const first = business[0]?.name;
      if (first) {
        conns['Restaurar request'] = { main: [[{ node: first, type: 'main', index: 0 }]] };
      }
      for (const d of dangling) {
        if (d.type === 'from' && conns[d.name]) {
          const dest = conns[d.name];
          delete conns[d.name];
          // map onto closest existing
        }
        if (d.type === 'to') {
          // replace target with first matching type
          for (const mains of Object.values(conns)) {
            for (const arr of mains.main || []) {
              for (const link of arr || []) {
                if (link.node === d.name && first) link.node = first;
              }
            }
          }
        }
      }
    }
  }

  await client.query(
    `UPDATE workflow_entity SET connections=$1::json, "updatedAt"=NOW() WHERE id=$2`,
    [JSON.stringify(conns), id],
  );
  if (wf.activeVersionId) {
    // also update nodes in case
    await client.query(
      `UPDATE workflow_history SET connections=$1::json, nodes=$2::json, "updatedAt"=NOW() WHERE "workflowId"=$3 AND "versionId"=$4`,
      [JSON.stringify(conns), JSON.stringify(nodes), id, wf.activeVersionId],
    );
  }
}

writeFileSync(new URL('./_fix-conn.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await client.end();
