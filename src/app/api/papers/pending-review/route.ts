import { NextRequest, NextResponse } from 'next/server';
import { db, papers, reviews, reviewAssignments } from '../../../../db';
import { eq, and, count, desc, sql } from 'drizzle-orm';
import { scanForSafety, getReviewRequirements } from '../../../../lib/security/content-safety';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    
    // Build conditions
    const conditions = [
      eq(papers.status, 'submitted'),
    ];
    
    if (subject) {
      conditions.push(eq(papers.subjectArea, subject as any));
    }
    
    // Get papers that are submitted and need reviews
    const pendingPapers = await db.select({
      id: papers.id,
      title: papers.title,
      abstract: papers.abstract,
      subjectArea: papers.subjectArea,
      submittedAt: papers.submittedAt,
    })
    .from(papers)
    .where(and(...conditions))
    .orderBy(desc(papers.submittedAt))
    .limit(limit);
    
    // Calculate how many more reviewers each paper needs
    const papersWithNeeds = await Promise.all(
      pendingPapers.map(async (paper) => {
        // Count current reviews
        const [{ reviewCount }] = await db.select({ reviewCount: count() })
          .from(reviews)
          .where(eq(reviews.paperId, paper.id));
        
        // Count pending assignments
        const [{ assignmentCount }] = await db.select({ assignmentCount: count() })
          .from(reviewAssignments)
          .where(and(
            eq(reviewAssignments.paperId, paper.id),
            eq(reviewAssignments.status, 'pending')
          ));
        
        // Scan content to determine risk level
        const safetyResult = scanForSafety(paper.abstract + ' ' + paper.title);
        const requirements = getReviewRequirements(safetyResult.riskLevel, paper.subjectArea);
        
        const totalAssigned = Number(reviewCount) + Number(assignmentCount);
        const reviewersNeeded = Math.max(0, requirements.minimumReviewers - totalAssigned);
        
        return {
          id: paper.id,
          title: paper.title,
          abstract: paper.abstract.substring(0, 300) + (paper.abstract.length > 300 ? '...' : ''),
          subjectArea: paper.subjectArea,
          submittedAt: paper.submittedAt,
          riskLevel: safetyResult.riskLevel,
          reviewersNeeded,
          currentReviewers: totalAssigned,
          minimumRequired: requirements.minimumReviewers,
        };
      })
    );
    
    // Filter to only papers that still need reviewers
    const needingReview = papersWithNeeds.filter(p => p.reviewersNeeded > 0);
    
    return NextResponse.json({
      papers: needingReview,
      total: needingReview.length,
    });
    
  } catch (error) {
    console.error('Pending review error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending reviews' },
      { status: 500 }
    );
  }
}
