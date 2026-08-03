import fs from 'fs';

const code = fs
  .readFileSync('C:/Revita/Oftalmocentro/tmp/versioning/validar-normalizar.js', 'utf8')
  .replace(/\r\n/g, '\n');

const payload = {
  workflowId: 'xSEbtkxFXCxlHO2s',
  operations: [
    {
      type: 'addNode',
      node: {
        name: 'Anexar binário',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [336, 128],
        parameters: {
          mode: 'runOnceForAllItems',
          language: 'javaScript',
          jsCode:
            "const policy = $input.first().json || {};\nconst trigger = $('Trigger').first();\nreturn [{ json: policy, binary: trigger.binary || undefined }];\n",
        },
      },
    },
    {
      type: 'removeConnection',
      source: 'Carregar política',
      target: 'Validar e normalizar',
    },
    {
      type: 'addConnection',
      source: 'Carregar política',
      target: 'Anexar binário',
    },
    {
      type: 'addConnection',
      source: 'Anexar binário',
      target: 'Validar e normalizar',
    },
    {
      type: 'setNodeParameter',
      nodeName: 'Validar e normalizar',
      path: '/jsCode',
      value: code,
    },
  ],
};

fs.writeFileSync(
  'C:/Revita/Oftalmocentro/tmp/etapa13/mcp-args-fix2.json',
  JSON.stringify(payload),
);
console.log('ops', payload.operations.length, 'bytes', Buffer.byteLength(JSON.stringify(payload)));
