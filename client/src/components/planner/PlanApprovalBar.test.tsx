import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { IProjectPlan } from 'shared';
import { PlanApprovalBar } from './PlanApprovalBar';

function buildPlan(overrides: Partial<IProjectPlan> = {}): IProjectPlan {
  return {
    id: 'p1',
    project: 'proj1',
    owner: 'u1',
    version: 1,
    status: 'ready',
    prompt: 'Build a todo app',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('PlanApprovalBar', () => {
  it('shows Approve/Reject for a ready plan and explains approval does not execute anything', () => {
    render(
      <PlanApprovalBar
        plan={buildPlan()}
        isSubmitting={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /approve plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument();
    expect(screen.getByText(/does not execute any tasks/i)).toBeInTheDocument();
  });

  it('hides Approve/Reject once a decision has already been made', () => {
    render(
      <PlanApprovalBar
        plan={buildPlan({ status: 'approved' })}
        isSubmitting={false}
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /approve plan/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
  });

  it('calls onApprove/onReject/onRegenerate when clicked', () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();
    const onRegenerate = vi.fn();

    render(
      <PlanApprovalBar
        plan={buildPlan()}
        isSubmitting={false}
        onApprove={onApprove}
        onReject={onReject}
        onRegenerate={onRegenerate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /approve plan/i }));
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }));

    expect(onApprove).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalled();
    expect(onRegenerate).toHaveBeenCalled();
  });

  it('disables every action while submitting', () => {
    render(
      <PlanApprovalBar
        plan={buildPlan()}
        isSubmitting
        onApprove={vi.fn()}
        onReject={vi.fn()}
        onRegenerate={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /approve plan/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeDisabled();
  });
});
