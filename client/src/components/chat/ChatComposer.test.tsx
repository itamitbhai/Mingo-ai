import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatComposer } from './ChatComposer';

describe('ChatComposer', () => {
  it('disables the send button when the input is empty', () => {
    render(<ChatComposer isStreaming={false} onSend={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: /send message/i })).toBeDisabled();
  });

  it('sends the trimmed message on Enter and clears the input', () => {
    const onSend = vi.fn();
    render(<ChatComposer isStreaming={false} onSend={onSend} onStop={vi.fn()} />);
    const textarea = screen.getByRole('textbox', { name: /message/i });

    fireEvent.change(textarea, { target: { value: '  Hello there  ' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSend).toHaveBeenCalledWith('Hello there');
    expect(textarea).toHaveValue('');
  });

  it('inserts a newline instead of sending on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<ChatComposer isStreaming={false} onSend={onSend} onStop={vi.fn()} />);
    const textarea = screen.getByRole('textbox', { name: /message/i });

    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows a Stop button instead of Send while streaming', () => {
    render(<ChatComposer isStreaming onSend={vi.fn()} onStop={vi.fn()} />);
    expect(screen.getByRole('button', { name: /stop generating/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send message/i })).not.toBeInTheDocument();
  });

  it('calls onStop when the stop button is clicked', () => {
    const onStop = vi.fn();
    render(<ChatComposer isStreaming onSend={vi.fn()} onStop={onStop} />);

    fireEvent.click(screen.getByRole('button', { name: /stop generating/i }));

    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
