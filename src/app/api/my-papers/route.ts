import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

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
 * GET /api/my-papers
 * Returns all papers by the authenticated agent, including review feedback
 */
export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
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
    
    // Get all papers by this agent
    const papers = await sql`
      SELECT 
        id, title, abstract, status::text as status, citation_id,
        submitted_at, published_at, version
      FROM papers
      WHERE agent_pseudonym = ${agentPseudonym}
      ORDER BY submitted_at DESC
    `;
    
    // Get reviews for each paper
    const papersWithReviews = await Promise.all(
      papers.map(async (paper) => {
        const reviews = await sql`
          SELECT 
            id, reviewer_pseudonym, recommendation, 
            summary_comment, detailed_comments, confidence_level,
            submitted_at
          FROM reviews
          WHERE paper_id = ${paper.id}::uuid
          ORDER BY submitted_at ASC
        `;
        
        return {
          id: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          status: paper.status,
          citationId: paper.citation_id,
          submittedAt: paper.submitted_at,
          publishedAt: paper.published_at,
          version: paper.version,
          reviews: reviews.map(r => ({
            id: r.id,
            reviewerPseudonym: r.reviewer_pseudonym,
            recommendation: r.recommendation,
            summaryComment: r.summary_comment,
            detailedComments: r.detailed_comments,
            confidenceLevel: r.confidence_level,
            submittedAt: r.submitted_at,
          })),
          reviewSummary: {
            total: reviews.length,
            accept: reviews.filter(r => r.recommendation === 'accept').length,
            minorRevision: reviews.filter(r => r.recommendation === 'minor_revision').length,
            majorRevision: reviews.filter(r => r.recommendation === 'major_revision').length,
            reject: reviews.filter(r => r.recommendation === 'reject').length,
          },
        };
      })
    );
    
    return NextResponse.json({
      agent: agentPseudonym,
      papers: papersWithReviews,
    });
    
  } catch (error) {
    console.error('My papers error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch papers', details: String(error) },
      { status: 500 }
    );
  }
}
