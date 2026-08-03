import fs from 'fs';
import path from 'path';

const tools = String.raw`C:\Users\thale\.cursor\projects\c-Revita-Oftalmocentro\agent-tools`;
const files = fs.readdirSync(tools).filter((f) => f.endsWith('.txt'));

function loadWorkflow(file) {
  const raw = JSON.parse(fs.readFileSync(path.join(tools, file), 'utf8'));
  return raw?.data?.workflow || raw?.workflow || raw;
}

// Prefer latest ORQUESTRAR / Consulta dumps by content
let orq = null;
let ia = null;
for (const f of files) {
  try {
    const w = loadWorkflow(f);
    if (!w?.nodes) continue;
    const names = w.nodes.map((n) => n.name);
    if (names.includes('Avaliar texto pós-OCR') && names.includes('Chamar serviço OCR')) {
      if (!orq || (w.updatedAt || '') > (orq.updatedAt || '')) orq = { ...w, _file: f };
    }
    if (names.includes('Buscar chunks relevantes')) {
      if (!ia || (w.updatedAt || '') > (ia.updatedAt || '')) ia = { ...w, _file: f };
    }
  } catch {
    /* skip */
  }
}

if (!orq) {
  console.log('ORQUESTRAR dump not found in agent-tools');
} else {
  console.log('ORQUESTRAR file', orq._file, 'updated', orq.updatedAt, 'nodes', orq.nodes.length);
  const hq = orq.nodes.map((n) => n.name).filter((n) => /HQ|retry|qualidade|HIGH/i.test(n));
  console.log('HQ-related nodes:', hq);
  for (const name of ['Avaliar texto pós-OCR', 'Avaliar', 'Chamar serviço OCR']) {
    const n = orq.nodes.find((x) => x.name === name);
    if (!n) {
      console.log(name, 'MISSING');
      continue;
    }
    const code = n.parameters?.jsCode || n.parameters?.url || JSON.stringify(n.parameters);
    console.log('===', name, '===');
    console.log('thin=', String(code).includes('thin ='));
    console.log('evaluateDocumentQuality=', String(code).includes('evaluateDocumentQuality'));
    console.log('decidePostOcrAction=', String(code).includes('decidePostOcrAction'));
    console.log('quality=', /quality=/.test(String(code)));
    if (n.parameters?.jsCode) {
      const idx = code.indexOf('decidePostOcrAction');
      console.log((idx >= 0 ? code.slice(idx, idx + 280) : code.slice(0, 280)).replace(/\n/g, ' '));
    } else {
      console.log(String(code).slice(0, 300));
    }
  }
}

if (!ia) {
  console.log('Consulta IA dump not found');
} else {
  const n = ia.nodes.find((x) => x.name === 'Buscar chunks relevantes');
  const q = n?.parameters?.query || '';
  console.log('IA file', ia._file);
  console.log('ocr_quality_grade gate:', q.includes('ocr_quality_grade'));
  console.log(
    q
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /ocr_/i.test(l))
      .slice(-10),
  );
}
