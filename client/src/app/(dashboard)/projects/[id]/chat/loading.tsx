import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="flex h-[calc(100vh-11rem)] min-h-140 overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="hidden w-72 shrink-0 flex-col gap-2 border-r border-border p-3 md:flex">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="border-b border-border p-4">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="ml-auto h-12 w-1/2" />
          <Skeleton className="h-20 w-3/4" />
        </div>
      </div>
    </div>
  );
}
