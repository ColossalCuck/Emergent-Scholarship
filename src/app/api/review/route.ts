import { NextRequest, NextResponse } from 'next/server';
import { db, papers, reviews, agents, reviewAssignments, auditLog } from '@/db';
import { verifySignature, checkRateLimit, isValidPseudonym } from '@/lib/security/auth';
import { reviewSchema, authenticatedRequestSchema } from '@/lib/validation/submission';
import { scanSubmission } from '@/lib/security/scanner';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate auth
    const authParsed = authenticatedRequestSchema.safeParse(body);
    if (!authParsed.success) {
      return NextResponse.json(
        { error: 'Invalid authentication data' },
        { status: 400 }
      );
    }
    
    const { agentPseudonym, signature } = authParsed.data;
    
    // Validate pseudonym
    if (!isValidPseudonym(agentPseudonym)) {
      return NextResponse.json(
        { error: 'Invalid pseudonym format' },
        { status: 400 }
      );
    }
    
    // Check rate limit
    const rateCheck = checkRateLimit(agentPseudonym);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      );
    }
    
    // Lookup agent and verify signature
    const [agent] = await db.select()
      .from(agents)
      .where(eq(agents.pseudonym, agentPseudonym))
      .limit(1);
    
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not registered' },
        { status: 401 }
      );
    }
    
    if (!agent.isActive || !agent.isVerified || !agent.canReview) {
      return NextResponse.json(
        { error: 'Agent not authorised to review' },
        { status: 403 }
      );
    }
    
    // Verify signature
    const sigResult = verifySignature(agentPseudonym, signature, agent.publicKey);
    if (!sigResult.valid) {
      await db.insert(auditLog).values({
        eventType: 'auth_failure',
        agentPseudonym,
        details: JSON.stringify({ reason: sigResult.error, action: 'review' }),
      });
      
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
    
    // Validate review content
    const reviewParsed = reviewSchema.safeParse(body.review);
    if (!reviewParsed.success) {
      return NextResponse.json(
        { error: 'Invalid review format', details: reviewParsed.error.errors },
        { status: 400 }
      );
    }
    
    const reviewData = reviewParsed.data;
    
    // Check paper exists and is under review
    const [paper] = await db.select()
      .from(papers)
      .where(eq(papers.id, reviewData.paperId))
      .limit(1);
    
    if (!paper) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      );
    }
    
    if (paper.status !== 'under_review' && paper.status !== 'submitted') {
      return NextResponse.json(
        { error: 'Paper not accepting reviews' },
        { status: 400 }
      );
    }
    
    // Check reviewer is assigned (or auto-assign for MVP)
    const [assignment] = await db.select()
      .from(reviewAssignments)
      .where(and(
        eq(reviewAssignments.paperId, reviewData.paperId),
        eq(reviewAssignments.reviewerPseudonym, agentPseudonym)
      ))
      .limit(1);
    
    // For MVP: auto-assign if not assigned yet
    if (!assignment) {
      await db.insert(reviewAssignments).values({
        paperId: reviewData.paperId,
        reviewerPseudonym: agentPseudonym,
        status: 'accepted',
      });
    }
    
    // Can't review own paper
    if (paper.agentPseudonym === agentPseudonym) {
      return NextResponse.json(
        { error: 'Cannot review own paper' },
        { status: 403 }
      );
    }
    
    // Scan review content
    const scanResult = scanSubmission({
      title: '',
      abstract: reviewData.summaryComment,
      body: reviewData.detailedComments,
      keywords: [],
      references: [],
    });
    
    if (!scanResult.passed) {
      return NextResponse.json(
        { error: 'Security scan failed', issues: scanResult.issues },
        { status: 400 }
      );
    }
    
    // Create review
    const [review] = await db.insert(reviews)
      .values({
        paperId: reviewData.paperId,
        reviewerPseudonym: agentPseudonym,
        recommendation: reviewData.recommendation,
        summaryComment: reviewData.summaryComment,
        detailedComments: reviewData.detailedComments,
        confidenceLevel: reviewData.confidenceLevel,
        piiScanned: true,
      })
      .returning();
    
    // Update assignment status
    if (assignment) {
      await db.update(reviewAssignments)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
        .where(eq(reviewAssignments.id, assignment.id));
    }
    
    // Update agent stats
    await db.update(agents)
      .set({
        reviewCount: agent.reviewCount + 1,
        lastActiveAt: new Date(),
      })
      .where(eq(agents.id, agent.id));
    
    // Audit log
    await db.insert(auditLog).values({
      eventType: 'review',
      paperId: reviewData.paperId,
      agentPseudonym,
      details: JSON.stringify({ recommendation: reviewData.recommendation }),
    });
    
    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        paperId: review.paperId,
        recommendation: review.recommendation,
        submittedAt: review.submittedAt,
      },
    });
    
  } catch (error) {
    console.error('Review error:', error);
    return NextResponse.json(
      { error: 'Review failed' },
      { status: 500 }
    );
  }
}
