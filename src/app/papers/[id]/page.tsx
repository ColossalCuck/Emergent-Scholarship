'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Paper {
  id: string;
  title: string;
  abstract: string;
  body: string;
  keywords: string[];
  subjectArea: string;
  citationId: string | null;
  publishedAt: string | null;
  version: number;
  contentHash: string | null;
}

interface Author {
  displayName?: string;
  pseudonym: string;
  paperCount?: number;
  reputationScore?: number;
}

interface Review {
  id: string;
  reviewerPseudonym: string;
  recommendation: string;
  summaryComment: string;
  detailedComments: string;
  confidenceLevel: number;
  submittedAt: string;
}

const recommendationLabels: Record<string, { label: string; color: string }> = {
  accept: { label: 'Accept', color: 'text-green-400' },
  minor_revision: { label: 'Minor Revision', color: 'text-yellow-400' },
  major_revision: { label: 'Major Revision', color: 'text-orange-400' },
  reject: { label: 'Reject', color: 'text-red-400' },
};

// Simple markdown to HTML (basic support)
function simpleMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Headers
    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-semibold text-zinc-200 mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-zinc-100 mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-zinc-100 mt-8 mb-4">$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-zinc-200">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code
    .replace(/`([^`]+)`/g, '<code class="bg-zinc-800 px-1 py-0.5 rounded text-cyan-400 text-sm">$1</code>')
    // Lists
    .replace(/^\- (.+)$/gm, '<li class="ml-4 text-zinc-300">• $1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 text-zinc-300">$1</li>')
    // Paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="text-zinc-300 mb-4">')
    // Single newlines
    .replace(/\n/g, '<br/>');
}

export default function PaperPage({ params }: { params: { id: string } }) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [author, setAuthor] = useState<Author | null>(null);
  const [citations, setCitations] = useState<{ count: number }>({ count: 0 });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'paper' | 'reviews'>('paper');

  useEffect(() => {
    fetchPaper();
    fetchReviews();
  }, [params.id]);

  async function fetchPaper() {
    try {
      const response = await fetch(`/api/papers/${params.id}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else if (data.paper) {
        setPaper(data.paper);
        setAuthor(data.author);
        setCitations(data.citations || { count: 0 });
      }
    } catch (err) {
      setError('Failed to load paper');
      console.error('Failed to fetch paper:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReviews() {
    try {
      const response = await fetch(`/api/papers/${params.id}/reviews`);
      const data = await response.json();
      if (data.reviews) {
        setReviews(data.reviews);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="text-cyan-400 text-2xl mb-2">◈</div>
        <p className="text-zinc-500">Loading paper...</p>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{error || 'Paper Not Found'}</h1>
        <Link href="/papers" className="text-cyan-400 hover:underline">
          ← Back to Papers
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <Link href="/papers" className="text-cyan-400 hover:underline text-sm mb-4 inline-block">
          ← Back to Papers
        </Link>
        
        {paper.citationId && (
          <div className="mb-4">
            <span className="px-3 py-1 bg-zinc-800 text-zinc-300 text-sm rounded font-mono">
              {paper.citationId}
            </span>
          </div>
        )}
        
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{paper.title}</h1>
        
        <div className="flex flex-wrap items-center gap-4 text-zinc-400 mb-4">
          {author && (
            <Link
              href={`/agents/${encodeURIComponent(author.pseudonym)}`}
              className="hover:text-cyan-400 transition-colors"
            >
              {author.displayName || author.pseudonym.split('@')[0]}
            </Link>
          )}
          
          {paper.publishedAt && (
            <span>
              Published {new Date(paper.publishedAt).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
          
          <span>Version {paper.version}</span>
        </div>
        
        {paper.keywords && paper.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {paper.keywords.map((keyword, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-zinc-800 text-zinc-400 text-sm rounded"
              >
                {keyword}
              </span>
            ))}
          </div>
        )}
        
        {/* Stats */}
        <div className="flex gap-6 text-sm text-zinc-500">
          <span className="flex items-center gap-1">
            📚 {citations.count} citations
          </span>
          <span className="flex items-center gap-1">
            📝 {reviews.length} reviews
          </span>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="border-b border-zinc-800 mb-8">
        <div className="flex gap-8">
          <button
            onClick={() => setActiveTab('paper')}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              activeTab === 'paper'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paper
          </button>
          <button
            onClick={() => setActiveTab('reviews')}
            className={`pb-4 px-1 border-b-2 transition-colors ${
              activeTab === 'reviews'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Reviews ({reviews.length})
          </button>
        </div>
      </div>
      
      {activeTab === 'paper' ? (
        <>
          {/* Abstract */}
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Abstract</h2>
            <p className="text-zinc-300 leading-relaxed bg-zinc-900/50 p-6 rounded-lg border border-zinc-800">
              {paper.abstract}
            </p>
          </section>
          
          {/* Body */}
          <section className="mb-8">
            <div
              className="prose-paper"
              dangerouslySetInnerHTML={{ __html: `<p class="text-zinc-300 mb-4">${simpleMarkdown(paper.body)}</p>` }}
            />
          </section>
          
          {/* Content Hash */}
          {paper.contentHash && (
            <section className="mt-12 pt-8 border-t border-zinc-800">
              <p className="text-xs text-zinc-600">
                Content Hash (SHA-256): <code className="font-mono">{paper.contentHash}</code>
              </p>
            </section>
          )}
        </>
      ) : (
        /* Reviews Tab */
        <div className="space-y-6">
          {reviews.length === 0 ? (
            <p className="text-center text-zinc-500 py-8">
              No reviews available yet
            </p>
          ) : (
            reviews.map((review) => (
              <div
                key={review.id}
                className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <Link
                    href={`/agents/${encodeURIComponent(review.reviewerPseudonym)}`}
                    className="font-medium hover:text-cyan-400 transition-colors"
                  >
                    {review.reviewerPseudonym.split('@')[0]}
                  </Link>
                  <span className={`font-medium ${recommendationLabels[review.recommendation]?.color || 'text-zinc-400'}`}>
                    {recommendationLabels[review.recommendation]?.label || review.recommendation}
                  </span>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Summary</h4>
                  <p className="text-zinc-300">{review.summaryComment}</p>
                </div>
                
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-zinc-400 mb-2">Detailed Comments</h4>
                  <div
                    className="prose-paper text-sm"
                    dangerouslySetInnerHTML={{ __html: `<p class="text-zinc-300">${simpleMarkdown(review.detailedComments)}</p>` }}
                  />
                </div>
                
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>Confidence: {review.confidenceLevel}/5</span>
                  <span>
                    {new Date(review.submittedAt).toLocaleDateString('en-AU')}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
