/**
 * The one diagnostic renderer, shared by the CLI, the REPL, and — once it
 * exists — the playground (TOOLING.md §1.3, LANGUAGE.md §9.1).
 *
 * The code is always part of the message, so a learner can quote an error
 * precisely when asking for help.
 */

import type { Diagnostic } from '../diagnostics.js';
import type { Frame } from '../interpreter/index.js';
import type { Palette } from './color.js';

const RULE = '-'.repeat(60);

/**
 * One source line with a caret under the offending span.
 *
 * The caret is placed by counting code points, which is right for a terminal
 * that draws one cell per code point. Ethiopic is often drawn wider than
 * that, and then the caret sits beside its span rather than beneath it —
 * nothing here can fix that, which is why the line and column in the message
 * above are the reliable part (TOOLING.md §1).
 */
export function sourceFrame(source: string, d: Diagnostic, colors: Palette): string {
  const line = source.split(/\r\n|\r|\n/)[d.line - 1] ?? '';
  const gutter = String(d.line);
  const pad = ' '.repeat(gutter.length + 2 + Math.max(0, d.startCol - 1));
  const carets = '^'.repeat(Math.max(1, d.endCol - d.startCol + 1));
  return `\n    ${colors.dim(`${gutter}:`)} ${line}\n    ${pad}${colors.caret(carets)}\n`;
}

/**
 * The call traceback after a runtime error: outermost frame first, each at the
 * line it was running, with the global one named ዋና ፕሮግራም (§9.1).
 */
export function traceback(frames: readonly Frame[], colors: Palette): string {
  if (frames.length <= 1) return '';

  const lines = frames.map((frame, depth) =>
    depth === 0
      ? ` መስመር ${frame.line} ላይ ${frame.name}`
      : `${'  '.repeat(depth)}↓ መስመር ${frame.line} ላይ ${frame.name}`,
  );

  return colors.dim(` የጥሪ መልሶ ምልከታ ፦\n${RULE}\n${lines.join('\n')}\n${RULE}\n`);
}

/** A diagnostic as a learner reads it: header, source frame, and any traceback. */
export function renderDiagnostic(
  source: string,
  d: Diagnostic,
  colors: Palette,
  frames: readonly Frame[] = [],
): string {
  const header = `${colors.error(`[${d.code}]`)} ${d.message}: መስመር ${d.line} ላይ: ${d.startCol}ኛው ካራክተር`;
  const stack = traceback(frames, colors);
  return `${header}\n${sourceFrame(source, d, colors)}\n${stack === '' ? '' : `${stack}\n`}`;
}
