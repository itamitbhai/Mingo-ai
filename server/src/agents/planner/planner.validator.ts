import { planOutputSchema, PlannerOutput, PlannerTask } from './planner.schema';

export type ParsePlannerOutputResult =
  | { success: true; data: PlannerOutput }
  | { success: false; issues: string[] };

/** JSON.parse + Zod validation of the raw text an AI completion returned. */
export function parsePlannerOutput(raw: string): ParsePlannerOutputResult {
  let json: unknown;

  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, issues: ['The response was not valid JSON.'] };
  }

  const result = planOutputSchema.safeParse(json);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`
    );
    return { success: false, issues };
  }

  return { success: true, data: result.data };
}

/** Depth-first search for a cycle in the task dependency graph. Returns the cycle (task ids, in
 *  order) if one exists, otherwise null. Unknown dependency ids are ignored here — they're
 *  reported separately by `findUnknownDependencies`. */
export function findDependencyCycle(tasks: PlannerTask[]): string[] | null {
  const dependenciesById = new Map(tasks.map((task) => [task.id, task.dependencies]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const path: string[] = [];

  function visit(id: string): string[] | null {
    color.set(id, GRAY);
    path.push(id);

    for (const dependencyId of dependenciesById.get(id) ?? []) {
      if (!dependenciesById.has(dependencyId)) continue;

      const state = color.get(dependencyId) ?? WHITE;
      if (state === GRAY) {
        const cycleStart = path.indexOf(dependencyId);
        return [...path.slice(cycleStart), dependencyId];
      }
      if (state === WHITE) {
        const found = visit(dependencyId);
        if (found) return found;
      }
    }

    path.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const task of tasks) {
    if ((color.get(task.id) ?? WHITE) === WHITE) {
      const cycle = visit(task.id);
      if (cycle) return cycle;
    }
  }

  return null;
}

export function findUnknownDependencies(tasks: PlannerTask[]): string[] {
  const knownIds = new Set(tasks.map((task) => task.id));
  const issues: string[] = [];

  for (const task of tasks) {
    for (const dependencyId of task.dependencies) {
      if (!knownIds.has(dependencyId)) {
        issues.push(`Task "${task.id}" depends on unknown task "${dependencyId}"`);
      }
    }
  }

  return issues;
}

export function findDuplicateTaskIds(tasks: PlannerTask[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const task of tasks) {
    if (seen.has(task.id)) {
      duplicates.add(task.id);
    }
    seen.add(task.id);
  }

  return [...duplicates];
}

/** Checks that `executionOrder` is a full permutation of the task ids and that every task's
 *  dependencies appear before it. */
export function validateExecutionOrder(tasks: PlannerTask[], executionOrder: string[]): string[] {
  const issues: string[] = [];
  const taskIds = new Set(tasks.map((task) => task.id));
  const orderSet = new Set(executionOrder);

  for (const id of taskIds) {
    if (!orderSet.has(id)) {
      issues.push(`executionOrder is missing task "${id}"`);
    }
  }

  for (const id of executionOrder) {
    if (!taskIds.has(id)) {
      issues.push(`executionOrder references unknown task "${id}"`);
    }
  }

  const position = new Map(executionOrder.map((id, index) => [id, index]));
  for (const task of tasks) {
    const taskPosition = position.get(task.id);
    if (taskPosition === undefined) continue;

    for (const dependencyId of task.dependencies) {
      const dependencyPosition = position.get(dependencyId);
      if (dependencyPosition !== undefined && dependencyPosition > taskPosition) {
        issues.push(
          `executionOrder places "${task.id}" before its dependency "${dependencyId}"`
        );
      }
    }
  }

  return issues;
}

/** Every semantic (non-Zod-structural) check the retry loop needs — duplicate ids, unknown
 *  dependencies, circular dependencies, and an execution order consistent with them. */
export function validatePlanSemantics(output: PlannerOutput): string[] {
  const issues: string[] = [];

  issues.push(...findDuplicateTaskIds(output.tasks).map((id) => `Duplicate task id "${id}"`));
  issues.push(...findUnknownDependencies(output.tasks));

  const cycle = findDependencyCycle(output.tasks);
  if (cycle) {
    issues.push(`Circular task dependency detected: ${cycle.join(' → ')}`);
  }

  issues.push(...validateExecutionOrder(output.tasks, output.executionOrder));

  return issues;
}
