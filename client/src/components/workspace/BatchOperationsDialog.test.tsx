import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn().mockResolvedValue('test-token') }),
}));

const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastError(...args), success: vi.fn() } }));

const previewOperationsMock = vi.fn();
const applyBatchMock = vi.fn();

vi.mock('@/services/workspace/workspace.service', () => ({
  previewOperations: (...args: unknown[]) => previewOperationsMock(...args),
  applyBatch: (...args: unknown[]) => applyBatchMock(...args),
}));

import { useWorkspaceStore } from '@/store/use-workspace-store';
import { BatchOperationsDialog } from './BatchOperationsDialog';

const VALID_OPS = '[{"type":"create","path":"a.ts","content":"x"}]';

describe('BatchOperationsDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWorkspaceStore.getState().reset();
  });

  it('shows a toast and skips preview for invalid JSON', async () => {
    render(<BatchOperationsDialog projectId="p1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/create/i), { target: { value: 'not json' } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    expect(toastError).toHaveBeenCalled();
    expect(previewOperationsMock).not.toHaveBeenCalled();
  });

  it('previews operations and disables Apply until the plan is valid', async () => {
    previewOperationsMock.mockResolvedValue({
      valid: false,
      operations: [{ type: 'create', path: 'a.ts', action: 'CREATE' }],
      warnings: [],
      errors: [],
      conflicts: ['"a.ts" already exists'],
    });

    render(<BatchOperationsDialog projectId="p1" open onOpenChange={vi.fn()} onApplied={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/create/i), { target: { value: VALID_OPS } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => expect(screen.getByText('CREATE')).toBeInTheDocument());
    expect(screen.getByText('"a.ts" already exists')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
  });

  it('applies a valid batch and calls onApplied', async () => {
    previewOperationsMock.mockResolvedValue({
      valid: true,
      operations: [{ type: 'create', path: 'a.ts', action: 'CREATE' }],
      warnings: [],
      errors: [],
      conflicts: [],
    });
    applyBatchMock.mockResolvedValue({ applied: 1, operations: [] });
    const onApplied = vi.fn();

    render(<BatchOperationsDialog projectId="p1" open onOpenChange={vi.fn()} onApplied={onApplied} />);
    fireEvent.change(screen.getByPlaceholderText(/create/i), { target: { value: VALID_OPS } });
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(applyBatchMock).toHaveBeenCalledWith('p1', { operations: JSON.parse(VALID_OPS) }, 'test-token'));
    await waitFor(() => expect(onApplied).toHaveBeenCalled());
  });
});
