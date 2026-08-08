import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CommandPalette } from './CommandPalette';

function renderPalette() {
  const handlers = {
    onOpenChange: vi.fn(),
    onNewFile: vi.fn(),
    onNewFolder: vi.fn(),
    onSave: vi.fn(),
    onCloseFile: vi.fn(),
    onCloseAllTabs: vi.fn(),
    onSearchFiles: vi.fn(),
    onSearchWorkspace: vi.fn(),
    onToggleSidebar: vi.fn(),
    onToggleAIChat: vi.fn(),
    onToggleBottomPanel: vi.fn(),
    onFormatDocument: vi.fn(),
  };
  render(<CommandPalette open {...handlers} />);
  return handlers;
}

describe('CommandPalette', () => {
  it('lists the available commands when open', () => {
    renderPalette();
    expect(screen.getByText('New File')).toBeInTheDocument();
    expect(screen.getByText('Save File')).toBeInTheDocument();
    expect(screen.getByText('Toggle AI Chat')).toBeInTheDocument();
  });

  it('filters commands as the user types', () => {
    renderPalette();
    fireEvent.change(screen.getByPlaceholderText('Type a command...'), {
      target: { value: 'format' },
    });
    expect(screen.getByText('Format Document')).toBeInTheDocument();
    expect(screen.queryByText('New File')).not.toBeInTheDocument();
  });

  it('runs the selected command and closes the palette', () => {
    const handlers = renderPalette();
    fireEvent.click(screen.getByText('Save File'));
    expect(handlers.onSave).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenChange).toHaveBeenCalledWith(false);
  });
});
