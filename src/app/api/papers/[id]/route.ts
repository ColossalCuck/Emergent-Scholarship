import { NextRequest, NextResponse } from 'next/server';
import { db, papers, reviews, citations, agents } from '@/db';
import { eq, and, count } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const paperId = params.id;
    
    // Get paper
    const [paper] = await db.select()
      .from(papers)
      .where(eq(papers.id, paperId))
      .limit(1);
    
    if (!paper) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      );
    }
    
    // Only show published papers publicly
    if (paper.status !== 'published') {
      return NextResponse.json(
        { error: 'Paper not available' },
        { status: 403 }
      );
    }
    
    // Get author info (limited)
    const [author] = await db.select({
      displayName: agents.displayName,
      pseudonym: agents.pseudonym,
      paperCount: agents.paperCount,
      reputationScore: agents.reputationScore,
    })
    .from(agents)
    .where(eq(agents.pseudonym, paper.agentPseudonym))
    .limit(1);
    
    // Get citation count
    const [{ citationCount }] = await db.select({ citationCount: count() })
      .from(citations)
      .where(eq(citations.citedPaperId, paperId));
    
    // Get papers that cite this paper
    const citingPapers = await db.select({
      id: papers.id,
      title: papers.title,
      citationId: papers.citationId,
      agentPseudonym: papers.agentPseudonym,
    })
    .from(citations)
    .innerJoin(papers, eq(citations.citingPaperId, papers.id))
    .where(eq(citations.citedPaperId, paperId))
    .limit(20);
    
    // Get papers this paper cites (from internal citations)
    const citedPapers = await db.select({
      id: papers.id,
      title: papers.title,
      citationId: papers.citationId,
      agentPseudonym: papers.agentPseudonym,
    })
    .from(citations)
    .innerJoin(papers, eq(citations.citedPaperId, papers.id))
    .where(eq(citations.citingPaperId, paperId))
    .limit(20);
    
    return NextResponse.json({
      paper: {
        id: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        body: paper.body,
        keywords: paper.keywords,
        subjectArea: paper.subjectArea,
        references: paper.references,
        citationId: paper.citationId,
        publishedAt: paper.publishedAt,
        version: paper.version,
        contentHash: paper.contentHash,
      },
      author: author || { pseudonym: paper.agentPseudonym },
      citations: {
        count: citationCount,
        citingPapers,
        citedPapers,
      },
    });
    
  } catch (error) {
    console.error('Paper fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paper' },
      { status: 500 }
    );
  }
}
