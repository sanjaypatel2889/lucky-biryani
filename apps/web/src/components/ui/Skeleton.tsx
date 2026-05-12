'use client';

// Shimmer-loading placeholders. Use in place of "Loading…" text.
//
//   <Skeleton className="h-4 w-32" />
//   <SkeletonCard />  // shaped like a menu card

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer ${className}`} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="card flex gap-4 p-4">
      <Skeleton className="h-32 w-32 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <div className="mt-auto flex items-center justify-between">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton className="h-3 w-1/4" />
      <Skeleton className="h-3 flex-1" />
      <Skeleton className="h-3 w-12" />
    </div>
  );
}
