import { workflow, node, trigger, newCredential } from '@n8n/workflow-sdk';

const PG_CRED = newCredential('Postgres account');
const OAI_CRED = newCredential('OpenAI account');

const trig = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.2,
  config: {
    name: 'Trigger',
    parameters: {
      inputSource: 'workflowInputs',
      workflowInputs: {
        values: [
          { name: 'chunkIds', type: 'array' },
          { name: 'requestId', type: 'string' },
          { name: 'userId', type: 'string' },
          { name: 'sessionId', type: 'string' },
        ],
      },
    },
    output: [
      {
        json: {
          chunkIds: ['11111111-1111-1111-1111-111111111111'],
          requestId: '22222222-2222-2222-2222-222222222222',
          userId: '',
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
    name: 'Finalizar stub',
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: "return [{ json: { ok: true, total: 0, skippedValid: 0, skippedEmpty: 0, generated: 0, failed: 0, pending: 0, _note: 'stub' } }];",
    },
  },
  output: [
    {
      json: {
        ok: true,
        total: 0,
        skippedValid: 0,
        skippedEmpty: 0,
        generated: 0,
        failed: 0,
        pending: 0,
      },
    },
  ],
});

// Keep credential refs so project linkage works when expanding.
void PG_CRED;
void OAI_CRED;

export default workflow('embedding-gerar', 'EMBEDDING - GERAR').add(trig).to(fin);
