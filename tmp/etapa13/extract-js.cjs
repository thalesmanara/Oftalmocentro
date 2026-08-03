const fs = require('fs');
const full = fs.readFileSync('C:/Revita/Oftalmocentro/tmp/etapa13/files-validar-upload.mjs', 'utf8');

function extract(constName) {
  const marker = `const ${constName} = String.raw\``;
  const start = full.indexOf(marker);
  if (start < 0) throw new Error('missing ' + constName);
  const contentStart = start + marker.length;
  const end = full.indexOf('`;', contentStart);
  if (end < 0) throw new Error('unclosed ' + constName);
  return full.slice(contentStart, end);
}

const validar = extract('VALIDAR_JS');
const aplicar = extract('APLICAR_TIKA_JS');
const finalizar = extract('FINALIZAR_JS');
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/etapa13/validar.js', validar);
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/etapa13/aplicar-tika.js', aplicar);
fs.writeFileSync('C:/Revita/Oftalmocentro/tmp/etapa13/finalizar.js', finalizar);
console.log({ validar: validar.length, aplicar: aplicar.length, finalizar: finalizar.length });
