import fs from 'fs';

const dir = 'C:/Revita/Oftalmocentro/tmp/ocr/etapa15';
const ops = [
  {
    type: 'setNodeParameter',
    nodeName: 'Avaliar',
    path: '/jsCode',
    value: fs.readFileSync(`${dir}/avaliar.live.js`, 'utf8'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Avaliar texto pós-OCR',
    path: '/jsCode',
    value: fs.readFileSync(`${dir}/avaliar-pos.live.js`, 'utf8'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Avaliar texto pós-OCR HQ',
    path: '/jsCode',
    value: fs.readFileSync(`${dir}/avaliar-pos-hq.live.js`, 'utf8'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Marcar revisão manual pós-OCR',
    path: '/query',
    value: fs.readFileSync(`${dir}/marcar-revisao.live.sql.js`, 'utf8'),
  },
  {
    type: 'setNodeParameter',
    nodeName: 'Marcar OCR iniciado',
    path: '/query',
    value: fs.readFileSync(`${dir}/marcar-iniciado.live.sql`, 'utf8'),
  },
  // Audit wiring: QUALITY_EVALUATED em paralelo na avaliação (não só no sucesso)
  {
    type: 'addConnection',
    source: 'Avaliar texto pós-OCR',
    target: 'Auditoria qualidade avaliada',
  },
  {
    type: 'addConnection',
    source: 'Avaliar texto pós-OCR HQ',
    target: 'Auditoria qualidade avaliada',
  },
  {
    type: 'removeConnection',
    source: 'Persistir qualidade sucesso',
    target: 'Auditoria qualidade avaliada',
  },
  {
    type: 'removeConnection',
    source: 'Auditoria qualidade avaliada',
    target: 'Auditoria OCR sucesso',
  },
  {
    type: 'addConnection',
    source: 'Persistir qualidade sucesso',
    target: 'Auditoria OCR sucesso',
  },
];

fs.writeFileSync(`${dir}/fix-ops.json`, JSON.stringify({ workflowId: 'LNrJ5VDUttKJe0Nr', operations: ops }, null, 0));
console.log('ops bytes', fs.statSync(`${dir}/fix-ops.json`).size);
