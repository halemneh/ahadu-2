# Ahadu 2.0 — Language Specification

**Status**: Normative. This document is the single source of truth for the
Ahadu language. Where an implementation disagrees with this document, the
implementation is wrong.

**Version**: 2.0.0
**Supersedes**: the implicit specification embodied in
[halemneh/Ahadu](https://github.com/halemneh/Ahadu) (Python, "v1-py") and
[halemneh/Amharic-Interpreter](https://github.com/halemneh/Amharic-Interpreter)
(TypeScript, "v1-ts"). Every deliberate divergence from those is recorded in
[CHANGES-FROM-V1.md](./CHANGES-FROM-V1.md).

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
  appear, including inside identifiers, and MUST NOT occupy a column:
  U+200B (ZWSP), U+200C (ZWNJ), U+200D (ZWJ), U+00AD (soft hyphen).
  Rationale: Ge'ez text pasted from word processors and the web routinely
  carries these.

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
| U+1369–U+137C | Ethiopic digits and numerals |
| U+1380–U+139F | Ethiopic Supplement |
| U+2D80–U+2DDF | Ethiopic Extended |
| U+AB01–U+AB2F | Ethiopic Extended-A |
| `a`–`z`, `A`–`Z` | ASCII letters |
| `0`–`9` | ASCII digits |
| `_` | underscore |

Rules:

- An identifier MUST NOT begin with an ASCII digit (`0`–`9`). An identifier MAY
  begin with an Ethiopic digit.
- Ethiopic punctuation (U+1360–U+1368) is **not** a word character; it is
  punctuation (§3.5).
- Identifiers are compared by exact code-point sequence. There is **no**
  normalization and no spelling-variant folding: `ሃይሌ` and `ኃይሌ` are two
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
| and | `እና` `ዕና` | `AND` |
| or | `ወይም` | `OR` |
| not | `ተቃርኖ` | `NOT` |
| true | `እውነት` `ዕውነት` | `TRUE` |
| false | `ሃሰት` `ሀሰት` `ኅሰት` `ኃሰት` `ሓሰት` `ሐሰት` `ሃሠት` `ሀሠት` `ኅሠት` `ኃሠት` `ሓሠት` `ሐሠት` | `FALSE` |
| nothing | `ምንም` | `NOTHING` |
| type: number | `ቁጥር` | `TYPE_NUM` |
| type: boolean | `እውነታ` | `TYPE_BOOL` |
| type: character | `ፊደል` | `TYPE_CHAR` |
| type: text | `ጽሁፍ` `ፅሁፍ` | `TYPE_TEXT` |
| type: list | `ስብስብ` | `TYPE_LIST` |

Keyword matching is **whole-word**: `ከሆነነገር` is one identifier, not `ከሆነ`
followed by `ነገር`. A keyword is recognized only when the maximal run of word
characters equals a listed spelling exactly.

Reserved for future use (recognized as keywords, no syntax in 2.0; using one is
error `AH2010`): `አዲስ`, `ለ`, `አቁም`, `ቀጥል`.

Built-in function names (`ጻፍ`, `አዋህድ`, `ሰርዝ`, `ርዝመት`, `አይነት`, `አንብብ`) are
**not** keywords. They are ordinary identifiers pre-bound in the global scope
(§8), and user code MAY shadow them.

### 3.3 The possessive prefix `የ`

Amharic expresses "the X of Y" with the prefix `የ` on Y: `የሃይሌ ዕድሜ` is
"Hailé's age". Ahadu supports this for attribute access.

The lexer MUST NOT split `የ` from the word it is attached to. Instead:

- A maximal word run that begins with `የ` (U+12E8) and has at least one further
  word character produces an `IDENTIFIER` token whose `name` is the **full**
  text (`የሃይሌ`) and whose `hasOfPrefix` flag is true, plus a `stem` field
  holding the text after `የ` (`ሃይሌ`).
- A bare `የ` with no following word character is an illegal character
  (`AH1001`).

The parser decides what the prefix means (§6.4, §7.5). This resolves a real
v1-py defect in which every identifier beginning with `የ` — an extremely common
Amharic prefix — was silently torn in half.

### 3.4 Number literals

```
number := digit+ ( "." digit+ )?
```

- Digits are ASCII `0`–`9`.
- A number has at most one `.`, and the `.` MUST have at least one digit on
  each side. `5.` and `.5` are **not** numbers: `5.` lexes as `5` then `.`
  (which the parser rejects), and `.5` lexes as `.` then `5`.
- `1.2.3` lexes as `1.2`, `.`, `3` — a parse error, not a number.
- There are no sign characters in a literal; `-5` is unary minus applied to
  `5` (§6.2).
- There are no separators, no exponent form, and no radix prefixes in 2.0.
- All numbers are IEEE-754 binary64 (§4.2).

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
| `LT` | `<` `‹` (U+2039) | |
| `LTE` | `<=` `‹=` | |
| `GT` | `>` `›` (U+203A) | |
| `GTE` | `>=` `›=` | |
| `LPAREN` / `RPAREN` | `(` `)` | |
| `LBRACKET` / `RBRACKET` | `[` `]` | |
| `COMMA` | `,` `፣` (U+1363) | |
| `COLON` | `:` `፡` (U+1361) | slice separator only |
| `DOT` | `.` | member access |
| `THEN` | `፦` (U+1366) `:-` `፡-` | opens a block |
| `STOP` | `።` (U+1362) | optional statement terminator |

Longest-match wins: `<=` is one `LTE`, never `LT` then `ASSIGN`.

`።` (Ethiopic full stop) terminates a statement exactly as a newline does, and
is optional. It is accepted because it is the natural end-of-sentence mark in
Amharic prose and its absence in v1-py was a gap, not a decision.

There is no `&` for `እና` and no `|` for `ወይም`. (v1 accepted `&` and had no
`|`; see CHANGES §C09.)

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
| Text | `ጽሁፍ` | `"ሰላም"` |
| Character | `ፊደል` | — (a `ጽሁፍ` of length 1; annotation only) |
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

### 4.3 Text

- Immutable sequence of Unicode **code points**. `ርዝመት("ሰላም")` is 3, and
  `"ሰላም"[0]` is `"ሰ"`. Implementations MUST NOT expose UTF-16 surrogate halves.
- Zero-indexed. Indexing and slicing follow §6.5.

### 4.4 Boolean and truthiness

- `እውነት` and `ሃሰት` are the only Boolean values.
- Conditions in `ከሆነ` and `እስከሆነ ድረስ` MUST be of type `እውነታ`. A number, text,
  or list used as a condition is error `AH3005`
  (`ሁኔታው እውነት ወይም ሃሰት መሆን አለበት`).

  This is a deliberate break from v1, where a condition was any number and
  `0` meant false. Implicit truthiness is the single largest source of
  confusing beginner bugs, and `እውነታ` exists precisely to name the concept.

### 4.5 List

- Ordered, zero-indexed, heterogeneous, **immutable** sequence.
- Every list operation returns a new list; nothing mutates in place. `አዋህድ`
  appends by returning a new list (§8).
- A list is a **reference** value for identity purposes but, being immutable,
  that distinction is unobservable.

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
    "ኃይለሚካኤል"፣
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
- Indenting deeper than one level past the opener is error `AH1002`.
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
- Numbers compare by value; text by code-point sequence; lists element-wise;
  `ምንም` equals only `ምንም`; objects and functions by reference identity.
- `!=` is the negation of `==`.

### 6.4 Access

```ahadu
ዝርዝር[0]            # index
ጽሁፍ[1]             # index into text
ዝርዝር[1:3]          # slice
ተግባር(ሀ፣ ለ)         # call
ሃይሌ.ስም             # attribute
ሃይሌ.ደረጃ()          # method call
የሃይሌ ስም            # attribute, Amharic order (read, §7.5 for write)
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

---

## 7. Statements

### 7.1 Assignment

```ahadu
ስም = "ሰላም"
ቆጣሪ = ቆጣሪ + 1
ዝርዝር[0] = 5          # NOT legal — lists are immutable (AH2009)
ሃይሌ.ዕድሜ = 22
የሃይሌ ዕድሜ = 22
```

- Assignment is a **statement**, never an expression. `ሀ = ለ = 1` and
  `ሀ = 1 ከሆነ፦` are syntax errors. (Both v1s parsed assignment as an
  expression; CHANGES §C12.)
- Legal targets: a plain identifier, `obj.attr`, or `የobj attr`. An index
  target is error `AH2009`.
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
ፊደል ፊት = "ሀ"
```

- A type keyword before the name declares the variable **and** pins its type
  for the rest of its scope. Every later assignment to that name is checked;
  a mismatch is error `AH3009` (`የተለዋጩ አይነት አይመጣጠንም`).
- The initializer is required. `ቁጥር ቆጣሪ` with no `=` is error `AH2007`.
- Annotations are entirely optional; plain `ቆጣሪ = 0` is equally valid and
  stays untyped.
- `ፊደል` pins "a `ጽሁፍ` whose length is exactly 1".
- Redeclaring a name already declared in the same scope is error `AH2011`.

Annotations exist because the original grammar specified them
(`expression ::= KEYWORD:INT IDENTIFIER EQUAL arith_expr`) even though no v1
implementation ever parsed them, and because naming a type is pedagogically
useful. See CHANGES §C08.

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

ሃይሌ = ተማሪ("ኃይለሚካኤል")
የሃይሌ ክፍል = 10
ጻፍ(ሃይሌ.ስም + " — " + ሃይሌ.ደረጃ())
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
- Methods are bound: `ሃይሌ.ደረጃ` is a callable value even when not immediately
  called.

---

## 8. Built-in functions

These six names are pre-bound in the global scope. They are not keywords and
MAY be shadowed by user code. v1-py declared `ጻፍ`, `አዋህድ`, and `ሰርዝ` as
keywords but implemented only `ጻፍ`; calling either other one crashed the
interpreter with a Python exception (CHANGES §C13).

| Name | Signature | Result |
| --- | --- | --- |
| `ጻፍ` | `ጻፍ(…)` any arity | prints each argument separated by one space, then a newline; returns `ምንም` |
| `ርዝመት` | `ርዝመት(ጽሁፍ \| ስብስብ)` | `ቁጥር` length in code points / elements |
| `አዋህድ` | `አዋህድ(ስብስብ፣ ዕቃ)` | new `ስብስብ` with `ዕቃ` appended |
| `ሰርዝ` | `ሰርዝ(ስብስብ፣ ኢንዴክስ)` | new `ስብስብ` without that index; index rules as §6.5 |
| `አይነት` | `አይነት(any)` | `ጽሁፍ` naming the type (§4.1) |
| `አንብብ` | `አንብብ()` or `አንብብ(ጽሁፍ)` | reads one line from standard input as `ጽሁፍ`; the optional argument is printed as a prompt first |

`ርዝመት`, `አይነት`, and `አንብብ` are new in 2.0. Without `ርዝመት` there is no way to
walk a list whose length is not already known, which is why every v1 example
hardcodes `< 5`.

### 8.1 How values print

`ጻፍ` renders values as:

| Type | Rendering |
| --- | --- |
| `ቁጥር` | `42`, `3.5` — integral values with no decimal point |
| `እውነታ` | `እውነት` / `ሃሰት` |
| `ጽሁፍ` | the text itself, with no surrounding quotes |
| `ስብስብ` | `[ሀ፣ ለ፣ ሐ]` — Ethiopic comma and a space; nested text **is** quoted |
| `ምንም` | `ምንም` |
| `ተግባር` | `[ተግባር <name>]` |
| `ክላስ` | `[ክላስ <Name>]` |
| `ኦብጀክት` | `[<Name> ኦብጀክት]` |

Nesting is the only context where text is quoted, so that `ጻፍ(["ሀ"])` shows
`["ሀ"]` while `ጻፍ("ሀ")` shows `ሀ`.

---

## 9. Errors

### 9.1 Shape

Every error carries a stable code, an Amharic message, a line, and an inclusive
column span. The rendered form is:

```
የተሰበረ ህግ አለ።: መስመር 3 ላይ: 15ኛው ካራክተር
------------------------------------------------------------

    3: ዕድሜ > 18 ከሆነ
                   ↑

"፦" ይጠበቃል።
```

Runtime errors additionally render a call traceback (`የጥሪ መልሶ ምልከታ`), outermost
frame first, with the global frame named `ዋና ፕሮግራም`.

Codes are stable across releases and are what tooling matches on; the Amharic
text is what humans read and MAY be reworded. `AH1xxx` is lexical, `AH2xxx`
syntactic, `AH3xxx` runtime.

### 9.2 Catalogue

| Code | Meaning |
| --- | --- |
| `AH1001` | illegal character — `የማይታወቅ ካራክተር አለ።` |
| `AH1002` | bad leading whitespace — `የመስመር መጀመሪያ ክፍተት ስተት፡` |
| `AH1003` | unterminated string — `ያልተሟላ ፅሑፍ` |
| `AH1004` | `እስከሆነ` without `ድረስ` |
| `AH2001` | unexpected token |
| `AH2002` | missing closing `)` / `]` |
| `AH2003` | `ግን` without `<condition> ከሆነ` |
| `AH2004` | `ግን` / `አለበለዚያ` with no preceding `ከሆነ` |
| `AH2005` | `ተመላሽ` outside a function |
| `AH2006` | empty block |
| `AH2007` | typed declaration without an initializer |
| `AH2008` | chained comparison |
| `AH2009` | assignment to an index |
| `AH2010` | reserved word used |
| `AH2011` | redeclaration in the same scope |
| `AH2012` | duplicate parameter name |
| `AH2013` | illegal item in a class body |
| `AH2014` | `ተመላሽ <expr>` inside `ፍጠር` |
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
