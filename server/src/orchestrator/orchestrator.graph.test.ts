import { describe, expect, it } from 'vitest';
import { WorkflowTaskStatus } from 'shared';
import { buildGraph, computeBlockedTasks, computeReadyTasks, detectCycle } from './orchestrator.graph';
import { TaskStateMap } from './orchestrator.types';

function task(id: string, dependencies: string[] = []) {
  return {
    id,
    title: id,
    description: id,
    type: 'frontend',
    priority: 'medium',
    complexity: 'small',
    dependencies,
    affectedFiles: [],
    acceptanceCriteria: [],
  } as never;
}

function stateMap(entries: Record<string, WorkflowTaskStatus>): TaskStateMap {
  return new Map(
    Object.entries(entries).map(([taskId, status]) => [
      taskId,
      { taskId, agentId: 'frontend', status, attempts: 0, generationIds: [] } as never,
    ])
  );
}

describe('buildGraph', () => {
  it('builds the reverse (dependents) edges from forward dependencies', () => {
    const graph = buildGraph([task('A'), task('B', ['A']), task('C', ['A'])]);
    expect(graph.dependents.get('A')?.sort()).toEqual(['B', 'C']);
  });

  it('ignores a dangling dependency id (not a cycle, not a real edge)', () => {
    const graph = buildGraph([task('A', ['GHOST'])]);
    expect(graph.dependents.get('GHOST')).toBeUndefined();
  });
});

describe('detectCycle', () => {
  it('returns null for a valid DAG', () => {
    const graph = buildGraph([task('A'), task('B', ['A']), task('C', ['A', 'B'])]);
    expect(detectCycle(graph)).toBeNull();
  });

  it('detects a direct cycle (A -> B -> A)', () => {
    const graph = buildGraph([task('A', ['B']), task('B', ['A'])]);
    expect(detectCycle(graph)).not.toBeNull();
  });

  it('detects a longer cycle (A -> B -> C -> A)', () => {
    const graph = buildGraph([task('A', ['C']), task('B', ['A']), task('C', ['B'])]);
    const cycle = detectCycle(graph);
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThan(1);
  });

  it('does not flag a diamond dependency (A <- B, A <- C, B+C <- D) as a cycle', () => {
    const graph = buildGraph([task('A'), task('B', ['A']), task('C', ['A']), task('D', ['B', 'C'])]);
    expect(detectCycle(graph)).toBeNull();
  });
});

describe('computeReadyTasks', () => {
  it('a task with no dependencies is ready immediately', () => {
    const graph = buildGraph([task('A')]);
    const ready = computeReadyTasks(graph, stateMap({}));
    expect(ready.map((t) => t.id)).toEqual(['A']);
  });

  it('a task is not ready until every dependency is completed', () => {
    const graph = buildGraph([task('A'), task('B', ['A'])]);
    const notReady = computeReadyTasks(graph, stateMap({ A: WorkflowTaskStatus.RUNNING }));
    expect(notReady.map((t) => t.id)).toEqual([]);

    const ready = computeReadyTasks(graph, stateMap({ A: WorkflowTaskStatus.COMPLETED }));
    expect(ready.map((t) => t.id)).toEqual(['B']);
  });

  it('a skipped dependency does NOT unlock its dependent (spec §37)', () => {
    const graph = buildGraph([task('A'), task('B', ['A'])]);
    const ready = computeReadyTasks(graph, stateMap({ A: WorkflowTaskStatus.SKIPPED }));
    expect(ready.map((t) => t.id)).toEqual([]);
  });

  it('an already-completed or already-running task is never re-selected as ready', () => {
    const graph = buildGraph([task('A')]);
    expect(computeReadyTasks(graph, stateMap({ A: WorkflowTaskStatus.COMPLETED })).map((t) => t.id)).toEqual([]);
    expect(computeReadyTasks(graph, stateMap({ A: WorkflowTaskStatus.RUNNING })).map((t) => t.id)).toEqual([]);
  });

  it('two independent tasks are both ready at once (parallel branches, spec §12)', () => {
    const graph = buildGraph([task('DB'), task('FE')]);
    const ready = computeReadyTasks(graph, stateMap({}));
    expect(ready.map((t) => t.id).sort()).toEqual(['DB', 'FE']);
  });
});

describe('computeBlockedTasks', () => {
  it('marks a task blocked once its dependency has terminally failed', () => {
    const graph = buildGraph([task('A'), task('B', ['A'])]);
    const blocked = computeBlockedTasks(graph, stateMap({ A: WorkflowTaskStatus.FAILED }));
    expect(blocked.map((t) => t.id)).toEqual(['B']);
  });

  it('does not block a task whose dependency is still running', () => {
    const graph = buildGraph([task('A'), task('B', ['A'])]);
    const blocked = computeBlockedTasks(graph, stateMap({ A: WorkflowTaskStatus.RUNNING }));
    expect(blocked.map((t) => t.id)).toEqual([]);
  });
});
