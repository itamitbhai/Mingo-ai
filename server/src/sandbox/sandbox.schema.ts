import { CreateSandboxRunInput } from 'shared';

export { createSandboxRunSchema } from 'shared';
export type { CreateSandboxRunInput } from 'shared';

/** Normalizes the already-Zod-validated request body into a `{command, args}` pair, parsing
 *  `commandLine` through `sandbox.security.ts`'s `parseCommandLine` when that's what was given —
 *  throws (via the caller) rather than silently guessing when parsing fails. */
export function toSandboxCommand(body: CreateSandboxRunInput): { command?: string; args?: string[]; commandLine?: string } {
  if (body.command) {
    return { command: body.command, args: body.args ?? [] };
  }
  return { commandLine: body.commandLine };
}
