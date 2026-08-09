import { describe, expect, it } from 'vitest';
import {
  findDependencyCycle,
  findDuplicateTaskIds,
  findUnknownDependencies,
  parsePlannerOutput,
  validateExecutionOrder,
  validatePlanSemantics,
} from './planner.validator';
import { PlannerOutput, PlannerTask } from './planner.schema';

function task(overrides: Partial<PlannerTask> & { id: string }): PlannerTask {
  return {
    title: overrides.id,
    description: '',
    type: 'setup',
    priority: 'medium',
    complexity: 'small',
    dependencies: [],
    affectedFiles: [],
    acceptanceCriteria: ['Works as described'],
    ...overrides,
  };
}

function validOutput(overrides: Partial<PlannerOutput> = {}): PlannerOutput {
  return {
    summary: 'A todo app',
    projectType: 'Productivity',
    requirements: { explicit: [], inferred: [], missing: [] },
    stack: {},
    architecture: { description: '', nodes: [], edges: [] },
    features: [],
    database: { entities: [], relationships: [] },
    api: [],
    frontend: { pages: [], components: [], hooks: [], state: [] },
    files: [],
    tasks: [task({ id: 'TASK-001' })],
    executionOrder: ['TASK-001'],
    risks: [],
    assumptions: [],
    security: [],
    nonFunctionalRequirements: [],
    conflicts: [],
    ...overrides,
  };
}

describe('parsePlannerOutput', () => {
  it('rejects text that is not valid JSON', () => {
    const result = parsePlannerOutput('not json at all');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues[0]).toMatch(/not valid JSON/i);
  });

  it('rejects JSON missing required fields', () => {
    const result = parsePlannerOutput(JSON.stringify({ summary: 'x' }));
    expect(result.success).toBe(false);
  });

  it('accepts a well-formed plan', () => {
    const result = parsePlannerOutput(JSON.stringify(validOutput()));
    expect(result.success).toBe(true);
  });
});

describe('findDuplicateTaskIds', () => {
  it('finds duplicate ids', () => {
    const tasks = [task({ id: 'TASK-001' }), task({ id: 'TASK-002' }), task({ id: 'TASK-001' })];
    expect(findDuplicateTaskIds(tasks)).toEqual(['TASK-001']);
  });

  it('returns an empty array when there are no duplicates', () => {
    const tasks = [task({ id: 'TASK-001' }), task({ id: 'TASK-002' })];
    expect(findDuplicateTaskIds(tasks)).toEqual([]);
  });
});

describe('findUnknownDependencies', () => {
  it('flags a dependency that does not match any task id', () => {
    const tasks = [task({ id: 'TASK-001', dependencies: ['TASK-999'] })];
    const issues = findUnknownDependencies(tasks);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatch(/TASK-999/);
  });
});

describe('findDependencyCycle', () => {
  it('returns null when there is no cycle', () => {
    const tasks = [
      task({ id: 'TASK-001' }),
      task({ id: 'TASK-002', dependencies: ['TASK-001'] }),
      task({ id: 'TASK-003', dependencies: ['TASK-002'] }),
    ];
    expect(findDependencyCycle(tasks)).toBeNull();
  });

  it('detects a direct cycle', () => {
    const tasks = [
      task({ id: 'TASK-001', dependencies: ['TASK-002'] }),
      task({ id: 'TASK-002', dependencies: ['TASK-001'] }),
    ];
    const cycle = findDependencyCycle(tasks);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('TASK-001');
    expect(cycle).toContain('TASK-002');
  });

  it('detects a transitive cycle', () => {
    const tasks = [
      task({ id: 'TASK-001', dependencies: ['TASK-003'] }),
      task({ id: 'TASK-002', dependencies: ['TASK-001'] }),
      task({ id: 'TASK-003', dependencies: ['TASK-002'] }),
    ];
    expect(findDependencyCycle(tasks)).not.toBeNull();
  });
});

describe('validateExecutionOrder', () => {
  it('flags a task missing from executionOrder', () => {
    const tasks = [task({ id: 'TASK-001' }), task({ id: 'TASK-002' })];
    const issues = validateExecutionOrder(tasks, ['TASK-001']);
    expect(issues.some((issue) => issue.includes('TASK-002'))).toBe(true);
  });

  it('flags an unknown id in executionOrder', () => {
    const tasks = [task({ id: 'TASK-001' })];
    const issues = validateExecutionOrder(tasks, ['TASK-001', 'TASK-999']);
    expect(issues.some((issue) => issue.includes('TASK-999'))).toBe(true);
  });

  it('flags a task ordered before its own dependency', () => {
    const tasks = [task({ id: 'TASK-001', dependencies: ['TASK-002'] }), task({ id: 'TASK-002' })];
    const issues = validateExecutionOrder(tasks, ['TASK-001', 'TASK-002']);
    expect(issues.some((issue) => issue.includes('before its dependency'))).toBe(true);
  });

  it('accepts a valid order with no issues', () => {
    const tasks = [task({ id: 'TASK-001' }), task({ id: 'TASK-002', dependencies: ['TASK-001'] })];
    expect(validateExecutionOrder(tasks, ['TASK-001', 'TASK-002'])).toEqual([]);
  });
});

describe('validatePlanSemantics', () => {
  it('returns no issues for a fully valid plan', () => {
    expect(validatePlanSemantics(validOutput())).toEqual([]);
  });

  it('aggregates every category of issue', () => {
    const output = validOutput({
      tasks: [
        task({ id: 'TASK-001', dependencies: ['TASK-001'] }),
        task({ id: 'TASK-001' }),
      ],
      executionOrder: [],
    });

    const issues = validatePlanSemantics(output);
    expect(issues.length).toBeGreaterThan(1);
  });
});
