import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IFileTreeNode } from 'shared';
import { FileTreeNode, type FileTreeActions } from './FileTreeNode';

function buildActions(overrides: Partial<FileTreeActions> = {}): FileTreeActions {
  return {
    onOpenFile: vi.fn(),
    onToggleFolder: vi.fn(),
    onCreate: vi.fn(),
    onRename: vi.fn(),
    onMove: vi.fn(),
    onDelete: vi.fn(),
    onCopyPath: vi.fn(),
    onAskAI: vi.fn(),
    ...overrides,
  };
}

function buildNode(overrides: Partial<IFileTreeNode> = {}): IFileTreeNode {
  return {
    id: 'f1',
    project: 'p1',
    owner: 'u1',
    name: 'App.tsx',
    path: 'src/App.tsx',
    type: 'file',
    language: 'typescript',
    parentPath: 'src',
    size: 10,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('FileTreeNode', () => {
  it('calls onOpenFile when a file row is clicked', () => {
    const actions = buildActions();
    const node = buildNode();
    render(<FileTreeNode node={node} depth={0} activePath={null} expandedFolders={[]} {...actions} />);

    fireEvent.click(screen.getByText('App.tsx'));

    expect(actions.onOpenFile).toHaveBeenCalledWith(node);
  });

  it('calls onToggleFolder (not onOpenFile) when a folder row is clicked', () => {
    const actions = buildActions();
    const node = buildNode({
      id: 'd1',
      name: 'components',
      path: 'src/components',
      type: 'folder',
      children: [],
    });
    render(<FileTreeNode node={node} depth={0} activePath={null} expandedFolders={[]} {...actions} />);

    fireEvent.click(screen.getByText('components'));

    expect(actions.onToggleFolder).toHaveBeenCalledWith('src/components');
    expect(actions.onOpenFile).not.toHaveBeenCalled();
  });

  it('renders nested children only when the folder is expanded', () => {
    const actions = buildActions();
    const child = buildNode({ id: 'c1', name: 'Button.tsx', path: 'src/components/Button.tsx' });
    const folder = buildNode({
      id: 'd1',
      name: 'components',
      path: 'src/components',
      type: 'folder',
      children: [child],
    });

    const { rerender } = render(
      <FileTreeNode node={folder} depth={0} activePath={null} expandedFolders={[]} {...actions} />
    );
    expect(screen.queryByText('Button.tsx')).not.toBeInTheDocument();

    rerender(
      <FileTreeNode node={folder} depth={0} activePath={null} expandedFolders={['src/components']} {...actions} />
    );
    expect(screen.getByText('Button.tsx')).toBeInTheDocument();
  });

  it('applies the active style when activePath matches this node', () => {
    const actions = buildActions();
    const node = buildNode();
    render(<FileTreeNode node={node} depth={0} activePath="src/App.tsx" expandedFolders={[]} {...actions} />);

    expect(screen.getByText('App.tsx').closest('button')).toHaveClass('bg-accent');
  });
});
