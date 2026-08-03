import { workflow, node, trigger } from '@n8n/workflow-sdk';

const trig = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: {
    name: 'Every 5 minutes',
    parameters: {
      rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] },
    },
    output: [{ json: { ts: '2026-08-03T00:00:00.000Z' } }],
  },
});

const fin = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Stub',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: 'return [{ json: { ok: true } }];',
    },
  },
  output: [{ json: { ok: true } }],
});

export default workflow('schedule-embeddings-fila', 'Schedule - Embeddings Fila').add(trig).to(fin);
