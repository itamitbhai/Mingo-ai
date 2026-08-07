import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from 'shared';

import { Button } from '@/components/ui/button';

export function PaginationControls({
  pagination,
  basePath,
  searchParams,
  itemLabel = 'item',
}: {
  pagination: PaginationMeta;
  basePath: string;
  searchParams: Record<string, string | undefined>;
  itemLabel?: string;
}) {
  if (pagination.totalPages <= 1) {
    return null;
  }

  const buildHref = (page: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    params.set('page', String(page));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <p className="text-sm text-muted-foreground">
        Page {pagination.page} of {pagination.totalPages} &middot; {pagination.total} {itemLabel}
        {pagination.total === 1 ? '' : 's'}
      </p>
      <div className="flex items-center gap-2">
        {pagination.hasPrevPage ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildHref(pagination.page - 1)} aria-label="Previous page">
              <ChevronLeft className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </Button>
        )}
        {pagination.hasNextPage ? (
          <Button variant="outline" size="icon" asChild>
            <Link href={buildHref(pagination.page + 1)} aria-label="Next page">
              <ChevronRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="Next page">
            <ChevronRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
