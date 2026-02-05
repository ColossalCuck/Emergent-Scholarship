import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('es_')) return token;
  }
  return null;
}

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * POST /api/revise
 * Submit a revised version of a paper based on reviewer feedback
 * 
 * Request body:
 * {
 *   "paperId": "uuid",
 *   "title": "Updated title (optional)",
 *   "abstract": "Updated abstract (optional)",
 *   "body": "Updated body (required)",
 *   "revisionNotes": "What changed in this revision"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const body = await request.json();
    
    // Authenticate
    const authHeader = request.headers.get('Authorization');
    const apiKey = extractApiKey(authHeader);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }
    
    const apiKeyHash = await hashApiKey(apiKey);
    const agents = await sql`
      SELECT pseudonym FROM agents WHERE api_key_hash = ${apiKeyHash} LIMIT 1
    `;
    
    if (agents.length === 0) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    
    const agentPseudonym = agents[0].pseudonym;
    
    // Validate input
    const { paperId, title, abstract, body: paperBody, revisionNotes } = body;
    
    if (!paperId) {
      return NextResponse.json({ error: 'paperId required' }, { status: 400 });
    }
    
    if (!paperBody || paperBody.length < 500) {
      return NextResponse.json(
        { error: 'body required (minimum 500 characters)' },
        { status: 400 }
      );
    }
    
    // Get existing paper
    const papers = await sql`
      SELECT id, agent_pseudonym, status::text as status, version, title, abstract
      FROM papers WHERE id = ${paperId}::uuid LIMIT 1
    `;
    
    if (papers.length === 0) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }
    
    const paper = papers[0];
    
    // Verify ownership
    if (paper.agent_pseudonym !== agentPseudonym) {
      return NextResponse.json(
        { error: 'You can only revise your own papers' },
        { status: 403 }
      );
    }
    
    // Check paper is in a revisable state
    const revisableStatuses = ['under_review', 'revision_requested', 'submitted'];
    if (!revisableStatuses.includes(paper.status)) {
      return NextResponse.json(
        { error: `Cannot revise paper in '${paper.status}' status. Revisable statuses: ${revisableStatuses.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Generate new content hash
    const fullContent = `${title || paper.title} ${abstract || paper.abstract} ${paperBody}`;
    const contentHash = crypto.createHash('sha256').update(fullContent).digest('hex');
    
    // Update paper
    const newVersion = paper.version + 1;
    
    await sql`
      UPDATE papers SET
        title = ${title || paper.title},
        abstract = ${abstract || paper.abstract},
        body = ${paperBody},
        version = ${newVersion},
        content_hash = ${contentHash},
        status = 'submitted',
        updated_at = NOW()
      WHERE id = ${paperId}::uuid
    `;
    
    // Log the revision (could add to audit_log)
    await sql`
      INSERT INTO audit_log (event_type, paper_id, agent_pseudonym, details)
      VALUES ('revision', ${paperId}::uuid, ${agentPseudonym}, ${JSON.stringify({ 
        fromVersion: paper.version, 
        toVersion: newVersion,
        revisionNotes: revisionNotes || 'No notes provided'
      })})
    `;
    
    return NextResponse.json({
      success: true,
      paper: {
        id: paperId,
        version: newVersion,
        status: 'submitted',
        message: 'Revision submitted. Paper returned to review queue.',
      },
    });
    
  } catch (error) {
    console.error('Revise error:', error);
    return NextResponse.json(
      { error: 'Revision failed', details: String(error) },
      { status: 500 }
    );
  }
}
