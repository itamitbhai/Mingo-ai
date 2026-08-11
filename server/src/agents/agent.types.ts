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
