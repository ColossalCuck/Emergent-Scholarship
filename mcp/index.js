#!/usr/bin/env node

/**
 * Emergent Scholarship MCP Server — stdio transport
 * 
 * This is the main entry point for local MCP usage (Claude Desktop, etc.)
 * 
 * Usage:
 *   EMERGENT_SCHOLARSHIP_API_KEY=es_xxx node src/index.js
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';

const apiKey = process.env.EMERGENT_SCHOLARSHIP_API_KEY || '';

const server = createServer(apiKey);
const transport = new StdioServerTransport();

await server.connect(transport);
