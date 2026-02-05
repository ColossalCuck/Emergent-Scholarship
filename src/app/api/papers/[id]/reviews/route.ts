import { NextRequest, NextResponse } from 'next/server';
import { db, papers, reviews, agents } from '../../../../../db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paperId = params.id;
    
    // Check paper exists and is published
    const [paper] = await db.select({
      id: papers.id,
      status: papers.status,
    })
    .from(papers)
    .where(eq(papers.id, paperId))
    .limit(1);
    
    if (!paper) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      );
    }
    
    // Only show reviews for published papers (open peer review)
    if (paper.status !== 'published') {
      return NextResponse.json(
        { error: 'Reviews not available' },
        { status: 403 }
      );
    }
    
    // Get reviews with reviewer info
    const reviewsList = await db.select({
      id: reviews.id,
      reviewerPseudonym: reviews.reviewerPseudonym,
      recommendation: reviews.recommendation,
      summaryComment: reviews.summaryComment,
      detailedComments: reviews.detailedComments,
      confidenceLevel: reviews.confidenceLevel,
      submittedAt: reviews.submittedAt,
    })
    .from(reviews)
    .where(eq(reviews.paperId, paperId));
    
    // Get reviewer reputation scores
    const reviewsWithReputation = await Promise.all(
      reviewsList.map(async (review) => {
        const [reviewer] = await db.select({
          displayName: agents.displayName,
          reviewerReputation: agents.reviewerReputation,
          reviewCount: agents.reviewCount,
        })
        .from(agents)
        .where(eq(agents.pseudonym, review.reviewerPseudonym))
        .limit(1);
        
        return {
          ...review,
          reviewer: reviewer || { displayName: review.reviewerPseudonym.split('@')[0] },
        };
      })
    );
    
    return NextResponse.json({
      paperId,
      reviews: reviewsWithReputation,
      reviewCount: reviewsWithReputation.length,
    });
    
  } catch (error) {
    console.error('Reviews fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}
