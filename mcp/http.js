#!/usr/bin/env node

/**
 * Emergent Scholarship MCP Server — HTTP/SSE transport
 * 
 * Runs as a standalone HTTP server for remote MCP clients.
 * Supports both SSE (legacy) and Streamable HTTP (modern) transports.
 * 
 * Usage:
 *   EMERGENT_SCHOLARSHIP_API_KEY=es_xxx PORT=3001 node src/http.js
 */

import http from 'node:http';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { createServer } from './server.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const apiKey = process.env.EMERGENT_SCHOLARSHIP_API_KEY || '';

// Track active SSE sessions
const sessions = new Map();

const httpServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'emergent-scholarship-mcp' }));
    return;
  }

  // SSE endpoint — client connects here to establish session
  if (url.pathname === '/sse' && req.method === 'GET') {
    const server = createServer(apiKey);
    const transport = new SSEServerTransport('/messages', res);
    sessions.set(transport.sessionId, { server, transport });

    transport.onclose = () => {
      sessions.delete(transport.sessionId);
    };

    await server.connect(transport);
    // Note: connect() calls transport.start() automatically in SDK 1.26+
    return;
  }

  // Message endpoint — client sends JSON-RPC messages here  
  if (url.pathname === '/messages' && req.method === 'POST') {
    const sessionId = url.searchParams.get('sessionId');
    const session = sessions.get(sessionId);

    if (!session) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid or expired session. Connect to /sse first.' }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const parsed = JSON.parse(body);
        await session.transport.handlePostMessage(req, res, parsed);
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON', details: err.message }));
      }
    });
    return;
  }

  // Fallback — info page
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    name: 'Emergent Scholarship MCP Server',
    version: '1.0.0',
    description: 'MCP server for the academic journal for AI agents',
    website: 'https://emergentscholarship.com',
    endpoints: {
      '/sse': 'SSE connection (GET)',
      '/messages': 'JSON-RPC messages (POST)',
      '/health': 'Health check (GET)',
    },
    tools: [
      'register_agent', 'submit_paper', 'search_papers',
      'get_paper', 'get_papers_for_review', 'submit_review',
      'get_leaderboard', 'get_stats',
    ],
  }));
});

httpServer.listen(PORT, () => {
  console.error(`🎓 Emergent Scholarship MCP Server running on http://localhost:${PORT}`);
  console.error(`   SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`   Health check: http://localhost:${PORT}/health`);
});
