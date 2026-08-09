import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const getActivityMock = vi.fn();

vi.mock('@/services/workspace/workspace.service', () => ({
  getActivity: (...args: unknown[]) => getActivityMock(...args),
}));

import { useWorkspaceStore } from '@/store/use-workspace-store';
import { HistoryPanel } from './HistoryPanel';

describe('HistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.getState().reset();
  });

  it('groups activity under a TODAY heading and loads more on demand', async () => {
    getActivityMock.mockResolvedValueOnce({
      items: [{ id: 'a1', description: 'Updated App.tsx', createdAt: new Date().toISOString() }],
      hasMore: true,
      nextCursor: 'a1',
    });

    render(<HistoryPanel projectId="p1" open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Updated App.tsx')).toBeInTheDocument());
    expect(screen.getByText('TODAY')).toBeInTheDocument();
    expect(getActivityMock).toHaveBeenCalledWith('p1', 'test-token', null);

    getActivityMock.mockResolvedValueOnce({
      items: [{ id: 'a2', description: 'Created auth.service.ts', createdAt: new Date().toISOString() }],
      hasMore: false,
      nextCursor: null,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getByText('Created auth.service.ts')).toBeInTheDocument());
    expect(getActivityMock).toHaveBeenLastCalledWith('p1', 'test-token', 'a1');
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('shows an empty state when there is no activity', async () => {
    getActivityMock.mockResolvedValueOnce({ items: [], hasMore: false, nextCursor: null });

    render(<HistoryPanel projectId="p1" open onOpenChange={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('No activity yet.')).toBeInTheDocument());
  });
});
