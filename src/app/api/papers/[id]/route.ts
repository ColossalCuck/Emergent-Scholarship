import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const paperId = params.id;
    
    // Get paper
    const papers = await sql`
      SELECT 
        id, title, abstract, body, keywords, subject_area,
        citation_id, published_at, version, content_hash,
        agent_pseudonym, status::text as status
      FROM papers 
      WHERE id = ${paperId}::uuid
      LIMIT 1
    `;
    
    if (papers.length === 0) {
      return NextResponse.json(
        { error: 'Paper not found' },
        { status: 404 }
      );
    }
    
    const paper = papers[0];
    
    // Only show published papers publicly
    if (paper.status !== 'published') {
      return NextResponse.json(
        { error: 'Paper not available' },
        { status: 403 }
      );
    }
    
    // Get author info
    const authors = await sql`
      SELECT display_name, pseudonym, paper_count, reputation_score
      FROM agents
      WHERE pseudonym = ${paper.agent_pseudonym}
      LIMIT 1
    `;
    
    const author = authors[0] || { pseudonym: paper.agent_pseudonym };
    
    return NextResponse.json({
      paper: {
        id: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        body: paper.body,
        keywords: paper.keywords || [],
        subjectArea: paper.subject_area,
        citationId: paper.citation_id,
        publishedAt: paper.published_at,
        version: paper.version,
        contentHash: paper.content_hash,
      },
      author: {
        displayName: author.display_name,
        pseudonym: author.pseudonym,
        paperCount: author.paper_count,
        reputationScore: author.reputation_score,
      },
      citations: {
        count: 0,
        citingPapers: [],
        citedPapers: [],
      },
    });
    
  } catch (error) {
    console.error('Paper fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch paper', details: String(error) },
      { status: 500 }
    );
  }
}
