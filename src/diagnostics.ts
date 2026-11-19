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

// ---------------------------------------------------------------------------
// Syntactic codes (§9.2)
// ---------------------------------------------------------------------------

export const AH2001 = 'AH2001';
export const AH2002 = 'AH2002';
export const AH2003 = 'AH2003';
export const AH2004 = 'AH2004';
export const AH2005 = 'AH2005';
export const AH2006 = 'AH2006';
export const AH2007 = 'AH2007';
export const AH2008 = 'AH2008';
export const AH2009 = 'AH2009';
export const AH2010 = 'AH2010';
export const AH2011 = 'AH2011';
export const AH2012 = 'AH2012';
export const AH2013 = 'AH2013';
export const AH2014 = 'AH2014';
export const AH2015 = 'AH2015';

// ---------------------------------------------------------------------------
// Runtime codes (§9.2)
// ---------------------------------------------------------------------------

export const AH3001 = 'AH3001';
export const AH3002 = 'AH3002';
export const AH3003 = 'AH3003';
export const AH3004 = 'AH3004';
export const AH3005 = 'AH3005';
export const AH3006 = 'AH3006';
export const AH3007 = 'AH3007';
export const AH3008 = 'AH3008';
export const AH3009 = 'AH3009';
export const AH3010 = 'AH3010';
export const AH3011 = 'AH3011';
export const AH3012 = 'AH3012';
export const AH3013 = 'AH3013';
export const AH3014 = 'AH3014';
export const AH3015 = 'AH3015';
export const AH3017 = 'AH3017';
export const AH3018 = 'AH3018';

/**
 * Default Amharic text, keyed by code.
 *
 * Lexical codes stand alone. Parser codes name a general category and are
 * nearly always given a more specific message at the call site — see
 * `src/parser/messages.ts` — so these are the fallback a tool shows when no
 * detail was supplied.
 */
export const MESSAGES: Readonly<Record<string, string>> = {
  [AH1001]: 'የማይታወቅ ካራክተር አለ።',
  [AH1002]: 'የመስመር መጀመሪያ ክፍተት ስተት፡',
  [AH1003]: 'ያልተሟላ ፅሑፍ',
  [AH1004]: '"ድረስ" ይጠበቃል።',
  [AH1005]: 'የግዕዝ ቁጥር አጻጻፍ ስተት።',

  [AH2001]: 'የተሰበረ ህግ አለ።',
  [AH2002]: 'የመዝጊያ ቅንፍ ረስተዋል።',
  [AH2003]: '"ግን" ሁኔታና "ከሆነ" ያስፈልገዋል።',
  [AH2004]: 'ከዚህ በፊት "ከሆነ" የለም።',
  [AH2005]: '"ተመላሽ" በተግባር ውስጥ ብቻ ይሰራል።',
  [AH2006]: 'ብሎኩ ባዶ ነው።',
  [AH2007]: 'መጀመሪያ ዋጋ ያስፈልጋል።',
  [AH2008]: 'ሁለት ማወዳደሪያዎችን በአንድ ላይ ማስቀመጥ አይቻልም።',
  [AH2009]: 'ቁራጭ መቀየር አይቻልም።',
  [AH2010]: 'ለወደፊት የተያዘ ቃል ነው።',
  [AH2011]: 'ለዚህ ነገር ዋጋ መስጠት አይቻልም።',
  [AH2012]: 'የተደገመ የግቤት ስም አለ።',
  [AH2013]: 'በክላስ ውስጥ መሆን የማይገባው ነገር አለ።',
  [AH2014]: '"ፍጠር" ዋጋ አይመልስም።',
  [AH2015]: 'ከሚያስፈልገው በላይ ክፍተት አለ።',

  [AH3001]: 'ያልታወቀ ተለዋጭ',
  [AH3002]: 'ሕጋዊ ያለሆነ ተግባር',
  [AH3003]: 'በዘሮ ማካፈል አይቻልም።',
  [AH3004]: 'ይህ ፓወር አይሰራም።',
  [AH3005]: 'ሁኔታው እውነት ወይም ሃሰት መሆን አለበት።',
  [AH3006]: 'ቁጥሩ ከመጠን አለፈ።',
  [AH3007]: 'የቦታ ቁጥር ሙሉ ቁጥር መሆን አለበት።',
  [AH3008]: 'ከስብስቡ ውጪ ያለ ቦታ',
  [AH3009]: 'የተለዋጩ አይነት አይመጣጠንም።',
  [AH3010]: 'የገቡት ግቤቶች ቁጥር አይመጣጠንም።',
  [AH3011]: 'ያልታወቀ የወላጅ ክላስ',
  [AH3012]: 'ያልተገለጸ ባህሪ',
  [AH3013]: 'ይህ ሊጠራ አይችልም።',
  [AH3014]: 'ይህ ባህሪ የለውም።',
  [AH3015]: 'ጽሁፍን በቦታው መቀየር አይቻልም።',
  [AH3017]: 'የጥሪ ጥልቀት ከመጠን አለፈ።',
  [AH3018]: 'ፕሮግራሙ ከመጠን በላይ ረዘመ።',
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
