import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MessageRole, MessageStatus, type IMessage } from 'shared';
import { ChatMessage } from './ChatMessage';

function buildMessage(overrides: Partial<IMessage> = {}): IMessage {
  return {
    id: 'm1',
    conversation: 'c1',
    project: 'p1',
    role: MessageRole.ASSISTANT,
    content: '',
    status: MessageStatus.COMPLETED,
    tokens: { input: null, output: null, total: null },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ChatMessage', () => {
  it('renders user messages as plain text', () => {
    render(<ChatMessage message={buildMessage({ role: MessageRole.USER, content: 'Hello AI' })} />);
    expect(screen.getByText('Hello AI')).toBeInTheDocument();
  });

  it('renders assistant content as markdown', () => {
    render(<ChatMessage message={buildMessage({ content: '**bold text**' })} />);
    expect(screen.getByText('bold text')).toBeInTheDocument();
  });

  it('shows a Retry button for a failed assistant message and calls onRetry with its id', () => {
    const onRetry = vi.fn();
    render(
      <ChatMessage message={buildMessage({ status: MessageStatus.FAILED, content: '' })} onRetry={onRetry} />
    );

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(onRetry).toHaveBeenCalledWith('m1');
  });

  it('shows a generating indicator for a pending assistant message with no content yet', () => {
    render(<ChatMessage message={buildMessage({ status: MessageStatus.PENDING, content: '' })} />);
    expect(screen.getByText(/generating/i)).toBeInTheDocument();
  });

  it('shows a stopped notice for a cancelled message', () => {
    render(<ChatMessage message={buildMessage({ status: MessageStatus.CANCELLED, content: 'partial' })} />);
    expect(screen.getByText(/generation stopped/i)).toBeInTheDocument();
  });
});
