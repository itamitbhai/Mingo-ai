import { z } from 'zod';
import {
  ArchitectureNodeType,
  DatabaseRelationType,
  FileEntryType,
  NonFunctionalCategory,
  RecommendedAgent,
  RiskSeverity,
  TaskComplexity,
  TaskPriority,
  TaskType,
  TechSource,
} from 'shared';

const enumValues = <T extends Record<string, string>>(e: T) =>
  Object.values(e) as [T[keyof T], ...T[keyof T][]];

const stackEntrySchema = z.object({
  name: z.string().min(1),
  source: z.enum(enumValues(TechSource)),
  reason: z.string().optional(),
});

const requirementsSchema = z.object({
  explicit: z.array(z.string()).default([]),
  inferred: z.array(z.string()).default([]),
  missing: z.array(z.string()).default([]),
});

const stackSchema = z
  .object({
    frontend: stackEntrySchema.optional(),
    backend: stackEntrySchema.optional(),
    database: stackEntrySchema.optional(),
    authentication: stackEntrySchema.optional(),
    payments: stackEntrySchema.optional(),
    storage: stackEntrySchema.optional(),
    styling: stackEntrySchema.optional(),
    testing: stackEntrySchema.optional(),
    deployment: stackEntrySchema.optional(),
  })
  .partial();

const architectureNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(enumValues(ArchitectureNodeType)).optional(),
});

const architectureEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  label: z.string().optional(),
});

const architectureSchema = z.object({
  description: z.string().default(''),
  nodes: z.array(architectureNodeSchema).default([]),
  edges: z.array(architectureEdgeSchema).default([]),
});

const featureSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(''),
  priority: z.enum(enumValues(TaskPriority)),
  complexity: z.enum(enumValues(TaskComplexity)),
  requirements: z.array(z.string()).default([]),
});

const databaseFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().optional(),
  description: z.string().optional(),
});

const databaseEntitySchema = z.object({
  name: z.string().min(1),
  fields: z.array(databaseFieldSchema).default([]),
});

const databaseRelationshipSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  type: z.enum(enumValues(DatabaseRelationType)),
  description: z.string().optional(),
});

const databaseGroupSchema = z.object({
  entities: z.array(databaseEntitySchema).default([]),
  relationships: z.array(databaseRelationshipSchema).default([]),
});

const apiEndpointSchema = z.object({
  method: z.string().min(1),
  path: z.string().min(1),
  purpose: z.string().default(''),
  authRequired: z.boolean().default(false),
  requestSummary: z.string().optional(),
  responseSummary: z.string().optional(),
  relatedFeature: z.string().optional(),
});

const pageSchema = z.object({
  name: z.string().min(1),
  path: z.string().optional(),
  description: z.string().optional(),
});

const componentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const frontendGroupSchema = z.object({
  pages: z.array(pageSchema).default([]),
  components: z.array(componentSchema).default([]),
  hooks: z.array(componentSchema).default([]),
  state: z.array(z.string()).default([]),
});

const fileEntrySchema = z.object({
  path: z.string().min(1),
  type: z.enum(enumValues(FileEntryType)),
  description: z.string().optional(),
  exists: z.boolean().optional(),
});

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  type: z.enum(enumValues(TaskType)),
  priority: z.enum(enumValues(TaskPriority)),
  complexity: z.enum(enumValues(TaskComplexity)),
  dependencies: z.array(z.string()).default([]),
  affectedFiles: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  recommendedAgent: z.enum(enumValues(RecommendedAgent)).optional(),
});

const riskSchema = z.object({
  severity: z.enum(enumValues(RiskSeverity)),
  description: z.string().min(1),
  mitigation: z.string().default(''),
});

const securitySchema = z.object({
  requirement: z.string().min(1),
  description: z.string().optional(),
});

const nonFunctionalSchema = z.object({
  category: z.enum(enumValues(NonFunctionalCategory)),
  description: z.string().min(1),
});

const conflictSchema = z.object({
  description: z.string().min(1),
  optionsDetected: z.array(z.string()).default([]),
});

/**
 * The AI's structured-output contract. Every object here is non-`.strict()` so incidental extra
 * keys the model adds don't fail validation — only the fields Mingo actually reads are declared.
 * `tasks` requires at least one entry: a plan with no tasks isn't actionable (spec §65, "produce
 * actionable tasks").
 */
export const planOutputSchema = z.object({
  summary: z.string().min(1, 'summary is required'),
  projectType: z.string().min(1, 'projectType is required'),
  requirements: requirementsSchema.default({ explicit: [], inferred: [], missing: [] }),
  stack: stackSchema.default({}),
  architecture: architectureSchema.default({ description: '', nodes: [], edges: [] }),
  features: z.array(featureSchema).default([]),
  database: databaseGroupSchema.default({ entities: [], relationships: [] }),
  api: z.array(apiEndpointSchema).default([]),
  frontend: frontendGroupSchema.default({ pages: [], components: [], hooks: [], state: [] }),
  files: z.array(fileEntrySchema).default([]),
  tasks: z.array(taskSchema).min(1, 'at least one task is required'),
  executionOrder: z.array(z.string()).default([]),
  risks: z.array(riskSchema).default([]),
  assumptions: z.array(z.string()).default([]),
  security: z.array(securitySchema).default([]),
  nonFunctionalRequirements: z.array(nonFunctionalSchema).default([]),
  conflicts: z.array(conflictSchema).default([]),
});

export type PlannerOutput = z.infer<typeof planOutputSchema>;
export type PlannerTask = z.infer<typeof taskSchema>;
export type PlannerFeature = z.infer<typeof featureSchema>;
export type PlannerStackEntry = z.infer<typeof stackEntrySchema>;
