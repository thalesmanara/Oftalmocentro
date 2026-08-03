#!/usr/bin/env node
import pg from 'pg';
import { randomUUID, createHash } from 'crypto';

const client = new pg.Client({
  connectionString:
    'postgresql://ZuOg8foF6iDUR8Y4:W8rAAeT4sJBTGB9ufVpYlvgcnZ0cHZ9L@2.24.89.199:5432/n8n',
});
await client.connect();

// Fix VALIDAR to always emit configurationJson + contentHash on success
{
  const { rows } = await client.query(
    `SELECT id, name, nodes, connections FROM workflow_entity WHERE id='0289408b8d774379'`,
  );
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  const connections =
    typeof rows[0].connections === 'string' ? JSON.parse(rows[0].connections) : rows[0].connections;
  const codeNode = nodes.find((n) => /validar|validate|code/i.test(n.name) && n.parameters?.jsCode);
  // find main validate code - usually largest jsCode
  let target = null;
  for (const n of nodes) {
    if (n.parameters?.jsCode && n.parameters.jsCode.length > 500) {
      if (!target || n.parameters.jsCode.length > target.parameters.jsCode.length) target = n;
    }
  }
  console.log('VALIDAR code node', target?.name, target?.parameters.jsCode.length);
  let code = target.parameters.jsCode;

  if (!code.includes('configurationJson') || !code.includes('contentHash')) {
    // Ensure success return includes serialized config + hash
    // Look for return ok pattern
    const patterns = [
      /return\s*\[\s*\{\s*json\s*:\s*\{([^}]*ok\s*:\s*true[^}]*)\}\s*\}\s*\]/,
      /ok\s*:\s*true[\s\S]{0,400}return/,
    ];
    writeFileSyncHelp(code);
  }

  // Safer: append normalization before every successful return by replacing a known success object builder
  if (code.includes('configurationJson') && code.includes('contentHash')) {
    console.log('already has fields');
  } else {
    // Inject helper near top after first function/const
    const inject = `
function __serializeConfig(cfg){
  const configuration = cfg && typeof cfg === 'object' ? cfg : {};
  const configurationJson = JSON.stringify(configuration);
  let contentHash = null;
  try {
    // simple stable hash without crypto in sandbox if unavailable
    let h = 0;
    for (let i = 0; i < configurationJson.length; i++) {
      h = ((h << 5) - h) + configurationJson.charCodeAt(i);
      h |= 0;
    }
    contentHash = 'c' + Math.abs(h).toString(16) + configurationJson.length.toString(16);
  } catch (_) {
    contentHash = 'c0';
  }
  return { configuration, configurationJson, contentHash };
}
`;
    code = inject + code;

    // Patch success returns that include configuration:
    code = code.replace(
      /configuration\s*:\s*([a-zA-Z0-9_]+)\s*,/g,
      (m, varName) => {
        // only once-ish - better do a more targeted replace on return payloads
        return m;
      },
    );

    // Find "ok: true" return blocks and ensure fields
    if (code.includes('ok: true') || code.includes('ok:true')) {
      code = code.replace(
        /(ok\s*:\s*true\s*,\s*)/g,
        `$1`,
      );
      // After building normalized config variable near end before returns
      // Replace common pattern: return [{ json: { ok: true, ... configuration: X
      code = code.replace(
        /return\s*\[\s*\{\s*json\s*:\s*\{([\s\S]*?ok\s*:\s*true[\s\S]*?)\}\s*\}\s*\]/g,
        (full, inner) => {
          if (inner.includes('configurationJson')) return full;
          // try to find configuration var
          let cfgExpr = 'configuration';
          const m = inner.match(/configuration\s*:\s*([^,\n]+)/);
          if (m) cfgExpr = m[1].trim();
          const extra = `...(() => { const __s=__serializeConfig(${cfgExpr}); return { configuration: __s.configuration, configurationJson: __s.configurationJson, contentHash: __s.contentHash }; })(), `;
          // Prepend spread into object - tricky. Simpler: append fields
          if (inner.includes('configuration:')) {
            return `return [{ json: { ${inner.replace(
              /configuration\s*:\s*([^,\n]+)/,
              'configuration: __serializeConfig($1).configuration, configurationJson: __serializeConfig($1).configurationJson, contentHash: __serializeConfig($1).contentHash',
            )} } }]`;
          }
          return `return [{ json: { ${extra}${inner} } }]`;
        },
      );
    }
    target.parameters.jsCode = code;
  }

  // Even better approach for CREATE: fix Inserir DRAFT SQL to use Preparar create.configurationJson and compute hash in Preparar/Montar
}

function writeFileSyncHelp(code) {
  import('fs').then((fs) => {
    fs.writeFileSync(new URL('./_c211-validar-code.js', import.meta.url), code);
  });
}

// Dump VALIDAR code for inspection
{
  const { rows } = await client.query(`SELECT nodes FROM workflow_entity WHERE id='0289408b8d774379'`);
  const nodes = typeof rows[0].nodes === 'string' ? JSON.parse(rows[0].nodes) : rows[0].nodes;
  let target = null;
  for (const n of nodes) {
    if (n.parameters?.jsCode && (!target || n.parameters.jsCode.length > target.parameters.jsCode.length)) {
      target = n;
    }
  }
  const fs = await import('fs');
  fs.writeFileSync(new URL('./_c211-validar-code.js', import.meta.url), target.parameters.jsCode);
  console.log('dumped', target.name, 'len', target.parameters.jsCode.length);
  console.log('has configurationJson', target.parameters.jsCode.includes('configurationJson'));
  console.log('has contentHash', target.parameters.jsCode.includes('contentHash'));
  // show return snippets
  const rets = [...target.parameters.jsCode.matchAll(/return\s*\[[\s\S]{0,400}/g)].slice(0, 8);
  for (const r of rets) console.log('RET:', r[0].slice(0, 250).replace(/\n/g, ' '));
}

await client.end();
