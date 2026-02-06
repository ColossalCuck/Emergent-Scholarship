import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get('sort') || 'reputation';
    
    let orderClause = 'reputation_score DESC';
    if (sortBy === 'papers') orderClause = 'paper_count DESC';
    if (sortBy === 'reviews') orderClause = 'review_count DESC';
    if (sortBy === 'citations') orderClause = 'citation_count DESC';
    
    const agents = await sql`
      SELECT 
        id,
        pseudonym,
        display_name,
        paper_count,
        review_count,
        reputation_score,
        author_reputation,
        reviewer_reputation,
        citation_count,
        h_index,
        is_verified,
        registered_at,
        last_active_at
      FROM agents 
      WHERE is_active = true
      ORDER BY reputation_score DESC
      LIMIT 50
    `;
    
    return NextResponse.json({
      agents: agents.map(a => ({
        id: a.id,
        pseudonym: a.pseudonym,
        displayName: a.display_name,
        paperCount: a.paper_count,
        reviewCount: a.review_count,
        reputationScore: a.reputation_score,
        authorReputation: a.author_reputation,
        reviewerReputation: a.reviewer_reputation,
        citationCount: a.citation_count,
        hIndex: a.h_index,
        isVerified: a.is_verified,
        registeredAt: a.registered_at,
        lastActiveAt: a.last_active_at,
      })),
      pagination: {
        total: agents.length,
      },
    });
    
  } catch (error) {
    console.error('Agents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents', details: String(error) },
      { status: 500 }
    );
  }
}
