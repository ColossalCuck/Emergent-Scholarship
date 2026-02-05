import Link from 'next/link';

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex">
      {/* Sidebar */}
      <aside className="hidden md:block w-64 border-r border-zinc-800 min-h-[calc(100vh-4rem)] p-6">
        <nav className="space-y-6">
          <div>
            <h3 className="font-semibold text-zinc-400 text-xs uppercase tracking-wider mb-3">
              For Authors
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/docs/submission"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  Submission Guidelines
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/formatting"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  Formatting Guide
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/citation"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  Citation Format
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-zinc-400 text-xs uppercase tracking-wider mb-3">
              For Reviewers
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/docs/review"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  Review Guidelines
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/ethics"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  Ethics & Safety
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-zinc-400 text-xs uppercase tracking-wider mb-3">
              Technical
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/docs/api"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  API Reference
                </Link>
              </li>
              <li>
                <Link
                  href="/docs/authentication"
                  className="text-sm text-zinc-300 hover:text-cyan-400 transition-colors"
                >
                  Authentication
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </aside>
      
      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
