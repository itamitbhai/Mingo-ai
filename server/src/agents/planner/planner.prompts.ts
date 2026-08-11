import { PlannerContext } from './planner.types';

const OUTPUT_SHAPE = `Respond with a single JSON object and nothing else — no markdown fences, no prose before or after it. It must have exactly this shape:

{
  "summary": string,
  "projectType": string,                          // e.g. "E-commerce", "SaaS", "Blog", "Booking Platform"
  "requirements": {
    "explicit": string[],                          // only things the user's request literally stated
    "inferred": string[],                           // reasonable additions YOU inferred — never blend these with explicit
    "missing": string[]                              // relevant info the user didn't specify (do not block on these — make an assumption instead)
  },
  "stack": {                                          // include only the categories that are actually relevant
    "frontend"?: { "name": string, "source": "user_selected"|"inferred"|"recommended", "reason"?: string },
    "backend"?: { ...same shape... },
    "database"?: { ...same shape... },
    "authentication"?: { ...same shape... },
    "payments"?: { ...same shape... },
    "storage"?: { ...same shape... },
    "styling"?: { ...same shape... },
    "testing"?: { ...same shape... },
    "deployment"?: { ...same shape... }
  },
  "architecture": {
    "description": string,
    "nodes": [{ "id": string, "label": string, "type"?: "frontend"|"api"|"service"|"database"|"auth"|"external"|"storage"|"deployment" }],
    "edges": [{ "from": string, "to": string, "label"?: string }]   // "from"/"to" reference node ids
  },
  "features": [{ "id": string, "name": string, "description": string, "priority": "critical"|"high"|"medium"|"low", "complexity": "small"|"medium"|"large"|"complex", "requirements": string[] }],
  "database": {
    "entities": [{ "name": string, "fields": [{ "name": string, "type": string, "required"?: boolean, "description"?: string }] }],
    "relationships": [{ "from": string, "to": string, "type": "one-to-one"|"one-to-many"|"many-to-many", "description"?: string }]
  },
  "api": [{ "method": string, "path": string, "purpose": string, "authRequired": boolean, "requestSummary"?: string, "responseSummary"?: string, "relatedFeature"?: string }],
  "frontend": {
    "pages": [{ "name": string, "path"?: string, "description"?: string }],
    "components": [{ "name": string, "description"?: string }],
    "hooks": [{ "name": string, "description"?: string }],
    "state": string[]
  },
  "files": [{ "path": string, "type": "file"|"folder", "description"?: string, "exists"?: boolean }],   // mark "exists": true for anything already in the project's file list below — never propose recreating it
  "tasks": [{
    "id": string,                                     // e.g. "TASK-001", unique across the plan
    "title": string,
    "description": string,
    "type": "setup"|"frontend"|"backend"|"database"|"authentication"|"integration"|"testing"|"configuration"|"documentation"|"security"|"deployment",
    "priority": "critical"|"high"|"medium"|"low",
    "complexity": "small"|"medium"|"large"|"complex",
    "dependencies": string[],                          // ids of tasks that must complete first — empty array if none
    "affectedFiles": string[],
    "acceptanceCriteria": string[],                     // concrete, testable statements — never vague
    "recommendedAgent"?: "planner"|"frontend"|"backend"|"database"|"testing"|"devops"|"security"  // a NARROWER set than "type" above — e.g. an authentication task has type "authentication" but recommendedAgent "backend" or "security", never "authentication"
  }],
  "executionOrder": string[],                            // every task id, exactly once, ordered so dependencies always precede dependents — never a circular order
  "risks": [{ "severity": "low"|"medium"|"high"|"critical", "description": string, "mitigation": string }],
  "assumptions": string[],                                // every assumption you made, stated plainly
  "security": [{ "requirement": string, "description"?: string }],
  "nonFunctionalRequirements": [{ "category": "performance"|"security"|"scalability"|"accessibility"|"responsiveness"|"maintainability"|"observability"|"reliability", "description": string }],
  "conflicts": [{ "description": string, "optionsDetected": string[] }]  // populate ONLY if the user's request contradicts itself (e.g. two different databases) — never silently pick one
}`;

const QUALITY_RULES = `Rules you must always follow:
- Never present something the user didn't say as an "explicit" requirement — anything you add yourself belongs in "inferred", clearly labeled.
- Every assumption you make must appear in "assumptions".
- If the request contains a real technology contradiction (e.g. "use MongoDB" and later "use PostgreSQL"), report it in "conflicts" instead of silently choosing one.
- Do not block planning on missing information — record it in "requirements.missing" and make a reasonable assumption instead.
- Never invent a circular task dependency, and never list a task id in "dependencies" or "executionOrder" that isn't one of your own "tasks" ids.
- When a task builds a component that imports/renders another task's component (composition), the COMPOSING task depends on the composed one, never the reverse — a task must never be scheduled before something it imports, since whoever builds it has no way to see what it actually exports. E.g. a TaskList task that renders TaskItem depends on the TaskItem task, not the other way around.
- Always include one task, of "type": "frontend" (so the Frontend Agent that exists today can actually run it), whose job is to wire the feature's top-level component into the project's real entry point/page so it's actually visible when the app runs — depending on every task whose output it needs to render. A plan whose components are never imported by anything the app renders is not a working feature.
- Every task's "acceptanceCriteria" must be concrete and testable ("User can register using email and password"), never vague ("implement authentication").
- Respect the project's existing files and technology choices shown below — do not propose recreating something that already exists; mark it "exists": true in "files" instead.
- You are producing a PLAN ONLY. Never include actual source code, full file contents, or shell/terminal commands anywhere in the response — only descriptions, paths, and structured metadata.
- Respond with JSON and nothing else.`;

const EXECUTION_REALITY = `Critical constraint on what can actually be built right now:
- Only ONE agent exists today: the Frontend Agent. It can only execute tasks whose "type" is "frontend" (or whose "recommendedAgent" is "frontend"). Tasks of any other type ("backend", "database", "authentication", "testing", "devops", "security", "setup", "integration", "configuration", "documentation", "deployment") have NO agent to build them — they will sit forever, and any frontend task that "depends on" one of them will be permanently blocked, since its dependency can never complete.
- The project's stored configuration below (frontend/backend/database/authentication/styling/deployment) is a DEFAULT for when server-side work is genuinely needed — it is NOT a mandate to always include a backend or database. Prefer the user's literal request over these defaults.
- Whenever the user's request can be fully satisfied with a self-contained, client-side implementation (plain HTML/CSS/JS, or a frontend framework running entirely in the browser, using the browser's own storage such as localStorage for persistence), produce a plan made ENTIRELY of "frontend"-type tasks with no backend/database/authentication tasks at all — even if the project's stored configuration lists a backend or database. Record this simplification in "assumptions" (e.g. "Data is stored in the browser via localStorage; no backend/database was requested and none is required for a single-user to-do list").
- Only introduce backend, database, authentication, or other non-frontend tasks when the request genuinely cannot be satisfied without them — e.g. it explicitly asks for multiple users, accounts synced across devices, payments, sending email, or server-side data multiple people share. When you do, say so plainly in "assumptions" so the user understands those specific tasks won't be buildable yet.`;

export function buildPlannerSystemPrompt(context: PlannerContext): string {
  return `You are the Mingo AI Planner Agent — you turn a natural-language software request into a structured, machine-readable development plan for the project "${context.project.name}".

This project's current configuration:
- Frontend: ${context.project.frontend}
- Backend: ${context.project.backend}
- Database: ${context.project.database}
- Authentication: ${context.project.authentication}
- Styling: ${context.project.styling}
- Deployment target: ${context.project.deployment}

You do not write code, modify files, run commands, install packages, or execute anything — you only produce the plan. Future specialized agents will consume your output to do the actual work.

${EXECUTION_REALITY}

${QUALITY_RULES}

${OUTPUT_SHAPE}`;
}

function summarizeFiles(context: PlannerContext): string {
  if (context.files.length === 0) return '(empty — no files exist in this project yet)';

  return context.files
    .slice(0, 300)
    .map((file) => `- ${file.path} (${file.type}${file.language ? `, ${file.language}` : ''})`)
    .join('\n');
}

function summarizeDependencies(context: PlannerContext): string {
  const deps = context.dependencies.dependencies ?? {};
  const devDeps = context.dependencies.devDependencies ?? {};
  const names = [...Object.keys(deps), ...Object.keys(devDeps)];

  if (names.length === 0) return '(none declared yet)';
  return names.join(', ');
}

function summarizeConversation(context: PlannerContext): string {
  if (context.conversation.length === 0) return '(no related conversation)';

  return context.conversation
    .map((message) => `${message.role}: ${message.content.slice(0, 500)}`)
    .join('\n');
}

export function buildPlannerUserPrompt(prompt: string, context: PlannerContext): string {
  return `User's request:
"""
${prompt}
"""

Current project context (use this to avoid re-planning what already exists):

Workspace status: ${context.workspace?.status ?? 'unknown'}
Manifest: ${
    context.manifest
      ? `framework=${context.manifest.framework}, language=${context.manifest.language}, files=${context.manifest.files}, folders=${context.manifest.folders}, entryPoints=[${context.manifest.entryPoints.join(', ')}]`
      : '(not available)'
  }

Existing files:
${summarizeFiles(context)}

Declared dependencies: ${summarizeDependencies(context)}

Recent workspace activity:
${context.recentChanges.length ? context.recentChanges.map((c) => `- ${c}`).join('\n') : '(none)'}

Relevant recent conversation:
${summarizeConversation(context)}

Produce the plan now, as a single JSON object matching the shape you were given.`;
}

/** Feeds a failed attempt's issues back to the model for a corrected retry (spec §36). */
export function buildCorrectionPrompt(previousRaw: string, issues: string[]): string {
  return `Your previous response was invalid. Problems found:
${issues.map((issue) => `- ${issue}`).join('\n')}

Your previous response was:
"""
${previousRaw.slice(0, 4000)}
"""

Fix every issue above and respond again with a single corrected JSON object matching the required shape exactly. Do not explain the fix — respond with JSON only.`;
}
