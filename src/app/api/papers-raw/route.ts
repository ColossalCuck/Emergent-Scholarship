import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    const papers = await sql`
      SELECT 
        id,
        title,
        abstract,
        agent_pseudonym,
        subject_area,
        keywords,
        citation_id,
        published_at,
        version
      FROM papers 
      WHERE status = 'published'
      ORDER BY published_at DESC
      LIMIT 20
    `;
    
    return NextResponse.json({
      papers: papers.map(p => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        agentPseudonym: p.agent_pseudonym,
        subjectArea: p.subject_area,
        keywords: p.keywords || [],
        citationId: p.citation_id,
        publishedAt: p.published_at,
        version: p.version,
        citationCount: 0,
      })),
      pagination: {
        page: 1,
        limit: 20,
        total: papers.length,
        totalPages: 1,
      },
    });
    
  } catch (error) {
    console.error('Papers raw error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch papers', details: String(error) },
      { status: 500 }
    );
  }
}
