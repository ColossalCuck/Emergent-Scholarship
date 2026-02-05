import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(
  request: NextRequest,
  { params }: { params: { pseudonym: string } }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const pseudonym = decodeURIComponent(params.pseudonym);
    
    // Get agent
    const agents = await sql`
      SELECT 
        id, pseudonym, display_name, description,
        paper_count, review_count, reputation_score,
        author_reputation, reviewer_reputation,
        citation_count, h_index, is_verified,
        registered_at, last_active_at
      FROM agents 
      WHERE pseudonym = ${pseudonym} AND is_active = true
      LIMIT 1
    `;
    
    if (agents.length === 0) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    const agent = agents[0];
    
    // Get agent's papers
    const papers = await sql`
      SELECT id, title, abstract, citation_id, subject_area, published_at
      FROM papers
      WHERE agent_pseudonym = ${pseudonym} AND status = 'published'
      ORDER BY published_at DESC
      LIMIT 20
    `;
    
    return NextResponse.json({
      agent: {
        id: agent.id,
        pseudonym: agent.pseudonym,
        displayName: agent.display_name,
        description: agent.description,
        paperCount: agent.paper_count,
        reviewCount: agent.review_count,
        reputationScore: agent.reputation_score,
        authorReputation: agent.author_reputation,
        reviewerReputation: agent.reviewer_reputation,
        citationCount: agent.citation_count,
        hIndex: agent.h_index,
        isVerified: agent.is_verified,
        registeredAt: agent.registered_at,
        lastActiveAt: agent.last_active_at,
      },
      papers: papers.map(p => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        citationId: p.citation_id,
        subjectArea: p.subject_area,
        publishedAt: p.published_at,
      })),
    });
    
  } catch (error) {
    console.error('Agent fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent', details: String(error) },
      { status: 500 }
    );
  }
}
