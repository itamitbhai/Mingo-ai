import { describe, expect, it } from 'vitest';
import { filterForbiddenPaths, isForbiddenPath } from './frontend.security';

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
    'node_modules/react/index.js',
    'src/node_modules/pkg/index.js',
  ])('blocks %s', (path) => {
    expect(isForbiddenPath(path)).toBe(true);
  });

  it.each([
    'src/components/ProductCard.tsx',
    'package.json',
    'README.md',
    'src/services/env.service.ts',
    'src/pages/environment-settings.tsx',
  ])('allows %s', (path) => {
    expect(isForbiddenPath(path)).toBe(false);
  });
});

describe('filterForbiddenPaths', () => {
  it('drops only the forbidden entries', () => {
    const result = filterForbiddenPaths(['src/App.tsx', '.env', 'package.json', '.git/config']);
    expect(result).toEqual(['src/App.tsx', 'package.json']);
  });
});
