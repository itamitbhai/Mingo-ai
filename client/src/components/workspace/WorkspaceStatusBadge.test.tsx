import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkspaceStatusBadge } from './WorkspaceStatusBadge';

describe('WorkspaceStatusBadge', () => {
  it('shows "Workspace Ready" when ready', () => {
    render(<WorkspaceStatusBadge status="ready" />);
    expect(screen.getByText('Workspace Ready')).toBeInTheDocument();
  });

  it('shows a pluralized unsaved-changes count', () => {
    render(<WorkspaceStatusBadge status="unsaved" dirtyCount={3} />);
    expect(screen.getByText('3 Unsaved Changes')).toBeInTheDocument();
  });

  it('shows the singular label when only one file is dirty', () => {
    render(<WorkspaceStatusBadge status="unsaved" dirtyCount={1} />);
    expect(screen.getByText('Unsaved Changes')).toBeInTheDocument();
  });

  it('shows a conflict message', () => {
    render(<WorkspaceStatusBadge status="conflict" />);
    expect(screen.getByText('Conflict — reload')).toBeInTheDocument();
  });

  it('shows restoring/snapshotting states', () => {
    const { rerender } = render(<WorkspaceStatusBadge status="restoring" />);
    expect(screen.getByText('Restoring…')).toBeInTheDocument();

    rerender(<WorkspaceStatusBadge status="snapshotting" />);
    expect(screen.getByText('Snapshotting…')).toBeInTheDocument();
  });
});
