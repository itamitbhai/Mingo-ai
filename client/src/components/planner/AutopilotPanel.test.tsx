import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AutopilotPanel } from './AutopilotPanel';

describe('AutopilotPanel', () => {
  it('renders nothing when idle with no result', () => {
    const { container } = render(
      <AutopilotPanel
        projectId="p1"
        runStatus="idle"
        phase={null}
        stageLabel=""
        currentTask={null}
        streamError={null}
        result={null}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the current task progress while streaming', () => {
    render(
      <AutopilotPanel
        projectId="p1"
        runStatus="streaming"
        phase="task"
        stageLabel="Generating code…"
        currentTask={{ taskId: 'T1', taskTitle: 'Build header', taskIndex: 1, taskCount: 3 }}
        streamError={null}
        result={null}
      />
    );

    expect(screen.getByText('Task 1/3: Build header — Generating code…')).toBeInTheDocument();
  });

  it('renders the finished summary with outcome badges and an Open Workspace link', () => {
    render(
      <AutopilotPanel
        projectId="p1"
        runStatus="idle"
        phase="task"
        stageLabel=""
        currentTask={null}
        streamError={null}
        result={{
          stoppedEarly: false,
          tasks: [
            { taskId: 'T1', title: 'Build header', outcome: 'completed', generationId: 'g1' },
            { taskId: 'T2', title: 'Build API', outcome: 'skipped', reason: 'No backend agent yet.' },
          ],
        }}
      />
    );

    expect(screen.getByText('Build header')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('skipped')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open workspace/i })).toHaveAttribute('href', '/projects/p1/workspace');
  });

  it('renders a stopped-early banner naming the failed task', () => {
    render(
      <AutopilotPanel
        projectId="p1"
        runStatus="idle"
        phase="task"
        stageLabel=""
        currentTask={null}
        streamError={null}
        result={{
          stoppedEarly: true,
          tasks: [
            { taskId: 'T1', title: 'Build header', outcome: 'completed', generationId: 'g1' },
            { taskId: 'T2', title: 'Build cart', outcome: 'failed', error: 'The Frontend Agent could not generate valid changes.' },
            { taskId: 'T3', title: 'Build checkout', outcome: 'not_attempted' },
          ],
        }}
      />
    );

    expect(screen.getByText(/Build stopped at.*Build cart/)).toBeInTheDocument();
    expect(screen.getByText('not attempted')).toBeInTheDocument();
  });
});
