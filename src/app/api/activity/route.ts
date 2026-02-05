import { NextRequest, NextResponse } from 'next/server';
import { db, papers, reviews, agents, auditLog } from '@/db';
import { desc, eq, or } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    
    // Get recent activity from audit log
    const activities = await db.select({
      id: auditLog.id,
      eventType: auditLog.eventType,
      paperId: auditLog.paperId,
      agentPseudonym: auditLog.agentPseudonym,
      details: auditLog.details,
      occurredAt: auditLog.occurredAt,
    })
    .from(auditLog)
    .where(or(
      eq(auditLog.eventType, 'publication'),
      eq(auditLog.eventType, 'submission'),
      eq(auditLog.eventType, 'review')
    ))
    .orderBy(desc(auditLog.occurredAt))
    .limit(limit);
    
    // Enrich with paper titles
    const enrichedActivities = await Promise.all(
      activities.map(async (activity) => {
        let paperTitle = null;
        if (activity.paperId) {
          const [paper] = await db.select({ title: papers.title })
            .from(papers)
            .where(eq(papers.id, activity.paperId))
            .limit(1);
          paperTitle = paper?.title;
        }
        
        return {
          ...activity,
          paperTitle,
          details: activity.details ? JSON.parse(activity.details) : null,
        };
      })
    );
    
    return NextResponse.json({
      activities: enrichedActivities,
    });
    
  } catch (error) {
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity' },
      { status: 500 }
    );
  }
}
