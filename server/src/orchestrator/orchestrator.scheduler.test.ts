import { describe, expect, it } from 'vitest';
import { selectNextBatch } from './orchestrator.scheduler';

function task(id: string, affectedFiles: string[] = []) {
  return {
    id,
    title: id,
    description: id,
    type: 'frontend',
    priority: 'medium',
    complexity: 'small',
    dependencies: [],
    affectedFiles,
    acceptanceCriteria: [],
  } as never;
}

describe('selectNextBatch', () => {
  it('caps the batch at the remaining concurrency', () => {
    const ready = [task('A'), task('B'), task('C')];
    const batch = selectNextBatch(ready, 1, 2);
    expect(batch.map((t) => t.id)).toEqual(['A']);
  });

  it('returns nothing when concurrency is already exhausted', () => {
    expect(selectNextBatch([task('A')], 3, 3)).toEqual([]);
  });

  it('runs two tasks with no file overlap in the same batch (spec §12)', () => {
    const ready = [task('Database Schema', ['server/models/Todo.js']), task('Frontend UI', ['client/src/App.tsx'])];
    const batch = selectNextBatch(ready, 0, 3);
    expect(batch.map((t) => t.id).sort()).toEqual(['Database Schema', 'Frontend UI']);
  });

  it('serializes two tasks that would both touch the same file this round (spec §14/§15)', () => {
    const ready = [task('A', ['shared/config.ts']), task('B', ['shared/config.ts'])];
    const batch = selectNextBatch(ready, 0, 3);
    expect(batch.map((t) => t.id)).toEqual(['A']);
  });

  it('serializes two tasks that would both touch package.json even at different paths', () => {
    const ready = [task('A', ['package.json']), task('B', ['client/package.json'])];
    // different literal paths, both package.json files — still serialized (spec §14: "package.json
    // conflicts" is called out explicitly, not just an exact-path match)
    const batch = selectNextBatch(ready, 0, 3);
    expect(batch.map((t) => t.id)).toEqual(['A']);
  });

  it('the held-back task from this round is not lost — it can run once the conflicting one finishes', () => {
    // selectNextBatch itself is stateless per call; the caller (orchestrator.ts) re-evaluates ready
    // tasks every round, so B simply reappears as a candidate on the next call once A completes.
    const ready = [task('A', ['x.ts']), task('B', ['x.ts'])];
    const roundOne = selectNextBatch(ready, 0, 3);
    expect(roundOne.map((t) => t.id)).toEqual(['A']);

    const roundTwo = selectNextBatch([task('B', ['x.ts'])], 0, 3);
    expect(roundTwo.map((t) => t.id)).toEqual(['B']);
  });
});
