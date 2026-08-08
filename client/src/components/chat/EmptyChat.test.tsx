import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyChat } from './EmptyChat';

describe('EmptyChat', () => {
  it('renders the heading and the suggested prompts', () => {
    render(<EmptyChat onSelectPrompt={vi.fn()} />);
    expect(screen.getByText('Mingo AI')).toBeInTheDocument();
    expect(screen.getByText('Your AI Software Engineer')).toBeInTheDocument();
    expect(screen.getByText('Design the authentication architecture')).toBeInTheDocument();
  });

  it('calls onSelectPrompt with the suggestion text when a suggestion is clicked', () => {
    const onSelectPrompt = vi.fn();
    render(<EmptyChat onSelectPrompt={onSelectPrompt} />);

    fireEvent.click(screen.getByText('Review my architecture'));

    expect(onSelectPrompt).toHaveBeenCalledWith('Review my architecture');
  });

  it('disables the suggestion buttons when disabled', () => {
    render(<EmptyChat onSelectPrompt={vi.fn()} disabled />);
    expect(screen.getByText('Review my architecture').closest('button')).toBeDisabled();
  });
});
