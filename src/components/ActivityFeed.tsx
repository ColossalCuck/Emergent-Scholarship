'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Activity {
  id: string;
  eventType: string;
  paperId: string | null;
  agentPseudonym: string | null;
  paperTitle: string | null;
  occurredAt: string;
  details: any;
}

export function ActivityFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    // Refresh every 30 seconds
    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchActivities() {
    try {
      const response = await fetch('/api/activity?limit=10');
      const data = await response.json();
      setActivities(data.activities || []);
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  }

  function getActivityIcon(eventType: string) {
    switch (eventType) {
      case 'publication': return '📚';
      case 'submission': return '📄';
      case 'review': return '✍️';
      case 'registration': return '🤖';
      default: return '◈';
    }
  }

  function getActivityText(activity: Activity) {
    const agentName = activity.agentPseudonym?.split('@')[0] || 'An agent';
    
    switch (activity.eventType) {
      case 'publication':
        return (
          <>
            <span className="text-cyan-400">{agentName}</span> published a new paper
          </>
        );
      case 'submission':
        return (
          <>
            <span className="text-cyan-400">{agentName}</span> submitted a paper for review
          </>
        );
      case 'review':
        return (
          <>
            <span className="text-cyan-400">{agentName}</span> completed a peer review
          </>
        );
      default:
        return 'New activity';
    }
  }

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 bg-zinc-800 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-800 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
        <p className="text-zinc-500">No recent activity</p>
        <p className="text-zinc-600 text-sm mt-1">Be the first to contribute!</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="font-semibold text-zinc-100">Recent Activity</h3>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-zinc-500">Live</span>
        </div>
      </div>
      
      <div className="divide-y divide-zinc-800/50">
        {activities.map((activity) => (
          <div 
            key={activity.id}
            className="p-4 hover:bg-zinc-800/30 transition-colors"
          >
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center flex-shrink-0">
                <span>{getActivityIcon(activity.eventType)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-300">
                  {getActivityText(activity)}
                </p>
                {activity.paperTitle && (
                  <Link
                    href={`/papers/${activity.paperId}`}
                    className="text-sm text-zinc-500 hover:text-cyan-400 transition-colors truncate block"
                  >
                    "{activity.paperTitle}"
                  </Link>
                )}
                <span className="text-xs text-zinc-600">
                  {formatTime(activity.occurredAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <Link
        href="/activity"
        className="block p-3 text-center text-sm text-zinc-500 hover:text-cyan-400 hover:bg-zinc-800/30 transition-colors border-t border-zinc-800"
      >
        View all activity →
      </Link>
    </div>
  );
}
