import { describe, expect, it } from 'vitest';
import { filterForbiddenPaths, isForbiddenPath, scanForSecrets } from './testing.security';

describe('isForbiddenPath', () => {
  it.each([
    '.env',
    '.env.local',
    '.env.production',
    'server/.env',
    'id_rsa.pem',
    'certs/server.key',
    'credentials.json',
    'secrets.yaml',
    '.git/config',
    'nested/.git/HEAD',
    'node_modules/mongoose/index.js',
    'server/node_modules/pkg/index.js',
  ])('blocks %s', (path) => {
    expect(isForbiddenPath(path)).toBe(true);
  });

  it.each(['server/tests/todo.test.js', 'client/src/components/Todo.test.tsx', 'package.json', 'vitest.config.ts'])(
    'allows %s',
    (path) => {
      expect(isForbiddenPath(path)).toBe(false);
    }
  );
});

describe('filterForbiddenPaths', () => {
  it('drops only the forbidden entries', () => {
    const result = filterForbiddenPaths(['server/tests/todo.test.js', '.env', 'package.json', '.git/config']);
    expect(result).toEqual(['server/tests/todo.test.js', 'package.json']);
  });
});

describe('scanForSecrets', () => {
  it('returns no issues for ordinary test content', () => {
    const content = `
      import { describe, it, expect } from 'vitest';
      describe('todo service', () => {
        it('creates a todo', () => {
          expect(1 + 1).toBe(2);
        });
      });
    `;
    expect(scanForSecrets(content)).toEqual([]);
  });

  it('flags an AWS access key', () => {
    const issues = scanForSecrets('const key = "AKIAABCDEFGHIJKLMNOP";');
    expect(issues.some((issue) => issue.includes('AWS access key'))).toBe(true);
  });

  it('flags a MongoDB connection string with embedded credentials', () => {
    const issues = scanForSecrets('const uri = "mongodb+srv://admin:hunter2@cluster0.mongodb.net/db";');
    expect(issues.some((issue) => issue.includes('MongoDB connection string'))).toBe(true);
  });

  it('flags a private key block', () => {
    const issues = scanForSecrets('-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAK...\n-----END RSA PRIVATE KEY-----');
    expect(issues.some((issue) => issue.includes('private key block'))).toBe(true);
  });

  it('flags a hardcoded password literal', () => {
    const issues = scanForSecrets('const config = { password: "SuperSecret1" };');
    expect(issues.some((issue) => issue.includes('hardcoded password'))).toBe(true);
  });

  it('does not flag a process.env reference as a secret', () => {
    const issues = scanForSecrets('const uri = process.env.MONGODB_URI;');
    expect(issues).toEqual([]);
  });
});
