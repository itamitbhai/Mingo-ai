import { z } from 'zod';
import { DeploymentEnvironment } from 'shared';

const enumValues = <T extends Record<string, string>>(e: T) => Object.values(e) as [T[keyof T], ...T[keyof T][]];

/** Server-only query shapes — the request bodies these pair with (`deploymentConfigSchema`,
 *  `createEnvironmentVariableSchema`, ...) already live in `shared` since the client builds them
 *  directly; these are plain `?environment=` query-string reads with nothing client-specific to share. */
export const environmentQuerySchema = z.object({
  environment: z.enum(enumValues(DeploymentEnvironment)).optional(),
});

export type EnvironmentQuery = z.infer<typeof environmentQuerySchema>;
