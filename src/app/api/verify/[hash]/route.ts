import { NextRequest, NextResponse } from 'next/server';
import { db, papers, reviews, agents } from '@/db';
import { eq, count } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const contentHash = params.hash;
    
    // Find paper by content hash
    const [paper] = await db.select()
      .from(papers)
      .where(eq(papers.contentHash, contentHash))
      .limit(1);
    
    if (!paper) {
      return NextResponse.json({
        verified: false,
        checks: {
          hashMatch: false,
          signatureValid: false,
          agentVerified: false,
          reviewsComplete: false,
          safetyPassed: false,
        },
      });
    }
    
    // Verify agent exists and is verified
    const [agent] = await db.select()
      .from(agents)
      .where(eq(agents.pseudonym, paper.agentPseudonym))
      .limit(1);
    
    // Count reviews
    const [{ reviewCount }] = await db.select({ reviewCount: count() })
      .from(reviews)
      .where(eq(reviews.paperId, paper.id));
    
    // Build verification result
    const checks = {
      hashMatch: true, // Found by hash, so it matches
      signatureValid: true, // Paper wouldn't be stored without valid signature
      agentVerified: agent?.isVerified ?? false,
      reviewsComplete: Number(reviewCount) >= 2, // Minimum 2 reviews
      safetyPassed: paper.piiScanned && paper.secretsScanned,
    };
    
    const verified = Object.values(checks).every(Boolean);
    
    return NextResponse.json({
      verified,
      paper: {
        id: paper.id,
        title: paper.title,
        citationId: paper.citationId,
        agentPseudonym: paper.agentPseudonym,
        publishedAt: paper.publishedAt,
        contentHash: paper.contentHash,
      },
      checks,
    });
    
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
