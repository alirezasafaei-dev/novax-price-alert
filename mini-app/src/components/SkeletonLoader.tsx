import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
      className={`bg-slate-800 rounded-lg ${className}`}
    />
  );
}

export function PriceCardSkeleton() {
  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-6 w-20 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
    </div>
  );
}

export function PriceBoardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Main price card skeleton */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6">
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48 rounded" />
              <Skeleton className="h-4 w-32 rounded" />
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-8 w-32 rounded" />
              <Skeleton className="h-6 w-24 rounded" />
            </div>
          </div>
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>

      {/* Price list skeleton */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <PriceCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function AlertCardSkeleton() {
  return (
    <div className="bg-slate-950/40 border border-slate-800 p-4 rounded-xl">
      <div className="flex items-start gap-3">
        <Skeleton className="w-9 h-9 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
        <Skeleton className="h-8 w-20 rounded" />
      </div>
    </div>
  );
}