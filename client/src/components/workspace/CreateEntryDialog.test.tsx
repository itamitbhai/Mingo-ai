import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FileEntryType } from 'shared';
import { CreateEntryDialog } from './CreateEntryDialog';

describe('CreateEntryDialog', () => {
  it('renders nothing when state is null', () => {
    render(<CreateEntryDialog state={null} onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows "New File" for file mode and "New Folder" for folder mode', () => {
    const { rerender } = render(
      <CreateEntryDialog
        state={{ parentPath: '', type: FileEntryType.FILE }}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('New File')).toBeInTheDocument();

    rerender(
      <CreateEntryDialog
        state={{ parentPath: '', type: FileEntryType.FOLDER }}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByText('New Folder')).toBeInTheDocument();
  });

  it('disables Create until a name is entered', () => {
    render(
      <CreateEntryDialog
        state={{ parentPath: '', type: FileEntryType.FILE }}
        onOpenChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'UserCard.tsx' } });
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();
  });

  it('submits the entered name on Enter', async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    render(
      <CreateEntryDialog
        state={{ parentPath: '', type: FileEntryType.FILE }}
        onOpenChange={vi.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'UserCard.tsx' } });
    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });
    });

    expect(onSubmit).toHaveBeenCalledWith('UserCard.tsx');
  });
});
