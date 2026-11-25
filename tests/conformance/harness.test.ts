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

  it('collects input lines in order, so an interactive program is testable', () => {
    const c = parseCase('x', 'x.ahadu', '# input: 12\n# input: 30\nጻፍ(አንብብ())\n');
    expect(c.input).toEqual(['12', '30']);
  });

  it('keeps an empty input line, which is what pressing Enter sends', () => {
    const c = parseCase('x', 'x.ahadu', '# input:\n# input: 7\n');
    expect(c.input).toEqual(['', '7']);
  });

  it('has no input when none is declared', () => {
    expect(parseCase('x', 'x.ahadu', 'ጻፍ(1)\n').input).toEqual([]);
  });
});
