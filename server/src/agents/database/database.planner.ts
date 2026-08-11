import { IApiContract, IPlanDatabase } from 'shared';
import { RequiredFieldPlan } from './database.types';
import { SchemaContractOutput } from './database.schema';

/**
 * Schema-design/contract-planning logic for the Database Agent (Phase 8 spec §6/§13/§26/§51) —
 * named `database.planner.ts` per spec, distinct from `agents/planner/` (the Planner Agent that
 * produces the `ProjectPlan` this module *reads*). Nothing here calls the AI or touches MongoDB;
 * it only derives what a model's fields *should* be from already-trustworthy sources (the
 * approved plan, an already-implemented backend contract) and checks the AI's actual output
 * against that — the same "ground truth vs. generated" shape as
 * `agents/backend/backend.service.ts`'s `computeContractWarnings`.
 */

function singularize(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('ses')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function capitalize(word: string): string {
  return word.length === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1);
}

/** Best-effort model name from a REST resource path, e.g. `/api/todos/:id` -> `"Todo"`. Used only
 *  to associate a backend contract's request fields with a model name when the plan itself doesn't
 *  already say which model an endpoint belongs to — a heuristic, not a guarantee, which is exactly
 *  why `computeSchemaContractWarnings` below only ever warns, never blocks. */
export function inferModelNameFromPath(path: string): string | null {
  const segments = path.split('/').filter((segment) => segment.length > 0 && !segment.startsWith(':'));
  const resource = segments[segments.length - 1];
  if (!resource) return null;
  return capitalize(singularize(resource));
}

/**
 * Merges the Planner's declared database entities with the Backend Agent's already-implemented API
 * contracts into one required-field list per model (spec §13/§25/§26) — the ground truth a
 * generated `schemaContracts` entry is checked against. A field appearing in either source counts;
 * neither source is treated as more authoritative than the other, since either can legitimately be
 * incomplete (the plan is high-level, a backend contract may only cover one endpoint's fields).
 */
export function buildRequiredFieldPlan(
  planDatabase: IPlanDatabase | null | undefined,
  backendApiContracts: IApiContract[]
): RequiredFieldPlan[] {
  const byModel = new Map<string, Set<string>>();

  for (const entity of planDatabase?.entities ?? []) {
    const fields = byModel.get(entity.name) ?? new Set<string>();
    for (const field of entity.fields) fields.add(field.name);
    byModel.set(entity.name, fields);
  }

  for (const contract of backendApiContracts) {
    if (!contract.request) continue;
    const model = inferModelNameFromPath(contract.path);
    if (!model) continue;

    const fields = byModel.get(model) ?? new Set<string>();
    for (const key of Object.keys(contract.request)) fields.add(key);
    byModel.set(model, fields);
  }

  return Array.from(byModel.entries()).map(([model, fields]) => ({
    model,
    requiredFields: Array.from(fields),
  }));
}

const ALWAYS_PRESENT_FIELDS = new Set(['id', '_id']);

/**
 * Flags a required field (from the Planner's entities or an already-implemented backend contract)
 * that a generated schema doesn't actually support (spec §26: "Show: DATABASE CONTRACT CONFLICT").
 * Only checked against models this generation actually touches — a required-field entry for a model
 * this task doesn't own isn't this generation's concern (a later task may still build it). Never
 * used to reject the generation; only ever surfaced as a warning on the `AgentGeneration`.
 */
export function computeSchemaContractWarnings(
  requiredFieldPlan: RequiredFieldPlan[],
  generatedSchemas: SchemaContractOutput[]
): string[] {
  const warnings: string[] = [];
  const schemaByModel = new Map(generatedSchemas.map((schema) => [schema.model, schema]));

  for (const { model, requiredFields } of requiredFieldPlan) {
    const schema = schemaByModel.get(model);
    if (!schema) continue;

    for (const field of requiredFields) {
      if (ALWAYS_PRESENT_FIELDS.has(field)) continue;
      if (!(field in schema.fields)) {
        warnings.push(
          `Database contract conflict: model "${model}" is missing field "${field}", which is required by the approved plan or an already-implemented backend contract.`
        );
      }
    }
  }

  return warnings;
}
