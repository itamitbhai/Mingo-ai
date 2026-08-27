import { describe, expect, it } from 'vitest';
import { isForbiddenPath } from './sandbox.security';

describe('isForbiddenPath', () => {
  it.each(['.env', '.env.production', 'id_rsa.pem', 'credentials.json', '.git/config', 'node_modules/foo/index.js'])(
    'blocks %s',
    (path) => {
      expect(isForbiddenPath(path)).toBe(true);
    }
  );

  it.each(['server/tests/todo.test.js', 'package.json'])('allows %s', (path) => {
    expect(isForbiddenPath(path)).toBe(false);
  });
});
