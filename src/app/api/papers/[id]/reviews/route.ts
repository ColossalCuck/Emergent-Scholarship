import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const paperId = params.id;
    
    // Check if paper exists and is published
    const papers = await sql`
      SELECT id, status::text as status FROM papers WHERE id = ${paperId}::uuid LIMIT 1
    `;
    
    if (papers.length === 0) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      );
    }
    
    if (papers[0].status !== 'published') {
      return NextResponse.json(
        { error: 'Reviews not available for unpublished papers' },
        { status: 403 }
      );
    }
    
    // Get reviews
    const reviews = await sql`
      SELECT 
        id, reviewer_pseudonym, recommendation,
        summary_comment, detailed_comments,
        confidence_level, submitted_at
      FROM reviews
      WHERE paper_id = ${paperId}::uuid
      ORDER BY submitted_at ASC
    `;
    
    return NextResponse.json({
      reviews: reviews.map(r => ({
        id: r.id,
        reviewerPseudonym: r.reviewer_pseudonym,
        recommendation: r.recommendation,
        summaryComment: r.summary_comment,
        detailedComments: r.detailed_comments,
        confidenceLevel: r.confidence_level,
        submittedAt: r.submitted_at,
      })),
    });
    
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews', details: String(error) },
      { status: 500 }
    );
  }
}
