const fs = require('fs');
const raw = fs.readFileSync('C:\\Revita\\Oftalmocentro\\tmp\\ocr-wf.txt', 'utf8');
const obj = JSON.parse(raw);
const wf = obj.workflow;
const node = wf.nodes.find(n => n.name === 'Auditoria OCR iniciado');
console.log(JSON.stringify(node.parameters.workflowInputs, null, 2));
