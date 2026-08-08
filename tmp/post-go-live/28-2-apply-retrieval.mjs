import { readFileSync, writeFileSync } from 'fs';
import { mcpCall } from './mcp.mjs';

const ops = JSON.parse(readFileSync('tmp/post-go-live/28-2-retrieval-ops.json', 'utf8'));

// Skip op 1 (Preparar busca texto) already applied via CallMcpTool
const remaining = ops.filter((o, i) => !(o.type === 'updateNodeParameters' && o.nodeName === 'Preparar busca texto'));

console.log('applying', remaining.length, 'ops');
const result = await mcpCall('update_workflow', {
  workflowId: 'bae8872eeb164a27',
  operations: remaining,
});
writeFileSync('tmp/post-go-live/28-2-retrieval-apply-result.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2).slice(0, 2000));

const pub = await mcpCall('publish_workflow', { workflowId: 'bae8872eeb164a27' });
writeFileSync('tmp/post-go-live/28-2-retrieval-publish.json', JSON.stringify(pub, null, 2));
console.log('published', pub);
