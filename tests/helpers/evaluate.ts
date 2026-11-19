/** Compact helpers for interpreter tests, over `runSource`. */

import { runSource } from './run-source.js';
import type { RunSourceOptions } from './run-source.js';

/** The lines a program printed, asserting it ran clean. */
export function out(source: string, options: RunSourceOptions = {}): string[] {
  const result = runSource(source, options);
  if (result.errors.length > 0) {
    const shown = result.errors.map((e) => `${e.code} ${e.line}:${e.startCol} ${e.message}`);
    throw new Error(`unexpected ${result.stoppedAt ?? 'stage'} error: ${shown.join(' | ')}`);
  }
  return result.output;
}

/** The single line a one-`ጻፍ` program printed. */
export function printed(source: string, options: RunSourceOptions = {}): string {
  const lines = out(source, options);
  if (lines.length !== 1) throw new Error(`expected 1 line, got ${lines.length}`);
  return lines[0] as string;
}

/** What `ጻፍ(<expr>)` shows — the usual way to check a value (§8.1). */
export function shows(expression: string): string {
  return printed(`ጻፍ(${expression})`);
}

/** The diagnostic codes a program produced, in order. */
export function codes(source: string, options: RunSourceOptions = {}): string[] {
  return runSource(source, options).errors.map((e) => e.code);
}

/** The first diagnostic's code, or null if the program ran clean. */
export function code(source: string, options: RunSourceOptions = {}): string | null {
  return codes(source, options)[0] ?? null;
}

/** The first diagnostic's Amharic message. */
export function message(source: string, options: RunSourceOptions = {}): string {
  return runSource(source, options).errors[0]?.message ?? '';
}

/** The rendered value of the program's last statement, or null for ምንም. */
export function value(source: string, options: RunSourceOptions = {}): string | null {
  const result = runSource(source, options);
  if (result.errors.length > 0) {
    throw new Error(`unexpected error: ${result.errors[0]?.code ?? ''}`);
  }
  return result.value;
}

/** The call stack a runtime error carried, as `name:line` pairs, outermost first. */
export function frames(source: string, options: RunSourceOptions = {}): string[] {
  return runSource(source, options).frames.map((f) => `${f.name}:${f.line}`);
}

export { runSource };
