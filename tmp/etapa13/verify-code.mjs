import fs from 'fs';
import crypto from 'crypto';

const p = 'C:/Users/thale/.cursor/projects/c-Revita-Oftalmocentro/agent-tools/72f97f34-c8c4-42c5-a90b-cdc06869adec.txt';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const nodes = j.workflow.nodes;
const v = nodes.find((n) => n.name === 'Validar e normalizar');
const code = v.parameters.jsCode || '';
const local = fs
  .readFileSync('C:/Revita/Oftalmocentro/tmp/versioning/validar-normalizar.js', 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\r/g, '\n');

const hash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
console.log('versionId', j.workflow.versionId);
console.log('activeVersionId', j.workflow.activeVersionId);
console.log('deployed hash', hash(code));
console.log('local hash   ', hash(local));
console.log('equal', code === local);
console.log('getBinaryDataBuffer', code.includes('getBinaryDataBuffer'));
console.log('metaSize early', code.includes('metaSize === 0'));
console.log('FILE_EXTENSION_MISMATCH before dangerous generic',
  code.indexOf("FILE_EXTENSION_MISMATCH") < code.indexOf("DANGEROUS_EXTS.has(ext) || ext === 'zip'"));
// check critical regexes
console.log('regex ^\\.', code.includes("replace(/^\\./, '')"));
console.log('regex \\\\/g', code.includes("replace(/\\\\/g, '/')"));
console.log('snippet helpers:', code.slice(code.indexOf('getBinaryDataBuffer') - 40, code.indexOf('getBinaryDataBuffer') + 60));
