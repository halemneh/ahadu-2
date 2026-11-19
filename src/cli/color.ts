/**
 * Terminal colour (TOOLING.md §1).
 *
 * Used sparingly: a diagnostic's code and caret, and the REPL's prompt. Off
 * unless the stream is a terminal, off when `NO_COLOR` is set to anything at
 * all — the de facto convention — and off when `--no-color` is passed.
 */

import { env } from 'node:process';

export interface Palette {
  readonly error: (text: string) => string;
  readonly caret: (text: string) => string;
  readonly dim: (text: string) => string;
  readonly bold: (text: string) => string;
  readonly prompt: (text: string) => string;
}

const PLAIN: Palette = {
  error: (text) => text,
  caret: (text) => text,
  dim: (text) => text,
  bold: (text) => text,
  prompt: (text) => text,
};

function wrap(code: string): (text: string) => string {
  return (text) => `\u001B[${code}m${text}\u001B[0m`;
}

const COLORED: Palette = {
  error: wrap('1;31'), // bold red
  caret: wrap('31'), // red
  dim: wrap('2'),
  bold: wrap('1'),
  prompt: wrap('1;36'), // bold cyan
};

/** Something with the one field we need from a stream, so tests can pass a stub. */
export interface MaybeTty {
  readonly isTTY?: boolean | undefined;
}

/**
 * Whether to colour output written to `stream`.
 *
 * `requested` is false when `--no-color` was passed. `NO_COLOR` wins over a
 * terminal: its convention is that any value, including an empty one, means
 * no colour.
 */
export function colorEnabled(stream: MaybeTty, requested = true): boolean {
  if (!requested) return false;
  if (env.NO_COLOR !== undefined) return false;
  return stream.isTTY === true;
}

export function palette(enabled: boolean): Palette {
  return enabled ? COLORED : PLAIN;
}
