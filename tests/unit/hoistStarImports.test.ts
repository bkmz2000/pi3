/**
 * Star-import hoisting for the plain-script runner path.
 *
 * The runner indents a plain script into `async def __run():`, where Python
 * rejects `from x import *`. These cases pin the split that keeps such
 * programs runnable.
 */
import { describe, test, expect } from '@jest/globals';
import { hoistStarImports } from '../../src/runner/hoistStarImports';

describe('hoistStarImports', () => {
  test('lifts a top-level star-import out of the body', () => {
    const { prelude, body } = hoistStarImports('from math import *\nprint(pi)');
    expect(prelude).toBe('from math import *');
    expect(body).toBe('\nprint(pi)');
  });

  test('keeps line numbers stable by blanking the hoisted line', () => {
    const src = 'x = 1\nfrom random import *\ny = 2';
    const { body } = hoistStarImports(src);
    expect(body.split('\n')).toHaveLength(src.split('\n').length);
    expect(body.split('\n')[2]).toBe('y = 2');
  });

  test('hoists every star-import, in order', () => {
    const { prelude } = hoistStarImports('from math import *\nfrom pi3.testing import *\n');
    expect(prelude).toBe('from math import *\nfrom pi3.testing import *');
  });

  test('leaves an indented star-import alone (Python rejects it either way)', () => {
    const src = 'def f():\n    from math import *';
    const { prelude, body } = hoistStarImports(src);
    expect(prelude).toBe('');
    expect(body).toBe(src);
  });

  test('leaves named and plain imports in the body', () => {
    const src = 'import math\nfrom random import randint\nprint(1)';
    const { prelude, body } = hoistStarImports(src);
    expect(prelude).toBe('');
    expect(body).toBe(src);
  });

  test('does not match a star-import inside a string literal', () => {
    const src = 's = "from math import *"';
    const { prelude, body } = hoistStarImports(src);
    expect(prelude).toBe('');
    expect(body).toBe(src);
  });

  test('returns an empty prelude for source without star-imports', () => {
    const { prelude, body } = hoistStarImports('');
    expect(prelude).toBe('');
    expect(body).toBe('');
  });
});
