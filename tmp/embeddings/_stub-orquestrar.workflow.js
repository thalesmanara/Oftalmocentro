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
          { name: 'versionId', type: 'string' },
          { name: 'documentId', type: 'string' },
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
          { name: 'force', type: 'boolean' },
        ],
      },
    },
    output: [
      {
        json: {
          versionId: '11111111-1111-1111-1111-111111111111',
          documentId: '',
          requestId: '22222222-2222-2222-2222-222222222222',
          userId: '',
          sessionId: '',
          force: false,
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
      jsCode: "return [{ json: { ok: false, status: 'STUB' } }];",
    },
  },
  output: [{ json: { ok: false, status: 'STUB' } }],
});

export default workflow('embedding-orquestrar', 'EMBEDDING - ORQUESTRAR').add(trig).to(fin);
