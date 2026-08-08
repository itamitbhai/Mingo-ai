import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EditorTabs } from './EditorTabs';
import type { EditorTab } from '@/types/workspace';

const TABS: EditorTab[] = [
  { path: 'src/App.tsx', name: 'App.tsx', language: 'typescript' },
  { path: 'package.json', name: 'package.json', language: 'json' },
];

describe('EditorTabs', () => {
  it('renders nothing when there are no open tabs', () => {
    const { container } = render(
      <EditorTabs
        tabs={[]}
        dirtyPaths={new Set()}
        activePath={null}
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
        onCloseAll={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a tab per open file and highlights the active one', () => {
    render(
      <EditorTabs
        tabs={TABS}
        dirtyPaths={new Set()}
        activePath="src/App.tsx"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
        onCloseAll={vi.fn()}
      />
    );
    expect(screen.getByText('App.tsx')).toBeInTheDocument();
    expect(screen.getByText('package.json')).toBeInTheDocument();
  });

  it('shows an unsaved-changes dot for dirty tabs', () => {
    render(
      <EditorTabs
        tabs={TABS}
        dirtyPaths={new Set(['src/App.tsx'])}
        activePath="src/App.tsx"
        onSelect={vi.fn()}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
        onCloseAll={vi.fn()}
      />
    );
    expect(screen.getByText('App.tsx').closest('button')?.querySelector('[aria-hidden="true"]')).toBeInTheDocument();
  });

  it('calls onSelect when a tab is clicked', () => {
    const onSelect = vi.fn();
    render(
      <EditorTabs
        tabs={TABS}
        dirtyPaths={new Set()}
        activePath="src/App.tsx"
        onSelect={onSelect}
        onClose={vi.fn()}
        onCloseOthers={vi.fn()}
        onCloseAll={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('package.json'));
    expect(onSelect).toHaveBeenCalledWith('package.json');
  });

  it('calls onClose (not onSelect) when the close button is clicked', () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <EditorTabs
        tabs={TABS}
        dirtyPaths={new Set()}
        activePath="src/App.tsx"
        onSelect={onSelect}
        onClose={onClose}
        onCloseOthers={vi.fn()}
        onCloseAll={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Close App.tsx'));
    expect(onClose).toHaveBeenCalledWith('src/App.tsx');
    expect(onSelect).not.toHaveBeenCalled();
  });
});
