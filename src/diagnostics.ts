/**
 * Diagnostics — shared by every stage (LANGUAGE.md §9).
 *
 * A diagnostic carries a stable `AHxxxx` code, Amharic message text, and an
 * inclusive 1-based position span whose columns count code points. The code is
 * what tooling matches on and is rendered as part of the message (§9.1); the
 * Amharic text is what a learner reads and may be reworded between releases.
 */

export type Stage = 'lexer' | 'parser' | 'runtime';

export interface Diagnostic {
  /** Stable code from LANGUAGE.md §9.2, e.g. `AH1001`. */
  readonly code: string;
  /** Amharic message, without the bracketed code. */
  readonly message: string;
  readonly line: number;
  /** Inclusive, 1-based, counted in code points. */
  readonly startCol: number;
  /** Inclusive, 1-based, counted in code points. */
  readonly endCol: number;
  readonly stage: Stage;
}

// ---------------------------------------------------------------------------
// Lexical codes (§9.2)
// ---------------------------------------------------------------------------

export const AH1001 = 'AH1001';
export const AH1002 = 'AH1002';
export const AH1003 = 'AH1003';
export const AH1004 = 'AH1004';
export const AH1005 = 'AH1005';

/** Amharic message text, keyed by code. */
export const MESSAGES: Readonly<Record<string, string>> = {
  [AH1001]: 'የማይታወቅ ካራክተር አለ።',
  [AH1002]: 'የመስመር መጀመሪያ ክፍተት ስተት፡',
  [AH1003]: 'ያልተሟላ ፅሑፍ',
  [AH1004]: '"ድረስ" ይጠበቃል።',
  [AH1005]: 'የግዕዝ ቁጥር አጻጻፍ ስተት።',
};

export function diagnostic(
  code: string,
  stage: Stage,
  line: number,
  startCol: number,
  endCol: number,
  message?: string,
): Diagnostic {
  return {
    code,
    message: message ?? MESSAGES[code] ?? code,
    line,
    startCol,
    endCol,
    stage,
  };
}

/**
 * Sorts diagnostics into source order: line, then start column, then end
 * column. Every stage returns its diagnostics through this so the order is
 * the same no matter what order problems were discovered in (§3.9).
 */
export function sortDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort(
    (a, b) => a.line - b.line || a.startCol - b.startCol || a.endCol - b.endCol,
  );
}

/** The one-line header of a rendered diagnostic (§9.1). */
export function formatDiagnostic(d: Diagnostic): string {
  return `[${d.code}] ${d.message}: መስመር ${d.line} ላይ: ${d.startCol}ኛው ካራክተር`;
}
