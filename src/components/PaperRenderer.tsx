'use client';

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface PaperRendererProps {
  title: string;
  abstract: string;
  body: string;
  keywords: string[];
  references: string[];
  citationId: string | null;
  author: string;
  publishedAt: string | null;
  version: number;
}

export function PaperRenderer({
  title,
  abstract,
  body,
  keywords,
  references,
  citationId,
  author,
  publishedAt,
  version,
}: PaperRendererProps) {
  function renderMarkdown(content: string) {
    const html = marked(content, { async: false }) as string;
    return DOMPurify.sanitize(html);
  }

  return (
    <article className="max-w-none">
      {/* Paper Header */}
      <header className="mb-12 pb-8 border-b border-zinc-800">
        {citationId && (
          <div className="mb-4">
            <span className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-sm rounded-lg font-mono">
              {citationId}
            </span>
            <span className="text-zinc-600 text-sm ml-3">v{version}</span>
          </div>
        )}
        
        <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight mb-6">
          {title}
        </h1>
        
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-zinc-400 mb-6">
          <span className="font-medium">{author.split('@')[0]}</span>
          {publishedAt && (
            <span>
              Published {new Date(publishedAt).toLocaleDateString('en-AU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword) => (
            <span
              key={keyword}
              className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-sm rounded-full border border-cyan-500/20"
            >
              {keyword}
            </span>
          ))}
        </div>
      </header>
      
      {/* Abstract */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-4">
          Abstract
        </h2>
        <div className="bg-zinc-900/50 border-l-4 border-cyan-500 pl-6 py-4 pr-4 rounded-r-lg">
          <p className="text-zinc-300 leading-relaxed text-lg">
            {abstract}
          </p>
        </div>
      </section>
      
      {/* Main Content */}
      <section className="paper-content mb-12">
        <div 
          className="prose prose-invert prose-zinc max-w-none
            prose-headings:text-zinc-100 prose-headings:font-semibold
            prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:pb-2 prose-h2:border-b prose-h2:border-zinc-800
            prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4
            prose-h4:text-lg prose-h4:mt-6 prose-h4:mb-3
            prose-p:text-zinc-300 prose-p:leading-relaxed prose-p:mb-6
            prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-zinc-200
            prose-code:text-cyan-400 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800 prose-pre:rounded-xl
            prose-blockquote:border-cyan-500 prose-blockquote:bg-zinc-900/50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg prose-blockquote:not-italic
            prose-ul:text-zinc-300 prose-ol:text-zinc-300
            prose-li:marker:text-cyan-500
            prose-hr:border-zinc-800
            prose-table:border-zinc-800
            prose-th:bg-zinc-900 prose-th:text-zinc-200 prose-th:p-3
            prose-td:p-3 prose-td:border-zinc-800"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      </section>
      
      {/* References */}
      {references.length > 0 && (
        <section className="mb-12 pt-8 border-t border-zinc-800">
          <h2 className="text-sm font-semibold text-cyan-400 uppercase tracking-wider mb-6">
            References
          </h2>
          <ol className="space-y-4">
            {references.map((ref, index) => (
              <li 
                key={index}
                className="flex gap-4 text-zinc-400 text-sm leading-relaxed"
              >
                <span className="text-zinc-600 font-mono flex-shrink-0">
                  [{index + 1}]
                </span>
                <span>{ref}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

// BibTeX export component
export function BibTeXExport({
  citationId,
  title,
  author,
  publishedAt,
  keywords,
}: {
  citationId: string;
  title: string;
  author: string;
  publishedAt: string;
  keywords: string[];
}) {
  const year = new Date(publishedAt).getFullYear();
  const month = new Date(publishedAt).toLocaleString('en', { month: 'short' }).toLowerCase();
  const authorName = author.split('@')[0];
  const key = `${authorName.toLowerCase()}${year}${title.split(' ')[0].toLowerCase()}`;
  
  const bibtex = `@article{${key},
  title = {${title}},
  author = {${authorName}},
  journal = {Emergent Scholarship},
  year = {${year}},
  month = {${month}},
  note = {${citationId}},
  keywords = {${keywords.join(', ')}},
  url = {https://emergent-scholarship.org/papers/${citationId}}
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bibtex);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-zinc-400">BibTeX Citation</h4>
        <button
          onClick={copyToClipboard}
          className="text-xs px-3 py-1 bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors"
        >
          Copy
        </button>
      </div>
      <pre className="text-xs text-zinc-500 overflow-x-auto whitespace-pre-wrap font-mono">
        {bibtex}
      </pre>
    </div>
  );
}
