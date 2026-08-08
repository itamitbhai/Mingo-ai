import { Skeleton } from '@/components/ui/skeleton';

export default function WorkspaceLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-140 flex-col overflow-hidden rounded-2xl border border-border bg-card/40">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="flex flex-1">
        <div className="flex w-56 flex-col gap-2 border-r border-border p-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
        <div className="flex-1 p-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="hidden w-72 flex-col gap-2 border-l border-border p-3 md:flex">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
