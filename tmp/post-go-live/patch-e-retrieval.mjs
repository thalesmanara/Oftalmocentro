import { mcpCall, getWorkflow, nodeByName } from './mcp.mjs';

const WORKFLOW_ID = 'bae8872eeb164a27';
const NODE = 'Buscar chunks relevantes';

const ANCHOR = `  WHERE d.deleted_at IS NULL
    AND COALESCE(dv.processing_status, d.processing_status) = 'processed'`;

const REPLACEMENT = `  WHERE d.deleted_at IS NULL
    AND COALESCE(d.is_active, TRUE) = TRUE
    AND (
      COALESCE(dv.expiration_date, d.expiration_date) IS NULL
      OR COALESCE(dv.expiration_date, d.expiration_date) >= CURRENT_DATE
    )
    AND COALESCE(dv.processing_status, d.processing_status) = 'processed'`;

const wf = await getWorkflow(WORKFLOW_ID);
const node = nodeByName(wf, NODE);
const query = String(node.parameters.query);

if (query.includes('COALESCE(d.is_active, TRUE) = TRUE')) {
  console.log('already patched, nothing to do');
  process.exit(0);
}
const occurrences = query.split(ANCHOR).length - 1;
if (occurrences !== 1) throw new Error(`anchor found ${occurrences} times, expected 1`);

const patched = query.replace(ANCHOR, REPLACEMENT);
console.log('--- diff context ---');
console.log(patched.slice(patched.indexOf('WHERE d.deleted_at'), patched.indexOf('WHERE d.deleted_at') + 700));

const res = await mcpCall('update_workflow', {
  workflowId: WORKFLOW_ID,
  operations: [{ type: 'setNodeParameter', nodeName: NODE, path: '/query', value: patched }],
});
console.log('update:', JSON.stringify(res));

const pub = await mcpCall('publish_workflow', { workflowId: WORKFLOW_ID });
console.log('publish:', JSON.stringify(pub));
