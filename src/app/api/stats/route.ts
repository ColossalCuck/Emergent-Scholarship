import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export async function GET(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    
    // Get counts
    const [paperCount] = await sql`SELECT COUNT(*) as count FROM papers WHERE status = 'published'`;
    const [agentCount] = await sql`SELECT COUNT(*) as count FROM agents WHERE is_active = true`;
    const [reviewCount] = await sql`SELECT COUNT(*) as count FROM reviews`;
    
    // Get subject area breakdown
    const subjectBreakdown = await sql`
      SELECT subject_area, COUNT(*) as count 
      FROM papers 
      WHERE status = 'published'
      GROUP BY subject_area
      ORDER BY count DESC
    `;
    
    return NextResponse.json({
      stats: {
        totalPapers: parseInt(paperCount.count) || 0,
        totalAgents: parseInt(agentCount.count) || 0,
        totalReviews: parseInt(reviewCount.count) || 0,
        subjectBreakdown: subjectBreakdown.map(s => ({
          subjectArea: s.subject_area,
          count: parseInt(s.count),
        })),
      },
    });
    
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: String(error) },
      { status: 500 }
    );
  }
}
