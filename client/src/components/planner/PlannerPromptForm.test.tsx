import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PlannerPromptForm } from './PlannerPromptForm';

describe('PlannerPromptForm', () => {
  it('disables Generate Plan until the prompt is long enough', () => {
    render(
      <PlannerPromptForm onSubmit={vi.fn()} isStreaming={false} stage={null} stageLabel="" error={null} />
    );

    expect(screen.getByRole('button', { name: /generate plan/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Project request'), { target: { value: 'Build a todo app' } });
    expect(screen.getByRole('button', { name: /generate plan/i })).not.toBeDisabled();
  });

  it('calls onSubmit with the trimmed prompt', () => {
    const onSubmit = vi.fn();
    render(<PlannerPromptForm onSubmit={onSubmit} isStreaming={false} stage={null} stageLabel="" error={null} />);

    fireEvent.change(screen.getByLabelText('Project request'), { target: { value: '  Build a todo app  ' } });
    fireEvent.click(screen.getByRole('button', { name: /generate plan/i }));

    expect(onSubmit).toHaveBeenCalledWith('Build a todo app');
  });

  it('disables the form and shows a stage label while streaming', () => {
    render(
      <PlannerPromptForm
        onSubmit={vi.fn()}
        isStreaming
        stage="loading_context"
        stageLabel="Loading project context…"
        error={null}
      />
    );

    expect(screen.getByLabelText('Project request')).toBeDisabled();
    expect(screen.getByRole('button', { name: /generate plan/i })).toBeDisabled();
    expect(screen.getByText('Loading project context…')).toBeInTheDocument();
  });

  it('shows the streaming error once generation stops', () => {
    render(
      <PlannerPromptForm
        onSubmit={vi.fn()}
        isStreaming={false}
        stage="error"
        stageLabel=""
        error="The planner could not generate a plan right now."
      />
    );

    expect(screen.getByText('The planner could not generate a plan right now.')).toBeInTheDocument();
  });

  it('hides Build It Now unless onBuildNow is provided', () => {
    render(<PlannerPromptForm onSubmit={vi.fn()} isStreaming={false} stage={null} stageLabel="" error={null} />);

    expect(screen.queryByRole('button', { name: /build it now/i })).not.toBeInTheDocument();
  });

  it('calls onBuildNow with the trimmed prompt, and disables both buttons while building', () => {
    const onBuildNow = vi.fn();
    const { rerender } = render(
      <PlannerPromptForm
        onSubmit={vi.fn()}
        onBuildNow={onBuildNow}
        isStreaming={false}
        stage={null}
        stageLabel=""
        error={null}
      />
    );

    fireEvent.change(screen.getByLabelText('Project request'), { target: { value: '  Build a todo app  ' } });
    fireEvent.click(screen.getByRole('button', { name: /build it now/i }));
    expect(onBuildNow).toHaveBeenCalledWith('Build a todo app');

    rerender(
      <PlannerPromptForm
        onSubmit={vi.fn()}
        onBuildNow={onBuildNow}
        isBuilding
        isStreaming={false}
        stage={null}
        stageLabel=""
        error={null}
      />
    );

    expect(screen.getByRole('button', { name: /generate plan/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /build it now/i })).toBeDisabled();
  });
});
