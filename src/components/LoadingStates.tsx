'use client';

export function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
          <span className="relative text-cyan-400 text-6xl animate-pulse">◈</span>
        </div>
        <p className="text-zinc-500 mt-4 animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 animate-pulse">
      <div className="flex gap-2 mb-4">
        <div className="h-6 w-24 bg-zinc-800 rounded" />
        <div className="h-6 w-20 bg-zinc-800 rounded" />
      </div>
      <div className="h-7 w-3/4 bg-zinc-800 rounded mb-3" />
      <div className="space-y-2 mb-4">
        <div className="h-4 w-full bg-zinc-800 rounded" />
        <div className="h-4 w-full bg-zinc-800 rounded" />
        <div className="h-4 w-2/3 bg-zinc-800 rounded" />
      </div>
      <div className="flex gap-4">
        <div className="h-4 w-24 bg-zinc-800 rounded" />
        <div className="h-4 w-20 bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden animate-pulse">
      <div className="p-4 border-b border-zinc-800 flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-5 w-24 bg-zinc-800 rounded" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="p-4 border-b border-zinc-800/50 flex gap-4">
          <div className="h-5 w-8 bg-zinc-800 rounded" />
          <div className="h-5 w-32 bg-zinc-800 rounded" />
          <div className="h-5 w-20 bg-zinc-800 rounded" />
          <div className="h-5 w-16 bg-zinc-800 rounded" />
        </div>
      ))}
    </div>
  );
}

export function InlineLoader() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1 h-1 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </span>
  );
}

export function ErrorState({ 
  title = 'Something went wrong',
  message = 'Please try again later',
  retry,
}: { 
  title?: string;
  message?: string;
  retry?: () => void;
}) {
  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
        <span className="text-2xl">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h3>
      <p className="text-zinc-500 mb-4">{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title = 'Nothing here yet',
  message = '',
  action,
  actionLabel = 'Get Started',
}: {
  icon?: string;
  title?: string;
  message?: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
      <span className="text-4xl mb-4 block">{icon}</span>
      <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h3>
      {message && <p className="text-zinc-500 mb-4">{message}</p>}
      {action && (
        <button
          onClick={action}
          className="px-4 py-2 bg-cyan-500 text-zinc-950 rounded-lg hover:bg-cyan-400 transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function SuccessToast({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 right-4 bg-green-500/90 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 animate-slide-up">
      <span>✓</span>
      <span>{message}</span>
    </div>
  );
}

export function Badge({ 
  children, 
  variant = 'default' 
}: { 
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}) {
  const variants = {
    default: 'bg-zinc-800 text-zinc-300',
    success: 'bg-green-500/20 text-green-400 border border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
  };
  
  return (
    <span className={`px-2 py-1 text-xs rounded-md font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function ProgressBar({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  
  return (
    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
      <div 
        className="h-full bg-gradient-to-r from-cyan-500 to-cyan-400 rounded-full transition-all duration-500"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
