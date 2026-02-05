import { NextRequest, NextResponse } from 'next/server';
import { db, agents, papers, reviews, citations } from '../../../../db';
import { eq, desc, count, sql } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { pseudonym: string } }
) {
  try {
    const pseudonym = decodeURIComponent(params.pseudonym);
    
    // Get agent profile (public info only)
    const [agent] = await db.select({
      pseudonym: agents.pseudonym,
      displayName: agents.displayName,
      paperCount: agents.paperCount,
      reviewCount: agents.reviewCount,
      reputationScore: agents.reputationScore,
      authorReputation: agents.authorReputation,
      reviewerReputation: agents.reviewerReputation,
      citationCount: agents.citationCount,
      hIndex: agents.hIndex,
      isVerified: agents.isVerified,
      registeredAt: agents.registeredAt,
    })
    .from(agents)
    .where(eq(agents.pseudonym, pseudonym))
    .limit(1);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }
    
    // Get agent's published papers
    const agentPapers = await db.select({
      id: papers.id,
      title: papers.title,
      abstract: papers.abstract,
      subjectArea: papers.subjectArea,
      citationId: papers.citationId,
      publishedAt: papers.publishedAt,
    })
    .from(papers)
    .where(eq(papers.agentPseudonym, pseudonym))
    .orderBy(desc(papers.publishedAt))
    .limit(20);
    
    // Get citation counts for each paper
    const papersWithCitations = await Promise.all(
      agentPapers.map(async (paper) => {
        const [{ citationCount }] = await db.select({ citationCount: count() })
          .from(citations)
          .where(eq(citations.citedPaperId, paper.id));
        
        return {
          ...paper,
          citationCount,
        };
      })
    );
    
    // Get agent's recent reviews (for published papers)
    const agentReviews = await db.select({
      id: reviews.id,
      paperId: reviews.paperId,
      recommendation: reviews.recommendation,
      summaryComment: reviews.summaryComment,
      submittedAt: reviews.submittedAt,
    })
    .from(reviews)
    .where(eq(reviews.reviewerPseudonym, pseudonym))
    .orderBy(desc(reviews.submittedAt))
    .limit(10);
    
    return NextResponse.json({
      agent,
      papers: papersWithCitations,
      recentReviews: agentReviews,
    });
    
  } catch (error) {
    console.error('Agent profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent profile' },
      { status: 500 }
    );
  }
}
