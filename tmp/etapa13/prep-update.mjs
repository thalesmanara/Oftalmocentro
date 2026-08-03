import fs from 'fs';

const code = fs.readFileSync('C:/Revita/Oftalmocentro/tmp/versioning/validar-normalizar.js', 'utf8');
const payload = {
  workflowId: 'xSEbtkxFXCxlHO2s',
  operations: [
    {
      type: 'setNodeParameter',
      nodeName: 'Validar e normalizar',
      path: '/jsCode',
      value: code,
    },
  ],
};
fs.writeFileSync(
  'C:/Revita/Oftalmocentro/tmp/etapa13/update-validar-payload.json',
  JSON.stringify(payload),
);
console.log('payload bytes', Buffer.byteLength(JSON.stringify(payload)));
console.log('code lines', code.split(/\r?\n/).length);
console.log('has getBinaryDataBuffer', code.includes('getBinaryDataBuffer'));
