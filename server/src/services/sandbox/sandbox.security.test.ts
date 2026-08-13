import { describe, expect, it } from 'vitest';
import { assertSafeEnv, buildSandboxEnv, isForbiddenPath } from './sandbox.security';

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

describe('buildSandboxEnv', () => {
  it('always forces NODE_ENV=test and CI=true regardless of the host environment', () => {
    const env = buildSandboxEnv();
    expect(env.NODE_ENV).toBe('test');
    expect(env.CI).toBe('true');
  });

  it('never includes a Mingo server secret var', () => {
    const env = buildSandboxEnv();
    expect(env.MONGODB_URI).toBeUndefined();
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.CLERK_SECRET_KEY).toBeUndefined();
  });
});

describe('assertSafeEnv', () => {
  it('passes for a clean env', () => {
    expect(() => assertSafeEnv({ NODE_ENV: 'test', PATH: '/usr/bin' })).not.toThrow();
  });

  it('blocks a production-looking MongoDB Atlas connection string', () => {
    expect(() => assertSafeEnv({ SOME_VAR: 'mongodb+srv://user:pass@cluster0.mongodb.net/db' })).toThrow(
      'Test execution blocked because database environment could not be verified.'
    );
  });
});
