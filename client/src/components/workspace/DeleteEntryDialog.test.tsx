import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IFileTreeNode } from 'shared';
import { DeleteEntryDialog } from './DeleteEntryDialog';

function buildNode(overrides: Partial<IFileTreeNode> = {}): IFileTreeNode {
  return {
    id: 'f1',
    project: 'p1',
    owner: 'u1',
    name: 'Navbar.tsx',
    path: 'src/Navbar.tsx',
    type: 'file',
    parentPath: 'src',
    size: 10,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('DeleteEntryDialog', () => {
  it('renders nothing when node is null', () => {
    render(<DeleteEntryDialog node={null} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows the file name and a file-specific warning', () => {
    render(<DeleteEntryDialog node={buildNode()} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /navbar\.tsx/i })).toBeInTheDocument();
    expect(screen.getByText(/permanently deletes the file/i)).toBeInTheDocument();
  });

  it('shows a folder-specific warning for folders', () => {
    render(
      <DeleteEntryDialog
        node={buildNode({ name: 'components', path: 'src/components', type: 'folder' })}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(screen.getByText(/everything inside it/i)).toBeInTheDocument();
  });

  it('calls onConfirm when Delete is clicked', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<DeleteEntryDialog node={buildNode()} onOpenChange={vi.fn()} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
