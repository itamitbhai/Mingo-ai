import { describe, expect, it } from 'vitest';
import { filterForbiddenPaths, isForbiddenPath } from './database.security';

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

  it.each([
    'server/models/Todo.js',
    'server/database/connection.js',
    'package.json',
    'README.md',
    'server/services/environment.service.ts',
  ])('allows %s', (path) => {
    expect(isForbiddenPath(path)).toBe(false);
  });
});

describe('filterForbiddenPaths', () => {
  it('drops only the forbidden entries', () => {
    const result = filterForbiddenPaths(['server/models/Todo.js', '.env', 'package.json', '.git/config']);
    expect(result).toEqual(['server/models/Todo.js', 'package.json']);
  });
});
