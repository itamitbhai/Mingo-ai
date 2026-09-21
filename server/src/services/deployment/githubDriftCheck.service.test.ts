import { describe, expect, it } from 'vitest';
import { computeGitBlobSha } from './githubDriftCheck.service';

describe('computeGitBlobSha', () => {
  it('matches the real `git hash-object` SHA for an empty file', () => {
    expect(computeGitBlobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });

  it('matches the real `git hash-object` SHA for "hello world\\n"', () => {
    expect(computeGitBlobSha('hello world\n')).toBe('3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  });

  it('produces a 40-character hex SHA-1 digest', () => {
    expect(computeGitBlobSha('anything')).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is sensitive to trailing-newline differences, same as real git', () => {
    expect(computeGitBlobSha('hello world')).not.toBe(computeGitBlobSha('hello world\n'));
  });
});
