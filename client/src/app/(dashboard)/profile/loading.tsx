import { Skeleton } from '@/components/ui/skeleton';

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
