import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}));

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const listSnapshotsMock = vi.fn();
const createSnapshotMock = vi.fn();
const restoreSnapshotMock = vi.fn();

vi.mock('@/services/workspace/workspace.service', () => ({
  listSnapshots: (...args: unknown[]) => listSnapshotsMock(...args),
  createSnapshot: (...args: unknown[]) => createSnapshotMock(...args),
  restoreSnapshot: (...args: unknown[]) => restoreSnapshotMock(...args),
}));

import { useWorkspaceStore } from '@/store/use-workspace-store';
import { SnapshotPanel } from './SnapshotPanel';

describe('SnapshotPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.getState().reset();
    listSnapshotsMock.mockResolvedValue({
      items: [
        { id: 's1', name: 'Initial', description: undefined, fileCount: 2, createdAt: new Date().toISOString() },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
    });
  });

  it('loads and displays snapshots when opened', async () => {
    render(
      <SnapshotPanel projectId="p1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />
    );

    await waitFor(() => expect(screen.getByText('Initial')).toBeInTheDocument());
    expect(listSnapshotsMock).toHaveBeenCalledWith('p1', 'test-token');
  });

  it('disables Create Snapshot until a name is entered', async () => {
    render(<SnapshotPanel projectId="p1" open onOpenChange={vi.fn()} onRestored={vi.fn()} />);
    await waitFor(() => expect(listSnapshotsMock).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: 'Create Snapshot' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Snapshot name'), { target: { value: 'Before refactor' } });
    expect(screen.getByRole('button', { name: 'Create Snapshot' })).not.toBeDisabled();
  });

  it('restores a snapshot after confirming', async () => {
    restoreSnapshotMock.mockResolvedValue({
      snapshot: { id: 's1', name: 'Initial' },
      backup: { id: 's2', name: 'Automatic backup' },
    });
    const onRestored = vi.fn();

    render(<SnapshotPanel projectId="p1" open onOpenChange={vi.fn()} onRestored={onRestored} />);
    await waitFor(() => expect(screen.getByText('Initial')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(screen.getByText(/backed up automatically/i)).toBeInTheDocument();

    const confirmButtons = screen.getAllByRole('button', { name: 'Restore' });
    await act(async () => {
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() => expect(restoreSnapshotMock).toHaveBeenCalledWith('p1', 's1', 'test-token'));
    await waitFor(() => expect(onRestored).toHaveBeenCalled());
  });
});
