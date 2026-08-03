const fs = require('fs');
const raw = fs.readFileSync('C:\\Users\\thale\\.cursor\\projects\\c-Revita-Oftalmocentro\\agent-tools\\a4ca30f2-62da-4972-9d63-04e876101562.txt', 'utf8');
const obj = JSON.parse(raw);
console.log(JSON.stringify(obj.workflow.connections['OCR ok?'], null, 2));
console.log('---');
console.log(JSON.stringify(obj.workflow.connections['Tika ok?'], null, 2));
