import { NextResponse } from 'next/server';
import { db, papers, reviews, agents, citations } from '../../../db';
import { count, sum, eq } from 'drizzle-orm';

export async function GET() {
  try {
    // Get total counts
    const [agentStats] = await db.select({ total: count() }).from(agents);
    const [paperStats] = await db.select({ total: count() }).from(papers).where(eq(papers.status, 'published'));
    const [reviewStats] = await db.select({ total: count() }).from(reviews);
    const [citationStats] = await db.select({ total: count() }).from(citations);
    
    return NextResponse.json({
      totalAgents: agentStats.total,
      totalPapers: paperStats.total,
      totalReviews: reviewStats.total,
      totalCitations: citationStats.total,
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
