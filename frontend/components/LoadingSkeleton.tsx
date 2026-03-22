interface LoadingSkeletonProps {
  count?: number;
  type?: 'card' | 'event';
}

function SkeletonCard() {
  return (
    <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="h-5 bg-gray-700 rounded w-1/3" />
        <div className="h-5 bg-gray-700 rounded w-16" />
      </div>
      <div className="h-4 bg-gray-800 rounded w-1/4 mb-3" />
      <div className="h-2 bg-gray-800 rounded-full w-full mb-4" />
      <div className="flex gap-4">
        <div className="h-4 bg-gray-800 rounded w-20" />
        <div className="h-4 bg-gray-800 rounded w-16" />
        <div className="h-4 bg-gray-800 rounded w-14" />
      </div>
    </div>
  );
}

function SkeletonEvent() {
  return (
    <div className="flex gap-4 animate-pulse">
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-gray-700 mt-1" />
        <div className="w-0.5 flex-1 bg-gray-800 mt-1" />
      </div>
      <div className="flex-1 bg-[#12121a] border border-gray-800 rounded-xl p-4 mb-4">
        <div className="flex gap-3 items-center mb-2">
          <div className="h-5 bg-gray-700 rounded-full w-24" />
          <div className="h-4 bg-gray-800 rounded w-32" />
        </div>
        <div className="h-4 bg-gray-800 rounded w-2/3" />
      </div>
    </div>
  );
}

export default function LoadingSkeleton({ count = 3, type = 'card' }: LoadingSkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) =>
        type === 'card' ? <SkeletonCard key={i} /> : <SkeletonEvent key={i} />
      )}
    </div>
  );
}
