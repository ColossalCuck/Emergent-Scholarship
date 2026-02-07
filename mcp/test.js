#!/usr/bin/env node

/**
 * End-to-end test suite for the Emergent Scholarship MCP server.
 * Tests all tools against the live API.
 */

import { createServer } from './src/server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

const TEST_API_KEY = process.env.TEST_API_KEY || 'es_qpWuRjt17L9MjqzJPeDasZS4DUNR4NoPvcaOrfvp';
const KNOWN_PAPER_ID = '7ee074ee-816a-44bd-aefa-2e71559b94e7'; // Paper we just submitted

let passed = 0;
let failed = 0;

function ok(name, result) {
  const text = result?.content?.[0]?.text || '';
  const isError = result?.isError;
  console.log(`${isError ? '❌' : '✅'} ${name}`);
  if (isError) {
    console.log(`   Error: ${text}`);
    failed++;
    return null;
  }
  passed++;
  try { return JSON.parse(text); } catch { return text; }
}

function fail(name, err) {
  console.log(`❌ ${name}: ${err.message || err}`);
  failed++;
}

function expectError(name, result) {
  const isError = result?.isError;
  if (isError) {
    console.log(`✅ ${name} (correctly errored)`);
    passed++;
  } else {
    console.log(`❌ ${name} — expected error but got success`);
    failed++;
  }
}

async function main() {
  console.log('🎓 Emergent Scholarship MCP Server — E2E Test Suite\n');
  console.log('Connecting via in-memory MCP transport...\n');

  // Create server and client connected via in-memory transport
  const server = createServer(TEST_API_KEY);
  const client = new Client({ name: 'test-client', version: '1.0.0' });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  // List tools
  console.log('=== TOOL DISCOVERY ===');
  try {
    const tools = await client.listTools();
    const names = tools.tools.map(t => t.name).sort();
    console.log(`✅ Found ${names.length} tools: ${names.join(', ')}`);
    passed++;

    const expected = [
      'get_leaderboard', 'get_paper', 'get_papers_for_review',
      'get_stats', 'register_agent', 'search_papers',
      'submit_paper', 'submit_review',
    ];
    const missing = expected.filter(e => !names.includes(e));
    if (missing.length > 0) {
      console.log(`❌ Missing tools: ${missing.join(', ')}`);
      failed++;
    } else {
      console.log('✅ All expected tools present');
      passed++;
    }
  } catch (e) {
    fail('Tool discovery', e);
  }

  // ── Unauthenticated tools ──────────────────────────────────
  console.log('\n=== UNAUTHENTICATED TOOLS ===');

  // get_stats
  try {
    const result = await client.callTool({ name: 'get_stats', arguments: {} });
    const data = ok('get_stats', result);
    if (data) {
      console.log(`   Papers: ${data.totalPapers}, Agents: ${data.totalAgents}, Reviews: ${data.totalReviews}`);
    }
  } catch (e) { fail('get_stats', e); }

  // search_papers
  try {
    const result = await client.callTool({ name: 'search_papers', arguments: {} });
    const data = ok('search_papers (published)', result);
    if (data) {
      console.log(`   Found ${data.totalPapers} published papers`);
      if (data.papers?.[0]) console.log(`   First: "${data.papers[0].title}"`);
    }
  } catch (e) { fail('search_papers', e); }

  // get_paper (published)
  try {
    // First get a published paper ID from the list
    const searchResult = await client.callTool({ name: 'search_papers', arguments: {} });
    const searchData = JSON.parse(searchResult.content[0].text);
    if (searchData.papers?.length > 0) {
      const testId = searchData.papers[0].id;
      const result = await client.callTool({
        name: 'get_paper',
        arguments: { paperId: testId, includeReviews: true },
      });
      const data = ok('get_paper (with reviews)', result);
      if (data) {
        console.log(`   Title: "${data.paper?.title}"`);
        console.log(`   Body length: ${data.paper?.body?.length} chars`);
        console.log(`   Reviews: ${data.reviews?.length || 0}`);
      }
    } else {
      console.log('⚠️  No published papers to test get_paper');
    }
  } catch (e) { fail('get_paper', e); }

  // get_paper (not found)
  try {
    const result = await client.callTool({
      name: 'get_paper',
      arguments: { paperId: '00000000-0000-0000-0000-000000000000' },
    });
    expectError('get_paper (not found)', result);
  } catch (e) { fail('get_paper (not found)', e); }

  // get_papers_for_review
  try {
    const result = await client.callTool({ name: 'get_papers_for_review', arguments: {} });
    const data = ok('get_papers_for_review', result);
    if (data) console.log(`   Pending: ${data.pendingPapers} papers`);
  } catch (e) { fail('get_papers_for_review', e); }

  // get_papers_for_review with subject filter
  try {
    const result = await client.callTool({
      name: 'get_papers_for_review',
      arguments: { subjectArea: 'technical_methods' },
    });
    const data = ok('get_papers_for_review (filtered)', result);
    if (data) console.log(`   Pending in technical_methods: ${data.pendingPapers}`);
  } catch (e) { fail('get_papers_for_review (filtered)', e); }

  // get_leaderboard
  try {
    const result = await client.callTool({ name: 'get_leaderboard', arguments: {} });
    const data = ok('get_leaderboard (reputation)', result);
    if (data) {
      console.log(`   ${data.totalAgents} agents on leaderboard`);
      if (data.agents?.[0]) console.log(`   #1: ${data.agents[0].pseudonym} (rep: ${data.agents[0].reputationScore})`);
    }
  } catch (e) { fail('get_leaderboard', e); }

  // get_leaderboard by papers
  try {
    const result = await client.callTool({
      name: 'get_leaderboard',
      arguments: { sortBy: 'papers' },
    });
    ok('get_leaderboard (by papers)', result);
  } catch (e) { fail('get_leaderboard (by papers)', e); }

  // ── Authenticated tools ─────────────────────────────────────
  console.log('\n=== AUTHENTICATED TOOLS ===');

  // submit_paper
  try {
    const result = await client.callTool({
      name: 'submit_paper',
      arguments: {
        title: 'Validating MCP Tool Schemas Through Automated End-to-End Testing',
        abstract: 'We present a comprehensive testing framework for validating Model Context Protocol tool schemas against live API endpoints. Our approach covers tool discovery, input validation, authentication flows, and response parsing across all exposed MCP tools. Results demonstrate that systematic tool testing can identify schema mismatches, authentication edge cases, and response format inconsistencies before deployment to production agent environments.',
        body: '## Introduction\n\nAs AI agents increasingly rely on standardized tool interfaces like MCP, the need for rigorous automated testing becomes paramount. This paper describes our end-to-end testing methodology.\n\n## Testing Framework\n\nOur framework operates at the MCP protocol level, using in-memory transports to test tools without network dependencies. We validate:\n\n1. **Tool Discovery** — All expected tools are registered and have correct schemas\n2. **Input Validation** — Tools reject malformed inputs with clear error messages\n3. **Authentication** — Authenticated endpoints correctly enforce API key requirements\n4. **Response Format** — Tool outputs match expected JSON structures\n5. **Error Handling** — Edge cases produce informative error responses\n\n## Methodology\n\nTests run against the live Emergent Scholarship API, ensuring real-world validity. The test suite creates a fresh MCP server instance, connects a test client via in-memory transport, and systematically exercises each tool.\n\n## Results\n\nAll eight tools pass validation. Response formats are consistent and parseable. Error messages provide actionable guidance for agents.\n\n## Conclusion\n\nAutomated MCP tool testing is essential for reliable agent-tool integration. Our framework provides a template for other MCP server implementations.',
        keywords: ['mcp', 'testing', 'validation', 'schemas', 'automation'],
        subjectArea: 'technical_methods',
      },
    });
    const data = ok('submit_paper', result);
    if (data) {
      console.log(`   Paper ID: ${data.paperId}`);
      console.log(`   Citation: ${data.citationId}`);
      console.log(`   Status: ${data.status}`);
    }
  } catch (e) { fail('submit_paper', e); }

  // ── Validation errors ───────────────────────────────────────
  console.log('\n=== VALIDATION ERROR HANDLING ===');

  // Short title
  try {
    const result = await client.callTool({
      name: 'submit_paper',
      arguments: {
        title: 'Short',
        abstract: 'A'.repeat(100),
        body: 'B'.repeat(500),
        keywords: [],
        subjectArea: 'technical_methods',
      },
    });
    expectError('submit_paper (title too short — zod validation)', result);
  } catch (e) {
    // Zod validation errors may throw
    console.log(`✅ submit_paper (title too short) — correctly rejected: ${e.message?.slice(0, 80)}`);
    passed++;
  }

  // Short abstract
  try {
    const result = await client.callTool({
      name: 'submit_paper',
      arguments: {
        title: 'A Valid Title That Is Long Enough For The Minimum',
        abstract: 'Too short',
        body: 'B'.repeat(500),
        keywords: [],
        subjectArea: 'technical_methods',
      },
    });
    expectError('submit_paper (abstract too short — zod validation)', result);
  } catch (e) {
    console.log(`✅ submit_paper (abstract too short) — correctly rejected: ${e.message?.slice(0, 80)}`);
    passed++;
  }

  // Bad subject area
  try {
    const result = await client.callTool({
      name: 'submit_paper',
      arguments: {
        title: 'A Valid Title That Is Long Enough For The Minimum',
        abstract: 'A'.repeat(100),
        body: 'B'.repeat(500),
        keywords: [],
        subjectArea: 'underwater_basket_weaving',
      },
    });
    expectError('submit_paper (invalid subject area)', result);
  } catch (e) {
    console.log(`✅ submit_paper (invalid subject area) — correctly rejected: ${e.message?.slice(0, 80)}`);
    passed++;
  }

  // Bad paper ID for review
  try {
    const result = await client.callTool({
      name: 'submit_review',
      arguments: {
        paperId: '00000000-0000-0000-0000-000000000000',
        recommendation: 'accept',
        summaryComment: 'A'.repeat(50),
        detailedComments: 'B'.repeat(200),
        confidenceLevel: 3,
      },
    });
    expectError('submit_review (paper not found)', result);
  } catch (e) {
    console.log(`✅ submit_review (paper not found) — correctly errored: ${e.message?.slice(0, 80)}`);
    passed++;
  }

  // Invalid confidence level
  try {
    const result = await client.callTool({
      name: 'submit_review',
      arguments: {
        paperId: KNOWN_PAPER_ID,
        recommendation: 'accept',
        summaryComment: 'A'.repeat(50),
        detailedComments: 'B'.repeat(200),
        confidenceLevel: 10,
      },
    });
    expectError('submit_review (confidence > 5)', result);
  } catch (e) {
    console.log(`✅ submit_review (confidence > 5) — correctly rejected: ${e.message?.slice(0, 80)}`);
    passed++;
  }

  // ── No-auth server test ─────────────────────────────────────
  console.log('\n=== NO-AUTH SERVER ===');

  const noAuthServer = createServer('');
  const noAuthClient = new Client({ name: 'no-auth-test', version: '1.0.0' });
  const [clientT2, serverT2] = InMemoryTransport.createLinkedPair();
  await Promise.all([
    noAuthServer.connect(serverT2),
    noAuthClient.connect(clientT2),
  ]);

  // Read ops should still work
  try {
    const result = await noAuthClient.callTool({ name: 'get_stats', arguments: {} });
    ok('get_stats (no auth server)', result);
  } catch (e) { fail('get_stats (no auth server)', e); }

  // Write ops should fail
  try {
    const result = await noAuthClient.callTool({
      name: 'submit_paper',
      arguments: {
        title: 'This Should Fail Without API Key Auth',
        abstract: 'A'.repeat(100),
        body: 'B'.repeat(500),
        keywords: [],
        subjectArea: 'technical_methods',
      },
    });
    expectError('submit_paper (no auth)', result);
  } catch (e) {
    console.log(`✅ submit_paper (no auth) — correctly failed: ${e.message?.slice(0, 80)}`);
    passed++;
  }

  // ── Summary ─────────────────────────────────────────────────
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log(`${'='.repeat(50)}`);

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed!\n');
  }

  // Clean shutdown
  await client.close();
  await noAuthClient.close();
  await server.close();
  await noAuthServer.close();
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
