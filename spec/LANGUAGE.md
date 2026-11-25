# Ahadu 2.0 — Language Specification

**Status**: Normative. This document is the single source of truth for the
Ahadu language. Where an implementation disagrees with this document, the
implementation is wrong.

**Version**: 2.0.0
**Supersedes**: the implicit specification embodied in two earlier,
non-public implementations — a Python one ("v1-py") and a TypeScript one
("v1-ts"). Every deliberate divergence from those is recorded in
[CHANGES-FROM-V1.md](./CHANGES-FROM-V1.md), which describes them in enough
detail to follow without access to either.

**Conventions**: MUST / MUST NOT / SHOULD / MAY carry their RFC 2119 meaning.
Code points are written `U+XXXX`. In grammar fragments, `·` marks a required
space.

---

## 1. Design principles

These are the tie-breakers. When a design question is open, the answer is
whichever option best satisfies the earlier principle.

1. **Amharic word order first.** Ahadu is not English with translated
   keywords. A conditional reads `ዕድሜ > 18 ከሆነ፦` — "if age is over 18" —
   because that is how the clause is ordered in Amharic. Any construct that
   requires Amharic speakers to think in English sentence order is a defect.
2. **Beginner-legible errors.** Every error is in Amharic, names the line and
   column, shows the offending source line, and says what to do about it. An
   error that only an implementer can decode is a defect.
3. **No silent surprises.** Ahadu prefers a clear error over a quiet coercion,
   a defaulted value, or an off-by-one. There is no implicit type conversion.
4. **Small surface.** One way to do each thing. Features are added only when a
   beginner curriculum needs them.
5. **Tooling is part of the language.** Tokens, AST, and evaluation steps are
   inspectable by design, because the interpreter is itself a teaching
   artifact. See [TOOLING.md](./TOOLING.md).

---

## 2. Source text

### 2.1 Encoding

- Source MUST be valid UTF-8. A decoder MUST replace malformed byte sequences
  with U+FFFD rather than aborting; the resulting U+FFFD is then reported as an
  illegal character (`AH1001`) at its position.
- A byte-order mark (U+FEFF) at the very start of the file MUST be skipped
  silently and MUST NOT occupy a column. A U+FEFF anywhere else is an illegal
  character.
- These format-control code points MUST be skipped silently wherever they
  appear **in code**, including inside identifiers, and MUST NOT occupy a
  column: U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+00AD (soft hyphen).
  Rationale: Ge'ez text pasted from word processors and the web routinely
  carries these, and one of them inside a name would otherwise split it in
  two for reasons invisible on screen.
- Inside a string literal they are **kept**, along with U+FEFF. A string is
  data, and silently altering the user's characters is worse than tolerating
  invisible formatting in it.

### 2.2 Lines and positions

- A line terminator is `\n`, `\r\n`, or a lone `\r`. Each produces exactly one
  NEWLINE token.
- Lines are numbered from 1. Columns are numbered from 1 and count **code
  points**, not UTF-16 code units and not bytes. A Ge'ez syllable is one
  column.
- Every token carries `line`, `startCol`, and `endCol`, all inclusive. A
  one-code-point token has `startCol == endCol`.

### 2.3 Comments

```ahadu
# ይህ አስተያየት ነው
ጻፍ("ሰላም")   # እና ይህም
```

- `#` begins a comment that runs to the end of the line. The `#` and the
  comment text produce no tokens.
- A `#` inside a string literal is ordinary text.
- There are **no block comments** in 2.0. (`"""` was declared but never
  implemented in v1-py; see CHANGES §C14.)

---

## 3. Lexical structure

### 3.1 Identifiers

An identifier is one or more *word characters*, where a word character is:

| Range | Contents |
| --- | --- |
| U+1200–U+135A | Ethiopic syllables |
| U+1380–U+139F | Ethiopic Supplement |
| U+2D80–U+2DDF | Ethiopic Extended |
| U+AB01–U+AB2F | Ethiopic Extended-A |
| `a`–`z`, `A`–`Z` | ASCII letters |
| `0`–`9` | ASCII digits |
| `_` | underscore |

Rules:

- An identifier MUST NOT begin with a digit.
- Ethiopic punctuation (U+1360–U+1368) is **not** a word character; it is
  punctuation (§3.5).
- Ethiopic digits and numerals (U+1369–U+137C) are **not** word characters
  either; they are number literals (§3.4.1), so `፩` is the number 1 and never
  part of a name.
- Identifiers are compared by exact code-point sequence. There is **no**
  normalization and no spelling-variant folding: `ሃና` and `ኃና` are two
  different variables. (Keywords are the sole exception — §3.2.)
- Identifiers are case-sensitive in their ASCII portion.

### 3.2 Keywords and spelling variants

Amharic admits several orthographic spellings of the same word. For
**keywords only**, all listed variants are accepted and collapse to one
meaning. This asymmetry with identifiers is deliberate: a learner must never
fail because they wrote `ከኆነ` instead of `ከሆነ`, but variable identity must stay
predictable.

| Meaning | Spellings accepted | Token |
| --- | --- | --- |
| if | `ከሆነ` `ከሖነ` `ከኆነ` | `IF` |
| else-if lead-in | `ግን` | `ELIF` |
| else | `አለበለዚያ` `ኣለበለዚያ` `ዓለበለዚያ` `ዐለበለዚያ` | `ELSE` |
| while (head) | `እስከሆነ` `እስከሖነ` `እስከኆነ` `ዕስከሆነ` `ዕስከሖነ` `ዕስከኆነ` | `WHILE` |
| while (tail, required) | `ድረስ` | — |
| return | `ተመላሽ` | `RETURN` |
| function | `ተግባር` | `FUNC` |
| class | `ክላስ` | `CLASS` |
| constructor | `ፍጠር` | `INIT` |
| and | `እና` `ዕና` `&` `&&` | `AND` |
| or | `ወይም` `\|` `\|\|` | `OR` |
| not | `ተቃርኖ` `!` | `NOT` |
| true | `እውነት` `ዕውነት` | `TRUE` |
| false | `ሃሰት` `ሀሰት` `ኅሰት` `ኃሰት` `ሓሰት` `ሐሰት` `ሃሠት` `ሀሠት` `ኅሠት` `ኃሠት` `ሓሠት` `ሐሠት` | `FALSE` |
| nothing | `ምንም` | `NOTHING` |
| type: number | `ቁጥር` | `TYPE_NUM` |
| type: boolean | `እውነታ` | `TYPE_BOOL` |
| type: string | `ጽሁፍ` `ፅሁፍ` | `TYPE_STRING` |
| type: list | `ስብስብ` | `TYPE_LIST` |

Keyword matching is **whole-word**: `ከሆነነገር` is one identifier, not `ከሆነ`
followed by `ነገር`. A keyword is recognized only when the maximal run of word
characters equals a listed spelling exactly.

Reserved for future use (recognized as keywords, no syntax in 2.0; using one is
error `AH2010`): `አዲስ`, `ለእያንዳንዱ`, `አቁም`, `ቀጥል`, `ፊደል`.

A reserved word has to be long enough to be worth the naming space it takes.
`ለ` was the obvious candidate for a future `for`, and is wrong for exactly
that reason: one of the commonest syllables in Amharic and the most natural
short variable name there is. `ለእያንዳንዱ` ("for each one") reads better in
Ahadu's condition-first order anyway — `ቤተሰብ ለእያንዳንዱ ስም፦`.

Built-in function names (`ጻፍ`, `አዋህድ`, `ሰርዝ`, `ርዝመት`, `አይነት`, `አንብብ`) are
**not** keywords. They are ordinary identifiers pre-bound in the global scope
(§8), and user code MAY shadow them.

### 3.3 The possessive prefix `የ`

Amharic expresses "the X of Y" with the prefix `የ` on Y: `የአበበ ዕድሜ` is
"Hailé's age". Ahadu supports this for attribute access.

The lexer MUST NOT split `የ` from the word it is attached to. Instead:

- A maximal word run that begins with `የ` (U+12E8) and has at least one further
  word character produces an `IDENTIFIER` token whose `name` is the **full**
  text (`የአበበ`) and whose `hasOfPrefix` flag is true, plus a `stem` field
  holding the text after `የ` (`አበበ`).
- A bare `የ` with no following word character is an illegal character
  (`AH1001`).

The parser decides what the prefix means (§6.4, §7.5). This resolves a real
v1-py defect in which every identifier beginning with `የ` — an extremely common
Amharic prefix — was silently torn in half.

### 3.4 Number literals

```
number := digit+ ( "." digit+ )?
```

- Digits are ASCII `0`–`9`. Ge'ez numerals are a separate literal form
  (§3.4.1).
- A number has at most one `.`, and the `.` MUST have at least one digit on
  each side. `5.` and `.5` are **not** numbers: `5.` lexes as `5` then `.`
  (which the parser rejects), and `.5` lexes as `.` then `5`.
- `1.2.3` lexes as `1.2`, `.`, `3` — a parse error, not a number.
- There are no separators, no exponent form, and no radix prefixes in 2.0.
- All numbers are IEEE-754 binary64 (§4.2).

Negative numbers exist and are written the obvious way — `-5`, `[-1፣ -2]`,
`ሀ = -ለ` — but the sign is **not** part of the literal: `-5` is the prefix
operator `-` applied to the literal `5` (§6.1, §6.2). The value is identical
either way; keeping the sign out of the literal is what makes `5-3` three
tokens (`5`, `-`, `3`) instead of two numbers in a row.

#### 3.4.1 Ge'ez numeral literals

Ethiopic numerals are accepted as number literals:

```ahadu
ጻፍ(፳፩)        # 21
ጻፍ(፫፻፳፩)      # 321
ጻፍ(፪፼)        # 20000
```

The numeral symbols and their values:

| Symbols | Values |
| --- | --- |
| `፩ ፪ ፫ ፬ ፭ ፮ ፯ ፰ ፱` | 1–9 (units) |
| `፲ ፳ ፴ ፵ ፶ ፷ ፸ ፹ ፺` | 10–90 (tens) |
| `፻` | ×100 (separator) |
| `፼` | ×10000 (separator) |

A literal is a maximal run of these symbols, read as:

1. Split the run on `፼`. The value is `Σ partᵢ × 10000ⁱ`, counting from the
   right.
2. Split each part on `፻`. Its value is `Σ subⱼ × 100ʲ`, counting from the
   right.
3. A *sub* contains at most one tens symbol followed by at most one units
   symbol; its value is their sum. A sub that is empty and precedes a
   separator is **1**, so `፻` alone is 100 and `፼` alone is 10000. A sub that
   is empty and trails a separator is 0.

Anything else in the run — a units symbol before a tens symbol, two units
symbols, more than one `፼` — is error `AH1005`
(`የግዕዝ ቁጥር አጻጻፍ ስተት`).

Three limits follow from the numeral system itself, not from this
implementation:

- **There is no zero in Ge'ez numerals.** Write `0`.
- **There are no fractions.** Write `2.5`.
- **Output is always ASCII**: `ጻፍ(፳፩)` prints `21`. Ge'ez numerals are an
  input spelling for whole positive numbers, not a separate numeric type, and
  `አይነት(፳፩)` is `ቁጥር`.

ASCII and Ge'ez digits MUST NOT be mixed inside one literal: `፳1` is two
adjacent number literals and therefore a parse error.

### 3.5 Punctuation and operators

Both ASCII and Ethiopic forms are accepted; they are exactly equivalent.

| Token | Spellings | Notes |
| --- | --- | --- |
| `PLUS` | `+` | |
| `MINUS` | `-` | |
| `STAR` | `*` | |
| `SLASH` | `/` | |
| `PERCENT` | `%` | modulo |
| `CARET` | `^` | exponentiation |
| `ASSIGN` | `=` | |
| `EQ` | `==` | |
| `NEQ` | `!=` | |
| `AND` | `&` `&&` | same token as `እና` (§3.2) |
| `OR` | `\|` `\|\|` | same token as `ወይም` |
| `NOT` | `!` | same token as `ተቃርኖ` |
| `LT` | `<` `‹` (U+2039) | |
| `LTE` | `<=` `‹=` | |
| `GT` | `>` `›` (U+203A) | |
| `GTE` | `>=` `›=` | |
| `LPAREN` / `RPAREN` | `(` `)` | |
| `LBRACKET` / `RBRACKET` | `[` `]` | |
| `COMMA` | `,` `፣` (U+1363) | |
| `COLON` | `:` `፡` (U+1361) | slice separator only |
| `DOT` | `.` | member access |
| `THEN` | `፦` (U+1366) `:-` `፡-` | opens a block; the ASCII forms only outside brackets |
| `STOP` | `።` (U+1362) | optional statement terminator |

Longest-match wins: `<=` is one `LTE`, never `LT` then `ASSIGN`, and `!=` is
one `NEQ`, never `NOT` then `ASSIGN`.

The one exception is `:-` inside brackets. A block cannot open inside an
unclosed `(` or `[`, but a slice with a negative end can — so within brackets
`:` is always the slice separator, and `ዝ[:-1]` reads as `COLON` then `MINUS`
rather than as a block opener. `፦` is a single code point and so never
ambiguous; it opens a block anywhere.

`።` (Ethiopic full stop) terminates a statement exactly as a newline does, and
is optional. It is accepted because it is the natural end-of-sentence mark in
Amharic prose and its absence in v1-py was a gap, not a decision.

`&`, `|`, and `!` are exact aliases for `እና`, `ወይም`, and `ተቃርኖ` — same tokens,
same precedence (§6.1). The doubled forms `&&` and `||` are accepted too, since
a learner arriving from another language will type them and there is nothing
else they could mean: Ahadu has no bitwise operators. v1 accepted `&` but had
no `|`; the asymmetry, not the shorthand, was the problem (CHANGES §C09).

### 3.6 String literals

```ahadu
"ሰላም ዓለም"
'ሰላም ዓለም'
"መስመር\nሁለት"
```

- A string is delimited by `"` or `'`. The two forms are identical; the
  delimiter that opened the string is the only one that closes it, so
  `"it's"` and `'say "hi"'` both work without escapes.
- Escape sequences: `\n` (newline), `\t` (tab), `\\` (backslash), `\"`, `\'`.
  Any other escaped character denotes itself: `\q` is `q`. A trailing `\` before
  the closing delimiter escapes the delimiter.
- A string MUST NOT contain a raw line terminator. An unterminated string at a
  line terminator or at end of input is error `AH1003`; the lexer MUST still
  emit a `STRING` token holding the text scanned so far, so that editors can
  keep highlighting.
- A string is a sequence of Unicode code points (§4.3).
- There are no multi-line or interpolated strings in 2.0.

### 3.7 Indentation

Ahadu is indentation-structured. One **indent level** is 4 spaces or 1 tab.

- Only whitespace at the start of a line is significant. Whitespace elsewhere
  separates tokens and is otherwise ignored.
- Leading whitespace is normalized by counting each tab as 4 columns and each
  space as 1, then dividing by 4. Each whole group of 4 emits one `INDENT`
  token.
- A remainder that is not a whole group is error `AH1002`
  (`የመስመር መጀመሪያ ክፍተት ስተት`), reported at the first leftover column. Lexing
  continues with the whole groups that were found.
- A line containing only whitespace (and optionally a comment) is **blank**: it
  emits its NEWLINE but no `INDENT` tokens, and never triggers `AH1002`.
- Inside an unclosed `(`, `[` bracket, newlines and indentation are not
  significant; a logical line continues until the bracket closes (§5.1).

### 3.8 Token stream shape

- The stream ends with exactly one `EOF` token.
- For input that is empty or BOM-only, `EOF` sits at line 1, column 1.
- `እስከሆነ ድረስ` is **one** `WHILE` token spanning from the `እ` through the final
  `ስ`, including the single separating space. Exactly one space is permitted
  between the two words.
- `እስከሆነ` not followed by `·ድረስ` is error `AH1004` (`"ድረስ" ይጠበቃል`). It is
  **not** demoted to an identifier. (v1-ts demoted it; v1-py kept it a keyword
  but accepted it alone. See CHANGES §C11.)

### 3.9 Lexer error recovery

The lexer MUST NOT throw and MUST NOT stop at the first problem. It returns
`(tokens, errors)`, with errors sorted by line then by `startCol` then by
`endCol`. An illegal character is reported once and skipped. This is what lets
an editor highlight a half-typed file.

---

## 4. Values and types

Ahadu 2.0 is **dynamically typed** with **optional, runtime-checked
annotations** (§7.2). There is no static type checker.

### 4.1 The type set

| Type | Amharic name | Literal syntax |
| --- | --- | --- |
| Number | `ቁጥር` | `42`, `3.5` |
| Boolean | `እውነታ` | `እውነት`, `ሃሰት` |
| String | `ጽሁፍ` | `"ሰላም"` |
| List | `ስብስብ` | `[1፣ 2፣ 3]` |
| Function | `ተግባር` | `ተግባር` declaration |
| Class | `ክላስ` | `ክላስ` declaration |
| Object | `ኦብጀክት` | calling a class |
| Nothing | `ምንም` | `ምንም` |

`አይነት(x)` returns the Amharic type name as `ጽሁፍ`.

### 4.2 Number

- One numeric type: IEEE-754 binary64. There is no separate integer type, so a
  beginner never meets integer overflow or integer division.
- Printing: a value that is mathematically an integer prints with **no**
  decimal point — `4 / 2` prints `2`, not `2.0`. Otherwise the shortest
  round-tripping decimal form is used.
- `NaN` and `±Infinity` are not reachable: every operation that would produce
  one is a runtime error instead (§6.2).

### 4.3 String

- Immutable sequence of Unicode **code points**. `ርዝመት("ሰላም")` is 3, and
  `"ሰላም"[0]` is `"ሰ"`. Implementations MUST NOT expose UTF-16 surrogate halves.
- Zero-indexed. Indexing and slicing follow §6.5.
- There is no character type. Indexing a string yields a `ጽሁፍ` of length 1,
  which **is** the character: one concept instead of two, and no rule about
  which operations accept which. (`ፊደል` was in v1's keyword table but never
  had a value behind it; it is reserved — §3.2, CHANGES C08.)
- Strings are the one indexable type that cannot be modified in place:
  `ስም[0] = "ሀ"` is error `AH3015` (`ጽሁፍን በቦታው መቀየር አይቻልም።`). Build a new
  string instead — `ስም = "ሀ" + ስም[1:]`. Lists, by contrast, are mutable
  (§4.5): the asymmetry is because a string is a single word-like value while
  a list is a container of them.

### 4.4 Boolean and truthiness

- `እውነት` and `ሃሰት` are the only Boolean values.
- Conditions in `ከሆነ` and `እስከሆነ ድረስ` MUST be of type `እውነታ`. A number,
  string, or list used as a condition is error `AH3005`
  (`ሁኔታው እውነት ወይም ሃሰት መሆን አለበት`).

  This is a deliberate break from v1, where a condition was any number and
  `0` meant false. Implicit truthiness is the single largest source of
  confusing beginner bugs, and `እውነታ` exists precisely to name the concept.

### 4.5 List

- Ordered, zero-indexed, heterogeneous, **mutable** sequence.
- A list is a **reference** value, and because it is mutable that is
  observable: `ለ = ሀ` gives one list two names, and a change through either
  name is visible through both.

  ```ahadu
  ሀ = [1፣ 2፣ 3]
  ለ = ሀ
  ለ[0] = 9
  ጻፍ(ሀ)        # [9፣ 2፣ 3] — ሀ and ለ are the same list
  መ = ቅጂ(ሀ)     # an independent copy (§8)
  መ[0] = 1
  ጻፍ(ሀ)        # [9፣ 2፣ 3]
  ```

  This is how lists behave in every mainstream language, and sharing is a
  thing a programmer has to understand rather than be shielded from. `ቅጂ` is
  how you opt out of it.
- Two kinds of operation, kept strictly apart so it is always obvious which
  one you are using:
  - **Operators build new lists.** `+` concatenates into a fresh list and
    `x[a:b]` slices into a fresh list; neither touches its operands (§6.2,
    §6.5).
  - **Built-ins named as commands change the list.** `አዋህድ` ("merge!") and
    `ሰርዝ` ("delete!") modify the list they are given and return `ምንም` (§8).
- `ቅጂ` is a **shallow** copy: the new list has the same elements, so a nested
  list is still shared.

### 4.6 Nothing

`ምንም` is the single no-value. It is the value of:

- a `ተግባር` that finishes without `ተመላሽ`,
- a bare `ተመላሽ`,
- `ጻፍ(...)` and every other built-in with no meaningful result.

`ምንም` participates in `==` and `!=` only. Any other operation on it is error
`AH3002`. Reading an undefined variable is **not** `ምንም`; it is error `AH3001`.

### 4.7 Objects

An object is a mutable record of attributes plus its class's methods, held by
reference. Assigning an object to two variables makes two names for one object.

---

## 5. Program structure

### 5.1 Logical lines

A statement occupies one logical line, ended by a newline, a `።`, or end of
input. A logical line continues across newlines while any `(` or `[` is
unclosed, which is what makes a multi-line list literal or argument list legal:

```ahadu
ቤተሰብ = [
    "ተስፋማርያም"፣
    "ሰላም"
]
```

### 5.2 Blocks

A block is `፦` (or `:-`), then a newline, then one or more statements indented
exactly one level deeper than the line that opened the block.

```ahadu
ቆጣሪ < 5 እስከሆነ ድረስ፦
    ጻፍ(ቆጣሪ)
    ቆጣሪ = ቆጣሪ + 1
```

- `፦` is **required** before a block. (v1-py treated it as optional; see
  CHANGES §C05.)
- A block MUST contain at least one statement. An empty block is error
  `AH2006`.
- Indenting deeper than one level past the opener is error `AH2015`. (The
  lexer reports malformed whitespace, `AH1002`, but it has no idea which line
  opened a block, so depth relative to an opener is the parser's to check.)
- A block ends at the first non-blank line indented less deeply. Blank lines
  inside a block do not end it.
- Single-line (inline) block forms are **not** supported in 2.0: the body
  always goes on its own indented line. v1-py accepted inline `if`/`while`/
  function bodies through a fragile backtracking path; one shape is enough
  (CHANGES §C06).

### 5.3 Scope

- The program runs in the **global** scope, named `ዋና ፕሮግራም` in tracebacks.
- A `ተግባር` call creates a fresh **local** scope whose parent is the scope in
  which the function was *declared* (lexical scoping).
- A `ከሆነ` or `እስከሆነ ድረስ` block does **not** create a scope. Variables first
  assigned inside such a block are visible after it, in the enclosing function
  or global scope.
- Reading a name searches the current scope, then its parent chain. Not found
  is error `AH3001` (`ያልታወቀ ተለዋጭ`).
- `x = …` assigns in the **current** scope: it rebinds a name that already
  exists there, otherwise it creates one. It never reaches up to rebind an
  outer variable. A function therefore cannot reassign a global; it can only
  read it. 2.0 provides no `global` escape hatch.
- Lookup is by *presence*, not by truthiness. A variable holding `0`,
  `""`, `ሃሰት`, `[]`, or `ምንም` is defined. (v1-py's symbol table used a falsy
  check, so `ቆጣሪ = 0` followed by reading `ቆጣሪ` raised "undefined variable";
  CHANGES §C19.)

---

## 6. Expressions

### 6.1 Precedence

Loosest to tightest. All binary operators are left-associative except `^`.

| # | Operators | Form | Assoc |
| --- | --- | --- | --- |
| 1 | `ወይም` | infix | left |
| 2 | `እና` | infix | left |
| 3 | `ተቃርኖ` | prefix | — |
| 4 | `==` `!=` `<` `<=` `>` `>=` | infix | **none** |
| 5 | `+` `-` | infix | left |
| 6 | `*` `/` `%` | infix | left |
| 7 | `-` | prefix | — |
| 8 | `^` | infix | **right** |
| 9 | `f(…)` `x[…]` `x.y` | postfix | left |

Comparison is **non-associative**: `a < b < c` is error `AH2008`
(`ሁለት ማወዳደሪያዎችን በአንድ ላይ ማስቀመጥ አይቻልም`), not `(a < b) < c`. Write
`a < b እና b < c`.

`2 ^ 3 ^ 2` is `2 ^ (3 ^ 2)` = 512. `^` binds tighter than unary minus on
its left, so `-2 ^ 2` is `-(2 ^ 2)` = −4, while `2 ^ -1` is `0.5` because the
exponent is parsed as a unary expression.

`እና` binds tighter than `ወይም`, so `a ወይም b እና c` is `a ወይም (b እና c)`.
(v1-py gave them equal precedence; CHANGES §C10.)

### 6.2 Operators by type

Operands MUST match as listed. Anything else is error `AH3002`
(`ሕጋዊ ያለሆነ ተግባር`), whose message names both types and the operation in
Amharic.

| Operator | Left | Right | Result | Notes |
| --- | --- | --- | --- | --- |
| `+` | `ቁጥር` | `ቁጥር` | `ቁጥር` | |
| `+` | `ጽሁፍ` | `ጽሁፍ` | `ጽሁፍ` | concatenation |
| `+` | `ስብስብ` | `ስብስብ` | `ስብስብ` | concatenation, not append |
| `-` `*` `/` `%` `^` | `ቁጥር` | `ቁጥር` | `ቁጥር` | |
| `*` | `ጽሁፍ` | `ቁጥር` | `ጽሁፍ` | repetition; right MUST be a non-negative integer |
| `<` `<=` `>` `>=` | `ቁጥር` | `ቁጥር` | `እውነታ` | |
| `<` `<=` `>` `>=` | `ጽሁፍ` | `ጽሁፍ` | `እውነታ` | code-point order |
| `==` `!=` | any | any | `እውነታ` | §6.3 |
| `እና` `ወይም` | `እውነታ` | `እውነታ` | `እውነታ` | short-circuit |
| `ተቃርኖ` | — | `እውነታ` | `እውነታ` | |
| `-` (prefix) | — | `ቁጥር` | `ቁጥር` | |

- `ስብስብ + ስብስብ` concatenates. v1-py's `+` appended the right operand as a
  single element, so `[1] + [2]` produced `[1, [2]]` (CHANGES §C15). To append
  one element, use `አዋህድ(ዝርዝር፣ ዕቃ)`.
- `/` by zero is error `AH3003` (`በዘሮ ማካፈል አይቻልም`). `%` by zero likewise.
- `%` follows the sign of the left operand: `-7 % 3` is `-1`.
- `^` MUST NOT produce a complex or non-finite result: a negative base with a
  fractional exponent is error `AH3004`, and a result that overflows to
  infinity is `AH3006`.
- `እና` and `ወይም` short-circuit. The right operand is not evaluated when the
  left settles the answer, and so is not type-checked either.

### 6.3 Equality

- `==` is `እውነት` only when both operands have the same type and equal value.
  Cross-type comparison is **not** an error — it is `ሃሰት`. This is the one
  place where mixed types are allowed, because "are these the same?" is a
  reasonable question to ask about any two values.
- Numbers compare by value; strings by code-point sequence; lists
  element-wise; `ምንም` equals only `ምንም`; objects and functions by reference
  identity.
- Lists compare by **value**, not identity, even though they are mutable
  references: `[1፣ 2] == [1፣ 2]` is `እውነት` for two separate lists. 2.0 has no
  identity test; if you need one, compare something you control.
- `!=` is the negation of `==`.

### 6.4 Access

```ahadu
ዝርዝር[0]            # index
ጽሁፍ[1]             # index into a string
ዝርዝር[1:3]          # slice
ተግባር(ሀ፣ ለ)         # call
አበበ.ስም             # attribute
አበበ.ደረጃ()          # method call
የአበበ ስም            # attribute, Amharic order (read, §7.5 for write)
```

- `obj.attr` and `የobj attr` denote the same attribute. The `የ` form reads in
  Amharic order and is the idiomatic spelling; the dot form is provided because
  it chains (`ሀ.ለ.ሐ`) and `የ` does not.
- Calling a class constructs an object (§7.6). There is no `አዲስ` operator;
  v1-ts invented one that the language never had (CHANGES §C07).

### 6.5 Indexing and slicing

Applies to `ጽሁፍ` and `ስብስብ`. Let *n* be the length.

- `x[i]` requires `i` to be a `ቁጥር` with no fractional part, else `AH3007`.
- A negative index counts from the end: `x[-1]` is the last element. Formally
  the effective index is `i < 0 ? n + i : i`.
- An effective index outside `0 … n-1` is error `AH3008`
  (`ከስብስቡ ውጪ ያለ ቦታ`). There is no silent clamping and no `ምንም` result.
- `x[a:b]` yields the elements from effective `a` (inclusive) to effective `b`
  (exclusive).
- `a` omitted defaults to `0`. `b` omitted defaults to **`n`**, so `x[:]` is a
  full copy. (v1-py defaulted the end to `n-1`, silently dropping the last
  element; CHANGES §C16.)
- Slice bounds are clamped to `0 … n`, and a slice whose start is at or past
  its end yields an empty result. Slicing, unlike indexing, never errors on
  range.
- Indexing a `ጽሁፍ` yields a `ጽሁፍ` of length 1. There is no distinct character
  value.
- A slice always produces a new value and never aliases its source, so
  `መ = ሀ[:]` is the slice spelling of `ቅጂ(ሀ)`.

**Index assignment.** `x[i] = v` replaces the element at effective index `i`
when `x` is a `ስብስብ`:

- The index rules above apply unchanged, negatives included: `ዝ[-1] = 9`
  replaces the last element.
- An out-of-range index is `AH3008`. Assignment **cannot** extend a list —
  `ዝ[ርዝመት(ዝ)] = 1` is an error, not an append. Use `አዋህድ` (§8).
- Slice assignment (`x[a:b] = …`) is not in 2.0; it is refused at parse time
  as `AH2009`.
- `x` must be a `ስብስብ`. A `ጽሁፍ` target is `AH3015` (§4.3); anything else is
  `AH3002`.

---

## 7. Statements

### 7.1 Assignment

```ahadu
ስም = "ሰላም"
ቆጣሪ = ቆጣሪ + 1
ዝርዝር[0] = 5
አበበ.ዕድሜ = 22
የአበበ ዕድሜ = 22
```

- Assignment is a **statement**, never an expression. `ሀ = ለ = 1` and
  `ሀ = 1 ከሆነ፦` are syntax errors. (Both v1s parsed assignment as an
  expression; CHANGES §C12.)
- Legal targets: a plain identifier, a list index `x[i]` (§6.5), `obj.attr`,
  or `የobj attr`. Anything else — a literal, a call, a parenthesized
  expression — is error `AH2011`. A slice target is `AH2009`. A target that
  turns out at runtime to index a string is `AH3015`.
- The right-hand side is evaluated **before** the target is bound. So inside a
  function, `ቆጣሪ = ቆጣሪ + 1` reads the outer `ቆጣሪ` and creates a *local* one
  holding the result; the outer variable is unchanged (§5.3). This is an error
  in some languages; in Ahadu it is defined, and the rule is the simpler one to
  teach.
- Scope rules are §5.3.

### 7.2 Typed declaration

```ahadu
ቁጥር ቆጣሪ = 0
ጽሁፍ ስም = "ሰላም"
ስብስብ ቤተሰብ = []
እውነታ ተጠናቋል = ሃሰት
```

- A type keyword before the name declares the variable **and** pins its type
  for the rest of its scope. Every later assignment to that name is checked;
  a mismatch is error `AH3009` (`የተለዋጩ አይነት አይመጣጠንም`).
- The initializer is required. `ቁጥር ቆጣሪ` with no `=` is error `AH2007`.
- Annotations are entirely optional; plain `ቆጣሪ = 0` is equally valid and
  stays untyped.
- A typed declaration for a name that already exists in the scope is not an
  error: it assigns, and checks the value against whatever type is already
  pinned. Re-typing a name therefore surfaces as `AH3009` against the first
  declaration's type, which says more than "you declared this twice" would.

  There was an `AH3016` here for redeclaration, and it could not survive
  §5.3: a `ከሆነ` or `እስከሆነ ድረስ` block creates no scope, so a typed
  declaration inside a loop body runs again on every iteration. A rule that
  fires on the second *execution* of one declaration is not the rule anyone
  wanted, and telling that apart from a second declaration in the text is a
  static question, not a runtime one.

Annotations exist because the original grammar specified them
(`expression ::= KEYWORD:INT IDENTIFIER EQUAL arith_expr`) even though no v1
implementation ever parsed them, and because naming a type is pedagogically
useful. The one annotation dropped along the way is `ፊደል` (§4.3). See
CHANGES §C08.

### 7.3 Conditional

```ahadu
ዕድሜ > 18 ከሆነ፦
    ጻፍ("ትልቅ")
ግን ዕድሜ > 12 ከሆነ፦
    ጻፍ("ታዳጊ")
አለበለዚያ፦
    ጻፍ("ልጅ")
```

Shape: `<condition> ከሆነ፦` — **the condition comes first**, then the keyword,
exactly as the Amharic clause is ordered. Zero or more `ግን <condition> ከሆነ፦`
branches may follow, then at most one `አለበለዚያ፦`.

- `ግን` and `አለበለዚያ` MUST be indented to the same level as the opening `ከሆነ`
  line, and MUST follow that statement's block immediately (only blank lines
  and comments may intervene).
- `ግን` without a following condition and `ከሆነ` is error `AH2003`.
- `አለበለዚያ` or `ግን` with no preceding `ከሆነ` is error `AH2004`.
- The condition MUST be `እውነታ` (§4.4).

> **This is the single most important divergence from v1-ts**, which parsed
> `ከሆነ <condition>፦` — English order, keyword first. Every program in the
> original repository fails to parse under it. See CHANGES §C01.

### 7.4 Loop

```ahadu
ቆጣሪ = 0
ቆጣሪ < 5 እስከሆነ ድረስ፦
    ጻፍ(ቆጣሪ)
    ቆጣሪ = ቆጣሪ + 1
```

Shape: `<condition> እስከሆነ ድረስ፦` — condition first again. The condition is
re-evaluated before each iteration and MUST be `እውነታ`.

There is no `for` loop, no `አቁም` (break), and no `ቀጥል` (continue) in 2.0; all
three names are reserved.

### 7.5 Function declaration

```ahadu
ተግባር ሰላም_በል(ስም)፦
    ጻፍ("ሰላም " + ስም)

ተግባር ትልቁ(ሀ፣ ለ)፦
    ሀ > ለ ከሆነ፦
        ተመላሽ ሀ
    ተመላሽ ለ
```

- `ተግባር <name>(<params>)፦` then an indented block. Parameters are
  comma-separated identifiers; trailing commas are not allowed.
- Duplicate parameter names are error `AH2012`.
- The declaration binds `<name>` in the current scope and evaluates to `ምንም`.
- Calling with the wrong number of arguments is error `AH3010`, whose message
  states how many were expected and how many arrived.
- Arguments are evaluated left to right and bound by position.
- `ተመላሽ <expr>` returns immediately from the enclosing function, **from
  anywhere**, including inside a loop or a nested block. `ተመላሽ` with no
  expression returns `ምንም`. Falling off the end returns `ምንም`.

  In v1-py a function returned a value only when the *last* statement of its
  body was syntactically `ተመላሽ`; an early return inside an `ከሆነ` block was
  computed and discarded, so `ትልቁ` above would return `ምንም`. CHANGES §C17.
- `ተመላሽ` outside any function is error `AH2005`.
- Functions are values: they can be stored, passed, and returned. Recursion is
  supported. Closures capture by reference to the declaring scope, subject to
  §5.3's rule that a function cannot rebind an outer variable.

### 7.6 Class declaration

```ahadu
ክላስ ተማሪ፦
    ስም = ""
    ዕድሜ = 0
    ክፍል = 0

    ፍጠር(ስም_)፦
        ስም = ስም_

    ተግባር ደረጃ()፦
        ክፍል < 9 ከሆነ፦
            ተመላሽ "አንደኛ ደረጃ"
        ግን ክፍል < 13 ከሆነ፦
            ተመላሽ "ሁለተኛ ደረጃ"
        ተመላሽ "ዩኒቨርሲቲ"

አበበ = ተማሪ("ተስፋማርያም")
የአበበ ክፍል = 10
ጻፍ(አበበ.ስም + " — " + አበበ.ደረጃ())
```

A class body contains, in any order and all indented one level:

- **attribute declarations** — `name = <expr>`, optionally type-annotated.
  Every attribute MUST be declared here with a default value.
- **at most one constructor** — `ፍጠር(<params>)፦` with a block body.
- **methods** — `ተግባር <name>(<params>)፦` with a block body.

Nothing else may appear in a class body (error `AH2013`). A class body is
structured, not an arbitrary block — v1-ts modelled it as a plain `Block` and
lost the distinction (CHANGES §C03).

Semantics:

- `ክላስ <Name>(<Parent>)፦` inherits. The parent MUST already be declared
  (`AH3011`). Attributes and methods resolve on the object first, then up the
  parent chain. A subclass may redeclare either to override. Single inheritance
  only. (Inheritance was declared but crashed in v1-py — it referenced a
  `context.object_table` that does not exist; CHANGES §C18.)
- Calling a class value constructs an object: attributes are initialized to
  their declared defaults in declaration order, then `ፍጠር` runs if present.
  Inherited attributes come first, from the root of the chain down, so a
  subclass redeclaring one overrides the default it inherited.
- A default **expression is evaluated afresh for each object**, in the scope
  where the class was declared. It is not evaluated once when the class is
  declared — that would give every object of the class the same `ስብስብ`, since
  lists are mutable references (§4.5), and mutating one object's list would
  change them all.
  The constructor's arity is checked like any function's.
- Inside a constructor or method, the object's attributes **and** its methods
  are in scope directly — `ስም = ስም_` assigns the attribute, and `ድምጽ()` calls
  a sibling method. There is no `self`/`this`. A name that is neither a member
  nor a parameter follows the normal scope chain.
- Method resolution is dynamic: a method inherited from a parent that calls
  `ድምጽ()` reaches the subclass's override when invoked on a subclass instance.
- A class that declares no `ፍጠር` inherits its parent's. A class with no `ፍጠር`
  anywhere in its chain is constructed with no arguments; passing any is
  `AH3010`.
- `ፍጠር` MUST NOT contain `ተመላሽ <expr>` (error `AH2014`); the construction's
  value is always the new object.
- Assigning to an attribute that was never declared is error `AH3012`. Objects
  do not grow new attributes at runtime.
- Methods are bound: `አበበ.ደረጃ` is a callable value even when not immediately
  called.

---

## 8. Built-in functions

These twelve names are pre-bound in the global scope. They are not keywords
and MAY be shadowed by user code. v1-py declared `ጻፍ`, `አዋህድ`, and `ሰርዝ` as
keywords but implemented only `ጻፍ`; calling either other one crashed the
interpreter with a Python exception (CHANGES §C13).

| Name | Signature | Result |
| --- | --- | --- |
| `ጻፍ` | `ጻፍ(…)` any arity | prints each argument separated by one space, then a newline; returns `ምንም` |
| `ርዝመት` | `ርዝመት(ጽሁፍ \| ስብስብ)` | `ቁጥር` length in code points / elements |
| `አዋህድ` | `አዋህድ(ስብስብ፣ ዕቃ)` | **appends `ዕቃ` to the list in place**; returns `ምንም` |
| `ሰርዝ` | `ሰርዝ(ስብስብ፣ ኢንዴክስ)` | **removes that index from the list in place**; returns `ምንም`; index rules as §6.5 |
| `ቅጂ` | `ቅጂ(ስብስብ)` | a new `ስብስብ` with the same elements — a shallow copy |
| `አይነት` | `አይነት(any)` | `ጽሁፍ` naming the type (§4.1) |
| `አንብብ` | `አንብብ()` or `አንብብ(ጽሁፍ)` | reads one line from standard input as `ጽሁፍ`; the optional argument is printed as a prompt first |
| `ወደቁጥር` | `ወደቁጥር(ጽሁፍ \| ቁጥር)` | the number that text spells; `AH3019` when it spells none (§8.2) |
| `ወደጽሁፍ` | `ወደጽሁፍ(any)` | `ጽሁፍ` — exactly what `ጻፍ` would have printed (§8.1) |
| `ቁጥርነው` | `ቁጥርነው(any)` | `እውነታ` — whether `ወደቁጥር` would succeed. Never fails |
| `አጋጣሚ` | `አጋጣሚ(ቁጥር፣ ቁጥር)` | a `ቁጥር` drawn from the two bounds **inclusive**; `AH3020` on bounds it cannot use (§8.3) |
| `ዘር` | `ዘር(ቁጥር)` | **restarts `አጋጣሚ` from that seed**; returns `ምንም` (§8.3) |

`ርዝመት`, `ቅጂ`, `አይነት`, and `አንብብ` are new in 2.0. Without `ርዝመት` there is no
way to walk a list whose length is not already known, which is why every v1
example hardcodes `< 5`.

`ወደቁጥር`, `ወደጽሁፍ`, `ቁጥርነው`, `አጋጣሚ` and `ዘር` were added after the website
shipped, for a reason worth recording: `አንብብ` returns `ጽሁፍ` and `+` refuses
to mix a `ጽሁፍ` with a `ቁጥር` (§6.2), so there was no way to add two numbers a
learner had typed. A calculator was not a missing example — it was
unwritable. `ወደቁጥር` is named for its direction because `ቁጥር` and `ጽሁፍ` are
reserved type keywords (§3.3) and cannot be reused as function names.

`አዋህድ` and `ሰርዝ` are imperatives in Amharic — "merge!", "delete!" — so they
change the list rather than handing back a new one, and returning `ምንም` makes
that unmistakable: `ዝ = አዋህድ(ዝ፣ 4)` leaves `ዝ` holding `ምንም`, which fails
loudly instead of looking like it worked. The operators `+` and `x[a:b]` are
the non-mutating half of the pair (§4.5).

### 8.1 How values print

`ጻፍ` renders values as:

| Type | Rendering |
| --- | --- |
| `ቁጥር` | `42`, `3.5` — integral values with no decimal point |
| `እውነታ` | `እውነት` / `ሃሰት` |
| `ጽሁፍ` | the characters themselves, with no surrounding quotes |
| `ስብስብ` | `[ሀ፣ ለ፣ ሐ]` — Ethiopic comma and a space; nested strings **are** quoted |
| `ምንም` | `ምንም` |
| `ተግባር` | `[ተግባር <name>]` |
| `ክላስ` | `[ክላስ <Name>]` |
| `ኦብጀክት` | `[<Name> ኦብጀክት]` |

Nesting is the only context where a string is quoted, so that `ጻፍ(["ሀ"])`
shows `["ሀ"]` while `ጻፍ("ሀ")` shows `ሀ`.

`ወደጽሁፍ` returns exactly this rendering, so there is one answer to "how does
this value look" rather than two that could drift apart.

### 8.2 What text counts as a number

`ወደቁጥር` accepts exactly what the language itself accepts as a number
literal, optionally signed, with surrounding whitespace ignored:

- a run of ASCII digits, with at most one `.` that has digits on both sides
  (§3.4) — so `5.` and `.5` are **not** numbers, the same rule the lexer
  applies;
- or a well-formed run of Ge'ez numerals (§3.4.1) — `፫፻፳፩` is 321.

Nothing else. Not `1e3`, not `0x10`, not digits from another script. A leading
`-` is accepted; a leading `+` is not, because the language has no unary plus.
`ወደቁጥር` given a `ቁጥር` returns it unchanged, so a program need not know
whether a value has already been converted.

One rule, two readers: the same function decides what a literal in a file
means and what text from `አንብብ` means. A language that read `፫፻፳፩` from a file
and refused the same digits typed at a prompt would be lying about its own
numerals.

Whitespace is ignored because someone typing at a prompt adds a space without
meaning anything by it. The Ethiopic word space `፡` is punctuation and not
whitespace, so `"7፡"` is `AH3019`.

Failure is loud. `ወደቁጥር` on text that is not a number raises `AH3019`; it does
not return `ምንም`. A calculator that quietly computed with `ምንም` would print an
answer and the learner would believe it. A program that wants to check first
calls `ቁጥርነው`, which answers `እውነት` or `ሃሰት` for **any** value and never
raises — a guard that can itself fail is no guard.

### 8.3 Randomness is seeded

`አጋጣሚ(ሀ፣ ለ)` draws an integer from `ሀ` to `ለ` with **both ends included**, so
`አጋጣሚ(1፣ 6)` is a die. An exclusive upper bound is the right default for a
library and the wrong one for a first program: everyone who writes
`አጋጣሚ(1፣ 6)` means six faces, and an exclusive bound would hand them five and
no error. Both bounds MUST be integers and `ሀ` MUST NOT exceed `ለ`; otherwise
`AH3020`.

The sequence is **fully determined by a seed**. A program sets it with `ዘር`,
which is an imperative like `አዋህድ` and `ሰርዝ` and returns `ምንም`. The same seed
MUST produce the same sequence in a given implementation; implementations
SHOULD document their generator, and this one documents mulberry32 in
`src/interpreter/README.md`.

Where the first seed comes from is **the host's decision**, and the default is
fixed rather than clock-based. That direction is deliberate and it is not a
detail: the website runs every snippet on it through the real interpreter at
build time and fails the build when the output is not what the page claims
(SITE.md §2). A clock-seeded default would mean a lesson could not show what
`አጋጣሚ` prints, and the one mechanism that keeps the teaching material honest
would have a hole in it exactly where a learner is most likely to be confused.

So a host that says nothing gets a reproducible program; a host that wants
dice asks for them. `ahadu` seeds from the clock and takes `--seed=<n>` to pin
a run (TOOLING.md §1); the playground seeds from the clock; the conformance
suite and the site's snippet checker take the fixed default.

This is also why conformance cases for `አጋጣሚ` assert **properties** — that a
draw is within its bounds, and that the same seed repeats — rather than
particular numbers. The numbers are this implementation's; the properties are
the language's.

---

## 9. Errors

### 9.1 Shape

Every error carries a stable code, an Amharic message, a line, and an inclusive
column span. The rendered form is:

```
[AH2001] የተሰበረ ህግ አለ።: መስመር 3 ላይ: 15ኛው ካራክተር
------------------------------------------------------------

    3: ዕድሜ > 18 ከሆነ
                   ↑

"፦" ይጠበቃል።
```

The code is part of the rendered message, in brackets ahead of the Amharic
text, in every surface — CLI, REPL, playground, and `--json`. A learner can
read past it; a teacher, a bug report, or a search needs it, and an error
message that cannot be quoted precisely is hard to get help with.

Runtime errors additionally render a call traceback (`የጥሪ መልሶ ምልከታ`), outermost
frame first, with the global frame named `ዋና ፕሮግራም`.

`AH3017` and `AH3018` are resource limits rather than mistakes in the program:
they exist so that runaway recursion or an endless loop ends in an Ahadu error
instead of taking down whatever is hosting the interpreter. A host sets the
bounds; `AH3018` only fires where a step budget was asked for, as the
playground does (TOOLING.md §2.2).

Codes are stable across releases and are what tooling matches on; the Amharic
text is what humans read and MAY be reworded. `AH1xxx` is lexical, `AH2xxx`
syntactic, `AH3xxx` runtime — and that grouping is a commitment about *when* a
problem is detected, not a loose label. A diagnostic belongs to the earliest
stage that can actually see it: whether `x[0] = v` targets a list or a string
is unknowable until `x` has a value, so that is `AH3015` and not a parse
error, while `x[1:2] = v` is refused on sight and so is `AH2009`.

### 9.2 Catalogue

| Code | Meaning |
| --- | --- |
| `AH1001` | illegal character — `የማይታወቅ ካራክተር አለ።` |
| `AH1002` | bad leading whitespace — `የመስመር መጀመሪያ ክፍተት ስተት፡` |
| `AH1003` | unterminated string — `ያልተሟላ ፅሑፍ` |
| `AH1004` | `እስከሆነ` without `ድረስ` |
| `AH1005` | malformed Ge'ez numeral — `የግዕዝ ቁጥር አጻጻፍ ስተት` |
| `AH2001` | unexpected token |
| `AH2002` | missing closing `)` / `]` |
| `AH2003` | `ግን` without `<condition> ከሆነ` |
| `AH2004` | `ግን` / `አለበለዚያ` with no preceding `ከሆነ` |
| `AH2005` | `ተመላሽ` outside a function |
| `AH2006` | empty block |
| `AH2007` | typed declaration without an initializer |
| `AH2008` | chained comparison |
| `AH2009` | assignment to a slice — `ቁራጭ መቀየር አይቻልም።` |
| `AH2010` | reserved word used |
| `AH2011` | assignment to something that cannot be assigned to |
| `AH2012` | duplicate parameter name |
| `AH2013` | illegal item in a class body |
| `AH2014` | `ተመላሽ <expr>` inside `ፍጠር` |
| `AH2015` | block indented deeper than one level |
| `AH3001` | undefined variable — `ያልታወቀ ተለዋጭ` |
| `AH3002` | illegal operation for these types — `ሕጋዊ ያለሆነ ተግባር` |
| `AH3003` | division or modulo by zero — `በዘሮ ማካፈል አይቻልም።` |
| `AH3004` | undefined exponentiation |
| `AH3005` | non-boolean condition |
| `AH3006` | numeric overflow |
| `AH3007` | non-integer index |
| `AH3008` | index out of range — `ከስብስቡ ውጪ ያለ ቦታ` |
| `AH3009` | annotated type mismatch |
| `AH3010` | wrong argument count |
| `AH3011` | unknown parent class |
| `AH3012` | assignment to an undeclared attribute |
| `AH3013` | call of a non-callable value |
| `AH3014` | member access on a non-object |
| `AH3015` | assignment to a string index — `ጽሁፍን በቦታው መቀየር አይቻልም።` |
| `AH3017` | call depth exceeded — `የጥሪ ጥልቀት ከመጠን አለፈ።` |
| `AH3018` | step limit exceeded — `ፕሮግራሙ ከመጠን በላይ ረዘመ።` |
| `AH3019` | `ወደቁጥር` on text that is not a number — `ጽሁፉ ቁጥር አይደለም።` |
| `AH3020` | `አጋጣሚ` given bounds it cannot use — `የአጋጣሚው ክልል አይሰራም።` |

### 9.3 Recovery

- **Lexer**: never throws; collects all errors (§3.9).
- **Parser**: never throws; collects all errors, and on an unexpected token
  skips forward to the next newline or block opener before resuming, so one bad
  line does not cascade. It always returns a `Program` node, possibly
  containing error placeholders. This is what makes live highlighting of a
  half-typed file possible.
- **Evaluator**: stops at the first runtime error and returns it. There is no
  exception handling in 2.0.

---

## 10. Formal grammar

See [GRAMMAR.ebnf](./GRAMMAR.ebnf). It is normative for syntax; where it
disagrees with the prose above, the prose wins and the grammar is a bug.
