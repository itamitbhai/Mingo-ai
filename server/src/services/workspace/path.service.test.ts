import { describe, expect, it } from 'vitest';
import { assertValidMove } from './path.service';

describe('assertValidMove', () => {
  it('rejects moving something into itself', () => {
    expect(() => assertValidMove('src/components', 'src/components')).toThrow(/same/i);
  });

  it('rejects moving a folder into one of its own descendants', () => {
    expect(() => assertValidMove('src/components', 'src/components/ui')).toThrow(/descendant/i);
  });

  it('allows a valid move to an unrelated destination', () => {
    expect(() => assertValidMove('src/components', 'src/ui')).not.toThrow();
  });

  it('does not falsely match a sibling with a shared path prefix', () => {
    // "src/components-old" starts with "src/components" as a string, but isn't a descendant
    expect(() => assertValidMove('src/components', 'src/components-old')).not.toThrow();
  });
});
