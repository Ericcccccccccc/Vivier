import { Skeleton } from '@/components/ui/skeleton';

export function EmailListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <div className="flex items-start justify-between mb-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
    </div>
  );
}

export function EmailDetailSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="h-full flex">
      <div className="w-96 border-r p-4">
        <Skeleton className="h-10 w-full mb-4" />
        <EmailListSkeleton />
      </div>
      <div className="flex-1">
        <EmailDetailSkeleton />
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full max-w-md" />
        </div>
      </div>
      <Skeleton className="h-10 w-32" />
    </div>
  );
}