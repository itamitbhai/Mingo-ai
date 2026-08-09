import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IPlanTask } from 'shared';
import { TaskList } from './TaskList';

function buildTask(overrides: Partial<IPlanTask> & { id: string }): IPlanTask {
  return {
    title: overrides.id,
    description: 'Do the thing',
    type: 'setup',
    priority: 'medium',
    complexity: 'small',
    dependencies: [],
    affectedFiles: [],
    acceptanceCriteria: ['Works as described'],
    ...overrides,
  };
}

describe('TaskList', () => {
  it('shows an empty state when there are no tasks', () => {
    render(<TaskList tasks={undefined} executionOrder={undefined} />);
    expect(screen.getByText('No tasks were generated.')).toBeInTheDocument();
  });

  it('renders each task with its dependencies and acceptance criteria', () => {
    const tasks = [
      buildTask({ id: 'TASK-001' }),
      buildTask({ id: 'TASK-002', title: 'Build UI', dependencies: ['TASK-001'] }),
    ];

    render(<TaskList tasks={tasks} executionOrder={['TASK-001', 'TASK-002']} />);

    expect(screen.getByText('Build UI')).toBeInTheDocument();
    expect(screen.getByText(/Depends on:/)).toBeInTheDocument();
    expect(screen.getAllByText('Works as described')).toHaveLength(2);
  });

  it('does not show edit affordances when not editable', () => {
    render(<TaskList tasks={[buildTask({ id: 'TASK-001' })]} executionOrder={['TASK-001']} />);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
  });

  it('lets an editable task be edited and calls onEdit with the changes', () => {
    const onEdit = vi.fn();
    render(
      <TaskList
        tasks={[buildTask({ id: 'TASK-001', title: 'Set up project' })]}
        executionOrder={['TASK-001']}
        editable
        onEdit={onEdit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit Set up project' }));
    const titleInput = screen.getByLabelText('Task title');
    fireEvent.change(titleInput, { target: { value: 'Set up the repo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'TASK-001', title: 'Set up the repo' })
    );
  });
});
