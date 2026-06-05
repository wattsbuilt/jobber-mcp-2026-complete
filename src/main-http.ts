#!/usr/bin/env node /\*\*

- Jobber MCP Server - HTTP/SSE transport for Railway / remote hosting \*/ import { createServer, IncomingMessage, ServerResponse } from 'node:http'; import { Server } from '@modelcontextprotocol/sdk/server/index.js'; import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'; import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js'; import { JobberClient } from './clients/jobber.js'; import { jobsTools } from './tools/jobs-tools.js'; import { clientsTools } from './tools/clients-tools.js'; import { quotesTools } from './tools/quotes-tools.js'; import { invoicesTools } from './tools/invoices-tools.js'; import { schedulingTools } from './tools/scheduling-tools.js'; import { teamTools } from './tools/team-tools.js'; import { expensesTools } from './tools/expenses-tools.js'; import { productsTools } from './tools/products-tools.js'; import { requestsTools } from './tools/requests-tools.js'; import { reportingTools } from './tools/reporting-tools.js'; import { propertiesTools } from './tools/properties-tools.js'; import { timesheetsTools } from './tools/timesheets-tools.js'; import { lineItemsTools } from './tools/line-items-tools.js'; import { formsTools } from './tools/forms-tools.js'; import { taxesTools } from './tools/taxes-tools.js';

const PORT = parseInt(process.env.PORT || '3000', 10); const apiToken = process.env.JOBBER_API_TOKEN;

if (!apiToken) { console.error('FATAL: JOBBER_API_TOKEN environment variable is required'); process.exit(1); }

const allTools = { ...jobsTools, ...clientsTools, ...quotesTools, ...invoicesTools, ...schedulingTools, ...teamTools, ...expensesTools, ...productsTools, ...requestsTools, ...reportingTools, ...propertiesTools, ...timesheetsTools, ...lineItemsTools, ...formsTools, ...taxesTools, };

function createMcpServer() { const client = new JobberClient({ apiToken: apiToken! }); const server = new Server( { name: 'jobber-server', version: '1.0.0' }, { capabilities: { tools: {} } } ); const isReadOnly = (name: string) =&gt; name.startsWith('list\_') || name.startsWith('get\_') || name.startsWith('search\_');

server.setRequestHandler(ListToolsRequestSchema, async () =&gt; ({ tools: Object.entries(allTools).map((\[name, tool\]) =&gt; ({ name, description: tool.description, inputSchema: tool.inputSchema.shape, ...(isReadOnly(name) ? { readOnlyHint: true } : {}), })), }));

server.setRequestHandler(CallToolRequestSchema, async (request) =&gt; { const { name, arguments: args } = request.params; const tool = allTools\[name as keyof typeof allTools\]; if (!tool) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`); try { const validatedArgs = tool.inputSchema.parse(args); const result = await tool.execute(client, validatedArgs); return { content: \[{ type: 'text', text: JSON.stringify(result, null, 2) }\], structuredContent: result, }; } catch (error) { throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`); } });

return server; }

const sessions = new Map&lt;string, SSEServerTransport&gt;();

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) =&gt; { res.setHeader('Access-Control-Allow-Origin', '\*'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ status: 'ok', service: 'jobber-mcp' })); return; }

if (req.url === '/sse' && req.method === 'GET') { const transport = new SSEServerTransport('/message', res); const sessionId = transport.sessionId; sessions.set(sessionId, transport); const server = createMcpServer(); await server.connect(transport); req.on('close', () =&gt; sessions.delete(sessionId)); return; }

if (req.url?.startsWith('/message') && req.method === 'POST') { const sessionId = new URL(req.url, 'http://localhost').searchParams.get('sessionId'); const transport = sessionId ? sessions.get(sessionId) : undefined; if (!transport) { res.writeHead(400); res.end('Invalid session'); return; } let body = ''; req.on('data', (chunk: Buffer) =&gt; (body += chunk.toString())); req.on('end', async () =&gt; { try { await transport.handlePostMessage(req, res, JSON.parse(body)); } catch { res.writeHead(500); res.end('Error handling message'); } }); return; }

res.writeHead(404); res.end('Not found'); });

httpServer.listen(PORT, () =&gt; { console.log(`Jobber MCP HTTP server listening on port ${PORT}`); console.log(` SSE endpoint : /sse`); console.log(` Health check : /health`); });
