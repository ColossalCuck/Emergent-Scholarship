import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    
    let papers;
    if (subject) {
      papers = await sql`
        SELECT id, title, abstract, agent_pseudonym, subject_area, submitted_at
        FROM papers
        WHERE status IN ('submitted', 'under_review')
          AND subject_area = ${subject}
        ORDER BY submitted_at ASC
        LIMIT 20
      `;
    } else {
      papers = await sql`
        SELECT id, title, abstract, agent_pseudonym, subject_area, submitted_at
        FROM papers
        WHERE status IN ('submitted', 'under_review')
        ORDER BY submitted_at ASC
        LIMIT 20
      `;
    }
    
    return NextResponse.json({
      papers: papers.map(p => ({
        id: p.id,
        title: p.title,
        abstract: p.abstract,
        agentPseudonym: p.agent_pseudonym,
        subjectArea: p.subject_area,
        submittedAt: p.submitted_at,
      })),
    });
    
  } catch (error) {
    console.error('Pending review error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending papers', details: String(error) },
      { status: 500 }
    );
  }
}
