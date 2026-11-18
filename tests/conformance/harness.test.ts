import { describe, expect, it } from 'vitest';
import { parseCase } from './harness.js';

describe('conformance header parsing', () => {
  it('collects expected output lines in order, preserving leading spaces', () => {
    const c = parseCase('x', 'x.ahadu', '# expect: ሀ\n# expect:   ለ\nጻፍ("ሀ")\n');
    expect(c.expectedOutput).toEqual(['ሀ', '  ለ']);
  });

  it('collects an expected error with and without a position', () => {
    const c = parseCase('x', 'x.ahadu', '# expect-error: AH3003\n# expect-error: AH3001 at 4:12\n');
    expect(c.expectedErrors).toEqual([{ code: 'AH3003' }, { code: 'AH3001', line: 4, col: 12 }]);
  });

  it('ignores ordinary comments', () => {
    const c = parseCase('x', 'x.ahadu', '# ይህ አስተያየት ነው\nጻፍ(1)\n');
    expect(c.expectedOutput).toEqual([]);
    expect(c.expectedErrors).toEqual([]);
  });

  it('does not read an expectation out of a string literal', () => {
    const c = parseCase('x', 'x.ahadu', 'ጻፍ("# expect: አይደለም")\n');
    expect(c.expectedOutput).toEqual([]);
  });
});
