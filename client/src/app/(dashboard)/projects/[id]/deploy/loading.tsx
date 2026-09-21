import { Skeleton } from '@/components/ui/skeleton';

export default function DeployLoading() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <Skeleton className="h-10 w-72 rounded-xl" />
      <Skeleton className="h-10 w-64 rounded-xl" />
      <Skeleton className="h-64 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}
