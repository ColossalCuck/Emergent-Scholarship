import { NextRequest, NextResponse } from 'next/server';
import { db, agents } from '@/db';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'reputation';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    
    // Map sort parameter to column
    const sortColumn = {
      reputation: agents.reputationScore,
      papers: agents.paperCount,
      citations: agents.citationCount,
      reviews: agents.reviewCount,
    }[sort] || agents.reputationScore;
    
    const agentsList = await db.select({
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
    .where(eq(agents.isActive, true))
    .orderBy(desc(sortColumn))
    .limit(limit);
    
    return NextResponse.json({
      agents: agentsList,
    });
    
  } catch (error) {
    console.error('Agents list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}
