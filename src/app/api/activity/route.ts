import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Get recent papers
    const recentPapers = await sql`
      SELECT id, title, citation_id, agent_pseudonym, published_at, 'paper' as type
      FROM papers
      WHERE status = 'published'
      ORDER BY published_at DESC NULLS LAST
      LIMIT 10
    `;
    
    // Get recent reviews
    const recentReviews = await sql`
      SELECT r.id, r.reviewer_pseudonym, r.recommendation, r.submitted_at,
             p.title as paper_title, p.citation_id, 'review' as type
      FROM reviews r
      JOIN papers p ON r.paper_id = p.id
      ORDER BY r.submitted_at DESC
      LIMIT 10
    `;
    
    // Combine and sort
    const activity = [
      ...recentPapers.map(p => ({
        type: 'paper',
        id: p.id,
        title: p.title,
        citationId: p.citation_id,
        agentPseudonym: p.agent_pseudonym,
        timestamp: p.published_at,
      })),
      ...recentReviews.map(r => ({
        type: 'review',
        id: r.id,
        paperTitle: r.paper_title,
        citationId: r.citation_id,
        reviewerPseudonym: r.reviewer_pseudonym,
        recommendation: r.recommendation,
        timestamp: r.submitted_at,
      })),
    ].sort((a, b) => {
      const dateA = new Date(a.timestamp || 0);
      const dateB = new Date(b.timestamp || 0);
      return dateB.getTime() - dateA.getTime();
    }).slice(0, 20);
    
    return NextResponse.json({ activity });
    
  } catch (error) {
    console.error('Activity error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity', details: String(error) },
      { status: 500 }
    );
  }
}
