/**
 * Parser diagnostic text (LANGUAGE.md §9).
 *
 * The code identifies the problem; this text explains it to a learner. Where
 * an error has an obvious fix, the message shows it — a beginner reading
 * `"፦" ይጠበቃል።` learns less than one who is shown the shape to write.
 */

// ---------------------------------------------------------------------------
// Brackets and blocks
// ---------------------------------------------------------------------------

export function missingCloser(closer: ')' | ']', openLine: number): string {
  const name = closer === ')' ? 'ቅንፍ' : 'መረባ ቅንፍ';
  return `የመዝጊያ ${name} "${closer}" ረስተዋል። የመክፈቻው በመስመር ${openLine} ላይ ነው።`;
}

export const EXPECTED_THEN = '"፦" ይጠበቃል። ብሎክ በ"፦" ይከፈታል።';

export const INLINE_BLOCK = 'የብሎኩ ይዘት በቀጣዩ መስመር፣ አራት ክፍተት ገብቶ መጻፍ አለበት።';

export const EMPTY_BLOCK = 'ብሎኩ ባዶ ነው። ቢያንስ አንድ ትእዛዝ ያስፈልጋል።';

export const EMPTY_CLASS_BODY = 'የክላሱ ይዘት ባዶ ነው።';

export function overIndented(expected: number, actual: number): string {
  return `ከሚያስፈልገው በላይ ክፍተት አለ። ${expected} ይጠበቃል፣ ${actual} ተገኝቷል።`;
}

// ---------------------------------------------------------------------------
// Word order — the mistake Ahadu is most likely to meet (§7.3, CHANGES C01)
// ---------------------------------------------------------------------------

export const CONDITION_BEFORE_IF = 'ሁኔታው ከ"ከሆነ" በፊት መምጣት አለበት። ለምሳሌ፦ ዕድሜ > 18 ከሆነ፦';

export const CONDITION_BEFORE_WHILE = 'ሁኔታው ከ"እስከሆነ ድረስ" በፊት መምጣት አለበት። ለምሳሌ፦ ቆጣሪ < 5 እስከሆነ ድረስ፦';

export const COLLECTION_BEFORE_FOREACH = 'ስብስቡ ከ"ለእያንዳንዱ" በፊት መምጣት አለበት። ለምሳሌ፦ ቤተሰብ ለእያንዳንዱ ስም፦';

export const FOREACH_NEEDS_NAME = 'ከ"ለእያንዳንዱ" በኋላ የተለዋጭ ስም ያስፈልጋል። ለምሳሌ፦ ቤተሰብ ለእያንዳንዱ ስም፦';

// ---------------------------------------------------------------------------
// Conditionals
// ---------------------------------------------------------------------------

export const ELIF_WITHOUT_IF = '"ግን" የሚመጣው ከ"ከሆነ" ብሎክ በኋላ ብቻ ነው።';

export const ELSE_WITHOUT_IF = '"አለበለዚያ" የሚመጣው ከ"ከሆነ" ብሎክ በኋላ ብቻ ነው።';

export const ELIF_NEEDS_IF = '"ግን" ሁኔታና "ከሆነ" ያስፈልገዋል። ለምሳሌ፦ ግን ዕድሜ > 12 ከሆነ፦';

// ---------------------------------------------------------------------------
// Functions and classes
// ---------------------------------------------------------------------------

export const RETURN_OUTSIDE_FUNCTION = '"ተመላሽ" በተግባር ውስጥ ብቻ ይሰራል።';

export const RETURN_IN_CONSTRUCTOR = '"ፍጠር" ዋጋ አይመልስም፤ "ተመላሽ" ያለ ዋጋ ብቻ ይጻፋል።';

export const INIT_OUTSIDE_CLASS = '"ፍጠር" የሚጻፈው በክላስ ውስጥ ብቻ ነው።';

export const ILLEGAL_CLASS_MEMBER = 'በክላስ ውስጥ ባህሪ፣ "ፍጠር" ወይም "ተግባር" ብቻ ይጻፋል።';

export const DUPLICATE_CONSTRUCTOR = '"ፍጠር" በአንድ ክላስ ውስጥ አንድ ጊዜ ብቻ ይጻፋል።';

export function attributeNeedsValue(name: string): string {
  return `ባህሪ "${name}" ነባሪ ዋጋ ያስፈልገዋል። ለምሳሌ፦ ${name} = 0`;
}

export function duplicateParameter(name: string): string {
  return `"${name}" የተደገመ የግቤት ስም ነው።`;
}

export const EXPECTED_FUNCTION_NAME = 'የተግባር ስም ይጠበቃል።';
export const EXPECTED_CLASS_NAME = 'የክላስ ስም ይጠበቃል።';
export const EXPECTED_PARENT_NAME = 'የወላጅ ክላስ ስም ይጠበቃል።';
export const EXPECTED_PARAMETER = 'የግቤት ስም ይጠበቃል።';
export const EXPECTED_LPAREN = 'የመክፈቻ ቅንፍ "(" ይጠበቃል።';

// ---------------------------------------------------------------------------
// Expressions and assignment
// ---------------------------------------------------------------------------

export const EXPECTED_EXPRESSION = 'እዚህ ላይ ዋጋ ይጠበቃል።';

export const EXPECTED_VARIABLE_NAME = 'የተለዋጭ ስም ይጠበቃል።';

export const EXPECTED_MEMBER_NAME = 'ከ"." በኋላ የባህሪ ወይም የዘዴ ስም ይጠበቃል።';

export const TRAILING_COMMA = 'ተጨማሪ ኮማ አለ።';

export const CHAINED_COMPARISON = 'ሁለት ማወዳደሪያዎችን በአንድ ላይ ማስቀመጥ አይቻልም። በ"እና" ይለያዩ፦ ሀ < ለ እና ለ < ሐ';

export const CHAINED_ASSIGNMENT = 'ሰንሰለት ምደባ አይቻልም። በየራሱ መስመር ይጻፉ።';

export const UNEXPECTED_AFTER_STATEMENT = 'ከትእዛዙ በኋላ ያልተጠበቀ ነገር አለ።';

export const SLICE_ASSIGNMENT = 'ቁራጭ መቀየር አይቻልም። "አዋህድ" ወይም "ሰርዝ" ይጠቀሙ።';

export const INVALID_TARGET = 'ለዚህ ነገር ዋጋ መስጠት አይቻልም።';

export function declarationNeedsValue(name: string): string {
  return `"${name}" መጀመሪያ ዋጋ ያስፈልገዋል። ለምሳሌ፦ ቁጥር ${name} = 0`;
}

export function reservedWord(word: string): string {
  return `"${word}" ለወደፊት የተያዘ ቃል ነው፤ አሁን አይሰራም።`;
}
