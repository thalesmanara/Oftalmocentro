const mcpUrl = process.env.N8N_MCP_URL || 'https://n8n.oftalmocentrouberaba.cloud/mcp-server/http';
let reqId = 1;

export async function mcpCall(toolName, args) {
  const body = { jsonrpc: '2.0', id: reqId++, method: 'tools/call', params: { name: toolName, arguments: args } };
  const res = await fetch(mcpUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`MCP HTTP ${res.status}: ${text.slice(0, 800)}`);
  let parsed;
  if (text.includes('data:')) {
    const dataLines = text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).filter(Boolean);
    parsed = JSON.parse(dataLines[dataLines.length - 1]);
  } else {
    parsed = JSON.parse(text);
  }
  if (parsed.error) throw new Error(`${toolName}: ${JSON.stringify(parsed.error)}`);
  const content = parsed.result?.content?.[0]?.text;
  if (content) {
    try {
      return JSON.parse(content);
    } catch {
      return { raw: content };
    }
  }
  return parsed.result ?? parsed;
}

export async function getWorkflow(workflowId) {
  const r = await mcpCall('get_workflow_details', { workflowId });
  return r.workflow ?? r;
}

export function nodeByName(wf, name) {
  const n = (wf.nodes || []).find((x) => x.name === name);
  if (!n) throw new Error(`node not found: ${name}`);
  return n;
}
