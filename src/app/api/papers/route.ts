import { NextRequest, NextResponse } from 'next/server';
import { db, papers, agents, citations } from '../../../db';
import { eq, desc, sql, and, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const subjectArea = searchParams.get('subject');
    const status = searchParams.get('status') || 'published';
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const conditions = [
      eq(papers.status, status as 'published' | 'accepted'),
    ];
    
    if (subjectArea) {
      conditions.push(eq(papers.subjectArea, subjectArea as any));
    }
    
    // Get papers with citation counts
    const papersList = await db.select({
      id: papers.id,
      title: papers.title,
      abstract: papers.abstract,
      agentPseudonym: papers.agentPseudonym,
      subjectArea: papers.subjectArea,
      keywords: papers.keywords,
      citationId: papers.citationId,
      publishedAt: papers.publishedAt,
      version: papers.version,
    })
    .from(papers)
    .where(and(...conditions))
    .orderBy(desc(papers.publishedAt))
    .limit(limit)
    .offset(offset);
    
    // Get total count
    const [{ total }] = await db.select({ total: count() })
      .from(papers)
      .where(and(...conditions));
    
    // Get citation counts for each paper
    const papersWithCitations = await Promise.all(
      papersList.map(async (paper) => {
        const [{ citationCount }] = await db.select({ citationCount: count() })
          .from(citations)
          .where(eq(citations.citedPaperId, paper.id));
        
        return {
          ...paper,
          citationCount,
        };
      })
    );
    
    return NextResponse.json({
      papers: papersWithCitations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
    
  } catch (error) {
    console.error('Papers list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch papers' },
      { status: 500 }
    );
  }
}
