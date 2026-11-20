/**
 * The examples gallery (SITE.md §5).
 *
 * The programs are the repository's own `examples/*.ahadu` — the same files
 * the conformance suite runs and the playground's menu loads. A gallery with
 * its own copies would be a third version to keep in step, and the one most
 * likely to rot.
 *
 * Each is rendered as a runnable snippet, so it is executed at build time like
 * every other sample on the site.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Strings } from './strings.js';

/** `01-ሰላም.ahadu` → `ሰላም`. */
export function exampleName(file: string): string {
  return file
    .replace(/\.ahadu$/, '')
    .replace(/^\d+-/, '')
    .replace(/-/g, ' ');
}

export function examplesBody(s: Strings, repoDir: string): string {
  const dir = join(repoDir, 'examples');
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.ahadu'))
    .sort();

  const parts = files.map((file) => {
    const code = readFileSync(join(dir, file), 'utf8').replace(/\n+$/, '');
    // 08-ግቤት reads from አንብብ; give it something to read so the build can run
    // it like any other sample rather than making an exception for it.
    const input = code.includes('አንብብ') ? '\n```ግቤት\nዓለም\n```\n' : '';
    return `\n## ${exampleName(file)}\n\n\`\`\`ahadu\n${code}\n\`\`\`\n${input}`;
  });

  return `\n${parts.join('\n')}`;
}
