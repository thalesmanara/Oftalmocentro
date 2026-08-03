const fs = require('fs');

function hasEdge(connections, from, to) {
  return JSON.stringify(connections[from] || {}).includes(`"${to}"`);
}

function check(path, label) {
  const w = JSON.parse(fs.readFileSync(path, 'utf8')).workflow;
  const sync = w.versionId === w.activeVersionId;
  const names = w.nodes.map((n) => n.name);
  console.log(`\n===${label}===`);
  console.log({ id: w.id, active: w.active, sync, versionId: w.versionId, nodes: names.length });

  if (label.includes('Upload')) {
    console.log('edges', {
      payloadToValidar: hasEdge(w.connections, 'Payload ok?', 'Validar upload'),
      validarToAvaliar: hasEdge(w.connections, 'Validar upload', 'Avaliar validação'),
      avaliarToIf: hasEdge(w.connections, 'Avaliar validação', 'Validação ok?'),
      ifToPrep: hasEdge(w.connections, 'Validação ok?', 'Preparar versão upload'),
      ifToErr: hasEdge(w.connections, 'Validação ok?', 'Preparar erro validação'),
    });
    const sql = w.nodes.find((n) => n.name === 'Execute a SQL query');
    console.log('sql validation_status', /validation_status/.test(sql.parameters.query));
    console.log('sql checksum_algorithm', /checksum_algorithm/.test(sql.parameters.query));
    console.log('sql detected_mime', /detected_mime_type/.test(sql.parameters.query));
    const anex = w.nodes.find((n) => n.name === 'Anexar binário versão');
    console.log('anex no *1024', !/\* 1024/.test(anex.parameters.jsCode));
    console.log('anex val.fileSize', /val\.fileSize/.test(anex.parameters.jsCode));
  }

  if (label.includes('Processar')) {
    console.log('present', {
      checar: names.includes('Checar validation_status'),
      avaliarTika: names.includes('Avaliar Tika'),
      marcarInv: names.includes('Marcar invalidação Tika'),
    });
    console.log('edges', {
      docToChecar: hasEdge(w.connections, 'Documento ok?', 'Checar validation_status'),
      httpToAvaliar: hasEdge(w.connections, 'HTTP Request', 'Avaliar Tika'),
      avaliarToTikaOk: hasEdge(w.connections, 'Avaliar Tika', 'Tika ok?'),
      tikaOkToPrep: hasEdge(w.connections, 'Tika ok?', 'Preparar texto extraído'),
      tikaFailToMark: hasEdge(w.connections, 'Tika ok?', 'Marcar invalidação Tika'),
    });
    const buscar = w.nodes.find((n) => n.name === 'Buscar documento no PostgreSQL');
    console.log('buscar validationStatus', /validationStatus/.test(buscar.parameters.query));
    const prom = w.nodes.find((n) => n.name === 'Promover versão');
    console.log('promover VALID guard', /validation_status/.test(prom.parameters.query) && /VALID/.test(prom.parameters.query));
  }

  if (label.includes('VALIDAR')) {
    const v = w.nodes.find((n) => n.name === 'Validar e normalizar');
    console.log('validar crypto', v.parameters.jsCode.includes("require('crypto')"));
    console.log('validar FILE_TOO_LARGE', v.parameters.jsCode.includes('FILE_TOO_LARGE'));
    console.log('validar storedFileName', v.parameters.jsCode.includes('storedFileName'));
  }
}

check('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/6bdf7e95-536c-4ba2-85bf-e10c763c9bbe.txt', 'FILES VALIDAR');
check('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/1a8deccf-f8f3-4be1-8ec8-38cdca0f781c.txt', 'Upload');
check('C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/600ab0e5-28e3-44c9-9ca3-81e3a4db5783.txt', 'Processar');
