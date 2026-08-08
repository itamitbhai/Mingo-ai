import { describe, expect, it } from 'vitest';
import { assertSafePath, escapeRegExp, getBaseName, getParentPath } from './file-validation.service';

describe('assertSafePath', () => {
  it('accepts a normal nested path', () => {
    expect(assertSafePath('src/components/Navbar.tsx')).toBe('src/components/Navbar.tsx');
  });

  it('accepts dotfiles', () => {
    expect(assertSafePath('.env.example')).toBe('.env.example');
  });

  it('trims accidental duplicate/trailing slashes', () => {
    expect(assertSafePath('src//components/')).toBe('src/components');
  });

  it.each([
    ['../secret', 'parent traversal'],
    ['../../etc/passwd', 'deep parent traversal'],
    ['/etc/passwd', 'absolute path'],
    ['C:/Windows/system32', 'windows drive path'],
    ['a/b/../../c', 'embedded traversal segment'],
    ['a\0b', 'null byte'],
    ['a\\b', 'backslash'],
    ['', 'empty path'],
  ])('rejects %s (%s)', (input) => {
    expect(() => assertSafePath(input)).toThrow();
  });
});

describe('getParentPath', () => {
  it('returns null for a root-level path', () => {
    expect(getParentPath('App.tsx')).toBeNull();
  });

  it('returns the parent for a nested path', () => {
    expect(getParentPath('src/components/Navbar.tsx')).toBe('src/components');
  });
});

describe('getBaseName', () => {
  it('returns the whole string for a root-level path', () => {
    expect(getBaseName('README.md')).toBe('README.md');
  });

  it('returns the last segment for a nested path', () => {
    expect(getBaseName('src/components/Navbar.tsx')).toBe('Navbar.tsx');
  });
});

describe('escapeRegExp', () => {
  it('escapes regex-significant characters', () => {
    expect(escapeRegExp('a.b+c')).toBe('a\\.b\\+c');
  });
});
