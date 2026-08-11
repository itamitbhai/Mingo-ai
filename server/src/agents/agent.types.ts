/**
 * Shared metadata shape every Mingo AI agent describes itself with (spec §7/§59). Deliberately not
 * a base class or an `execute()`/`validate()`/`cancel()` contract — the existing Planner Agent
 * (`agents/planner/planner.agent.ts`) is a stateless async function with cancellation via
 * `AbortSignal` and progress via an `onStage` callback, not a class, and the Frontend Agent follows
 * the same pattern. This interface exists only so an agent can be listed/described uniformly (e.g.
 * for a future orchestrator), without forcing every agent into one execution shape.
 */
export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

export const FRONTEND_AGENT_DEFINITION: AgentDefinition = {
  id: 'frontend',
  name: 'Mingo AI Frontend Agent',
  description:
    'Consumes approved frontend tasks from the Planner Agent and generates/modifies frontend project files through the Virtual Filesystem.',
  capabilities: [
    'frontend_ui',
    'frontend_components',
    'frontend_pages',
    'frontend_routing',
    'frontend_state',
    'frontend_styling',
    'frontend_api_integration',
    'frontend_validation',
    'frontend_accessibility',
    'frontend_responsive_design',
  ],
};

/** Phase 7 — the second agent that writes real code. Same stateless-async-function pattern as the
 *  Planner and Frontend Agents, never a class. */
export const BACKEND_AGENT_DEFINITION: AgentDefinition = {
  id: 'backend',
  name: 'Mingo AI Backend Agent',
  description:
    'Consumes approved backend tasks from the Planner Agent and generates/modifies backend project files (routes, controllers, services, middleware) through the Virtual Filesystem.',
  capabilities: [
    'backend_server',
    'backend_routes',
    'backend_controllers',
    'backend_services',
    'backend_middleware',
    'backend_validation',
    'backend_authentication',
    'backend_authorization',
    'backend_error_handling',
    'backend_api',
    'backend_integrations',
    'backend_configuration',
    'backend_security',
  ],
};

/** Phase 8 — the third agent that writes real code. Same stateless-async-function pattern as every
 *  other agent, never a class; never connects to or mutates a live MongoDB server. */
export const DATABASE_AGENT_DEFINITION: AgentDefinition = {
  id: 'database',
  name: 'Mingo AI Database Agent',
  description:
    'Consumes approved database tasks from the Planner Agent and generates/modifies MongoDB/Mongoose schemas, models, indexes, and seed data through the Virtual Filesystem — never executes against a live database.',
  capabilities: [
    'database_schema',
    'database_models',
    'database_indexes',
    'database_relationships',
    'database_seed_data',
    'database_validation',
    'database_repository',
    'database_configuration',
    'database_aggregation',
    'database_security',
  ],
};
