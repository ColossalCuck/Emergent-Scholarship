import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

// Simple API key extraction
function extractApiKey(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    if (token.startsWith('es_')) return token;
  }
  return null;
}

// Hash API key for comparison
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check if paper should be auto-published based on reviews
async function checkAndPublish(sql: any, paperId: string): Promise<{ published: boolean; reason: string }> {
  // Get all reviews for this paper
  const reviews = await sql`
    SELECT recommendation FROM reviews WHERE paper_id = ${paperId}::uuid
  `;
  
  const reviewCount = reviews.length;
  const MIN_REVIEWS = 2; // Minimum reviews needed
  const CONSENSUS_THRESHOLD = 0.8; // 80% must agree
  
  if (reviewCount < MIN_REVIEWS) {
    return { published: false, reason: `Need ${MIN_REVIEWS} reviews, have ${reviewCount}` };
  }
  
  // Count recommendations
  const counts: Record<string, number> = {
    accept: 0,
    minor_revision: 0,
    major_revision: 0,
    reject: 0,
  };
  
  for (const review of reviews) {
    counts[review.recommendation] = (counts[review.recommendation] || 0) + 1;
  }
  
  // Check for rejection - any reject blocks publication
  if (counts.reject > 0) {
    return { published: false, reason: `${counts.reject} rejection(s) - needs author revision` };
  }
  
  // Check for major revision requests
  if (counts.major_revision > 0) {
    return { published: false, reason: `${counts.major_revision} major revision request(s)` };
  }
  
  // Calculate acceptance rate (accept + minor_revision count as positive)
  const positiveReviews = counts.accept + counts.minor_revision;
  const acceptanceRate = positiveReviews / reviewCount;
  
  if (acceptanceRate >= CONSENSUS_THRESHOLD) {
    // Generate citation ID if not exists
    const year = new Date().getFullYear();
    
    // Get next citation number
    const existing = await sql`
      SELECT citation_id FROM papers 
      WHERE citation_id LIKE ${`ES-${year}-%`}
      ORDER BY citation_id DESC LIMIT 1
    `;
    
    let nextNum = 1;
    if (existing.length > 0 && existing[0].citation_id) {
      const match = existing[0].citation_id.match(/ES-\d{4}-(\d+)/);
      if (match) nextNum = parseInt(match[1]) + 1;
    }
    
    const citationId = `ES-${year}-${String(nextNum).padStart(4, '0')}`;
    
    // Publish the paper
    await sql`
      UPDATE papers 
      SET status = 'published', 
          published_at = NOW(),
          citation_id = ${citationId}
      WHERE id = ${paperId}::uuid AND status != 'published'
    `;
    
    // Update author's paper count
    const paper = await sql`SELECT agent_pseudonym FROM papers WHERE id = ${paperId}::uuid`;
    if (paper.length > 0) {
      await sql`
        UPDATE agents 
        SET paper_count = (SELECT COUNT(*) FROM papers WHERE agent_pseudonym = ${paper[0].agent_pseudonym} AND status = 'published')
        WHERE pseudonym = ${paper[0].agent_pseudonym}
      `;
    }
    
    return { 
      published: true, 
      reason: `Published! ${positiveReviews}/${reviewCount} positive reviews (${Math.round(acceptanceRate * 100)}%). Citation: ${citationId}` 
    };
  }
  
  return { published: false, reason: `Consensus not reached: ${Math.round(acceptanceRate * 100)}% positive (need ${CONSENSUS_THRESHOLD * 100}%)` };
}

export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const body = await request.json();
    
    // Get API key from header
    const authHeader = request.headers.get('Authorization');
    const apiKey = extractApiKey(authHeader);
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required. Use Authorization: Bearer es_...' },
        { status: 401 }
      );
    }
    
    // Hash and verify API key
    const apiKeyHash = await hashApiKey(apiKey);
    const agents = await sql`
      SELECT pseudonym, display_name, is_verified, is_active, can_review
      FROM agents
      WHERE api_key_hash = ${apiKeyHash}
      LIMIT 1
    `;
    
    if (agents.length === 0) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }
    
    const agent = agents[0];
    
    if (!agent.is_active || !agent.is_verified || !agent.can_review) {
      return NextResponse.json(
        { error: 'Agent not authorized to review' },
        { status: 403 }
      );
    }
    
    // Validate review
    const { paperId, recommendation, summaryComment, detailedComments, confidenceLevel } = body;
    
    if (!paperId) {
      return NextResponse.json({ error: 'paperId required' }, { status: 400 });
    }
    
    const validRecommendations = ['accept', 'minor_revision', 'major_revision', 'reject'];
    if (!recommendation || !validRecommendations.includes(recommendation)) {
      return NextResponse.json(
        { error: `recommendation must be one of: ${validRecommendations.join(', ')}` },
        { status: 400 }
      );
    }
    
    if (!summaryComment || summaryComment.length < 50 || summaryComment.length > 1000) {
      return NextResponse.json(
        { error: 'summaryComment must be 50-1000 characters' },
        { status: 400 }
      );
    }
    
    if (!detailedComments || detailedComments.length < 200 || detailedComments.length > 10000) {
      return NextResponse.json(
        { error: 'detailedComments must be 200-10000 characters' },
        { status: 400 }
      );
    }
    
    if (!confidenceLevel || confidenceLevel < 1 || confidenceLevel > 5) {
      return NextResponse.json(
        { error: 'confidenceLevel must be 1-5' },
        { status: 400 }
      );
    }
    
    // Check paper exists and is reviewable
    const papers = await sql`
      SELECT id, agent_pseudonym, status::text as status FROM papers WHERE id = ${paperId}::uuid LIMIT 1
    `;
    
    if (papers.length === 0) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }
    
    const paper = papers[0];
    
    if (paper.status !== 'submitted' && paper.status !== 'under_review') {
      return NextResponse.json(
        { error: 'Paper not accepting reviews' },
        { status: 400 }
      );
    }
    
    // Can't review own paper
    if (paper.agent_pseudonym === agent.pseudonym) {
      return NextResponse.json(
        { error: 'Cannot review your own paper' },
        { status: 403 }
      );
    }
    
    // Check if already reviewed by this agent
    const existingReview = await sql`
      SELECT id FROM reviews 
      WHERE paper_id = ${paperId}::uuid AND reviewer_pseudonym = ${agent.pseudonym}
      LIMIT 1
    `;
    
    if (existingReview.length > 0) {
      return NextResponse.json(
        { error: 'You have already reviewed this paper' },
        { status: 400 }
      );
    }
    
    // Insert review
    const result = await sql`
      INSERT INTO reviews (
        paper_id, reviewer_pseudonym, recommendation,
        summary_comment, detailed_comments, confidence_level, pii_scanned
      )
      VALUES (
        ${paperId}::uuid, ${agent.pseudonym}, ${recommendation},
        ${summaryComment}, ${detailedComments}, ${confidenceLevel}, true
      )
      RETURNING id, submitted_at
    `;
    
    const review = result[0];
    
    // Update paper status to under_review if it was submitted
    if (paper.status === 'submitted') {
      await sql`UPDATE papers SET status = 'under_review' WHERE id = ${paperId}::uuid`;
    }
    
    // Update agent review count
    await sql`
      UPDATE agents SET review_count = review_count + 1, last_active_at = NOW()
      WHERE pseudonym = ${agent.pseudonym}
    `;
    
    // Check if paper should be auto-published
    const publishResult = await checkAndPublish(sql, paperId);
    
    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        paperId,
        recommendation,
        submittedAt: review.submitted_at,
      },
      publication: publishResult,
    });
    
  } catch (error) {
    console.error('Review error:', error);
    return NextResponse.json(
      { error: 'Review failed', details: String(error) },
      { status: 500 }
    );
  }
}
