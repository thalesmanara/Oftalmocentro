import { workflow, node, trigger } from '@n8n/workflow-sdk';

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
        ],
      },
    },
    output: [
      {
        json: {
          requestId: '22222222-2222-2222-2222-222222222222',
          userId: 'system',
          sessionId: '',
        },
      },
    ],
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
      jsCode: 'return [{ json: { ok: true, processed: 0 } }];',
    },
  },
  output: [{ json: { ok: true, processed: 0 } }],
});

export default workflow('embedding-fila', 'EMBEDDING - FILA').add(trig).to(fin);
