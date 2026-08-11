import { describe, expect, it } from 'vitest';
import {
  buildRequiredFieldPlan,
  computeSchemaContractWarnings,
  inferModelNameFromPath,
} from './database.planner';

describe('inferModelNameFromPath', () => {
  it.each([
    ['/api/todos', 'Todo'],
    ['/api/todos/:id', 'Todo'],
    ['/api/categories', 'Category'],
    ['/api/users/:id/orders', 'Order'],
  ])('infers %s -> %s', (path, expected) => {
    expect(inferModelNameFromPath(path)).toBe(expected);
  });

  it('returns null for a path with no resource segment', () => {
    expect(inferModelNameFromPath('/')).toBeNull();
  });
});

describe('buildRequiredFieldPlan', () => {
  it("merges the plan's declared entity fields with a backend contract's request fields", () => {
    const plan = buildRequiredFieldPlan(
      { entities: [{ name: 'Todo', fields: [{ name: 'title', type: 'string', required: true }] }], relationships: [] },
      [{ method: 'POST', path: '/api/todos', authentication: true, request: { completed: 'boolean' } }]
    );

    const todo = plan.find((entry) => entry.model === 'Todo');
    expect(todo?.requiredFields).toEqual(expect.arrayContaining(['title', 'completed']));
  });

  it('returns an empty plan when neither source has data', () => {
    expect(buildRequiredFieldPlan(null, [])).toEqual([]);
  });

  it("ignores a backend contract whose path doesn't resolve to a resource", () => {
    const plan = buildRequiredFieldPlan(undefined, [
      { method: 'GET', path: '/', authentication: false, request: { x: 'string' } },
    ]);
    expect(plan).toEqual([]);
  });
});

describe('computeSchemaContractWarnings', () => {
  it('flags a missing required field on a model this generation actually touches', () => {
    const warnings = computeSchemaContractWarnings(
      [{ model: 'Todo', requiredFields: ['title', 'completed'] }],
      [{ model: 'Todo', collection: 'todos', fields: { title: { type: 'String' } }, indexes: [] }]
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('missing field "completed"');
  });

  it('never flags a model this generation does not touch', () => {
    const warnings = computeSchemaContractWarnings(
      [{ model: 'Order', requiredFields: ['total'] }],
      [{ model: 'Todo', collection: 'todos', fields: { title: { type: 'String' } }, indexes: [] }]
    );

    expect(warnings).toEqual([]);
  });

  it('ignores id/_id as required fields', () => {
    const warnings = computeSchemaContractWarnings(
      [{ model: 'Todo', requiredFields: ['id', '_id', 'title'] }],
      [{ model: 'Todo', collection: 'todos', fields: { title: { type: 'String' } }, indexes: [] }]
    );

    expect(warnings).toEqual([]);
  });

  it('returns no warnings when every required field is present', () => {
    const warnings = computeSchemaContractWarnings(
      [{ model: 'Todo', requiredFields: ['title'] }],
      [{ model: 'Todo', collection: 'todos', fields: { title: { type: 'String' } }, indexes: [] }]
    );

    expect(warnings).toEqual([]);
  });
});
