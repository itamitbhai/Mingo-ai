import { z } from 'zod';

/** Server-only — this is the query shape GitHub's own redirect carries, never something a client
 *  constructs, so it doesn't belong in `shared`. */
export const githubCallbackQuerySchema = z.object({
  code: z.string().min(1, 'Missing GitHub authorization code'),
  state: z.string().min(1, 'Missing GitHub authorization state'),
});

export type GithubCallbackQuery = z.infer<typeof githubCallbackQuerySchema>;
