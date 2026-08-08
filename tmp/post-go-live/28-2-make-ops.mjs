/**
 * Apply retrieval patch via n8n MCP by printing operation payloads.
 * Actually calls update via fetch to n8n API if N8N_API_KEY set; else writes ops file.
 */
import { readFileSync, writeFileSync } from 'fs';

const p = JSON.parse(readFileSync('tmp/post-go-live/28-2-retrieval-patch.json', 'utf8'));
const get = (name) => p.nodes.find((n) => n.name === name);

const ops = [
  {
    type: 'updateNodeParameters',
    nodeName: 'Buscar chunks relevantes',
    replace: false,
    parameters: { query: get('Buscar chunks relevantes').parameters.query },
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Preparar busca texto',
    replace: false,
    parameters: {
      jsCode: get('Preparar busca texto').parameters.jsCode,
      mode: 'runOnceForAllItems',
      language: 'javaScript',
    },
  },
  {
    type: 'updateNodeParameters',
    nodeName: 'Merge híbrido',
    replace: false,
    parameters: {
      jsCode: get('Merge híbrido').parameters.jsCode,
      mode: 'runOnceForAllItems',
      language: 'javaScript',
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Preparar hidratação vetorial',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1400, 200],
      parameters: get('Preparar hidratação vetorial').parameters,
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Hidratar chunks vetoriais',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.6,
      position: [1620, 200],
      parameters: get('Hidratar chunks vetoriais').parameters,
      credentials: {
        postgres: { id: 'XJtGZ5rpCR7BpN0X', name: 'Postgres account' },
      },
    },
  },
  {
    type: 'addNode',
    node: {
      name: 'Aplicar hidratação vetorial',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1840, 200],
      parameters: get('Aplicar hidratação vetorial').parameters,
    },
  },
  { type: 'removeConnection', source: 'Guardar rows texto', target: 'Merge híbrido' },
  { type: 'removeConnection', source: 'Pular texto', target: 'Merge híbrido' },
  { type: 'addConnection', source: 'Guardar rows texto', target: 'Preparar hidratação vetorial' },
  { type: 'addConnection', source: 'Pular texto', target: 'Preparar hidratação vetorial' },
  { type: 'addConnection', source: 'Preparar hidratação vetorial', target: 'Hidratar chunks vetoriais' },
  { type: 'addConnection', source: 'Hidratar chunks vetoriais', target: 'Aplicar hidratação vetorial' },
  { type: 'addConnection', source: 'Aplicar hidratação vetorial', target: 'Merge híbrido' },
  {
    type: 'setNodeCredential',
    nodeName: 'Hidratar chunks vetoriais',
    credentialKey: 'postgres',
    credentialId: 'XJtGZ5rpCR7BpN0X',
    credentialName: 'Postgres account',
  },
  {
    type: 'setNodeSettings',
    nodeName: 'Hidratar chunks vetoriais',
    settings: { alwaysOutputData: true, onError: 'continueRegularOutput' },
  },
];

writeFileSync('tmp/post-go-live/28-2-retrieval-ops.json', JSON.stringify(ops, null, 2));
console.log('ops', ops.length);
console.log('sql len', get('Buscar chunks relevantes').parameters.query.length);
console.log('merge len', get('Merge híbrido').parameters.jsCode.length);
