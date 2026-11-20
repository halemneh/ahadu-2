# Gap Analysis and Resolutions — v1 → Ahadu 2.0

Two predecessor implementations exist, and they do not describe the same
language:

- **v1-py** — Python. A complete pipeline: lexer → parser → tree-walking
  interpreter, plus a Flask playground. This is the *de facto* definition of
  Ahadu: the paper, the presentation, and all example programs target it.
- **v1-ts** — TypeScript, spec-driven, ~7.6k lines of tests. Lexer and parser
  only; no evaluator. Hardened in ways v1-py never was (BOM, zero-width code
  points, error recovery, position spans), but it diverges from v1-py on core
  syntax.

Neither is public. Every claim made about them below is quoted or described in
enough detail to be followed without them.

Neither had a written language specification. This document records every
divergence, defect, and gap found while reading both, and the resolution 2.0
adopts. Section anchors (`C01`…) are cited from
[LANGUAGE.md](./LANGUAGE.md).

Severity: **critical** = the language is wrong or a correct program fails ·
**major** = silently wrong results or an implementation crash ·
**minor** = rough edge, inconsistency, or dead code.

---

## A. Conflicts between v1-py and v1-ts

### C01 — Conditional and loop word order is inverted · critical

v1-py, the paper, and every example program put the condition **first**:

```ahadu
ስም == "አልማዝ" ከሆነ፦          # "if the name is አልማዝ"
ቆጣሪ < 5 እስከሆነ ድረስ፦        # "while the counter is under 5"
```

v1-ts parses the keyword **first** (`src/parser/parser.ts:188`,
`parseIfStatement` consumes `IF` then reads the condition):

```ahadu
ከሆነ ስም == "አልማዝ":-
እስከሆነ ድረስ ቆጣሪ < 5:-
```

This is English order with Amharic words — exactly what the project set out
not to be — and it means **none** of the original example programs parse under
v1-ts. Its spec (`specs/003-amharic-parser/spec.md` FR-022, FR-024) and all its
control-flow tests encode the inverted form, so the error is in the
specification, not a slip in the code.

**Resolution**: condition-first is normative (§7.3, §7.4). The parser parses an
expression at statement start, then looks at the next token: `ከሆነ` makes the
expression a condition, `እስከሆነ ድረስ` makes it a loop condition, otherwise the
statement is an expression or assignment. One token of lookahead, no
backtracking.

### C02 — else-if shape · critical

Follows from C01. v1-py: `ግን <condition> ከሆነ፦` — `ግን` ("but") leads, then the
condition, then `ከሆነ`. v1-ts: `ግን ከሆነ <condition>:-`.

**Resolution**: `ግን <condition> ከሆነ፦` (§7.3).

### C03 — Class bodies lose their structure · major

v1-py's `ClassDefNode` distinguishes `attributes`, `init`, and `methods`, and
`class_definition()` enforces that a class body contains only those three
things. v1-ts models it as `ClassDeclaration { name, body: Block }` — an
arbitrary statement list — so `ክላስ` with a loop in its body parses fine and
there is no constructor concept. v1-ts also has no inheritance syntax, which
v1-py does.

**Resolution**: structured class bodies with attribute declarations, at most one
`ፍጠር`, and methods; anything else is `AH2013`. Single inheritance via
`ክላስ Name(Parent)፦` (§7.6).

### C04 — Slicing missing from the v1-ts AST · major

v1-py supports `x[a:b]`, `x[:b]`, `x[a:]` through a `SLICE` operator. The v1-ts
AST has only `IndexExpression { target, index }` — no slice node — so slicing
cannot be represented at all.

**Resolution**: slicing is in the language (§6.5) and needs its own node.

### C05 — `፦` optional vs required · major

v1-py's `if_statement`, `while_statement`, and `function_definition` all do
`if curr_token.type == THEN_T: next_token()` — the block opener is optional,
so `ዕድሜ > 18 ከሆነ` followed by an indented line is accepted. v1-ts calls
`expectToken(THEN_T)` and requires it.

**Resolution**: required (§5.2). The marker is what makes a block visually
obvious to a beginner, and optionality here bought nothing.

### C06 — Inline block bodies · major

v1-py accepts single-line bodies for `if`, `while`, and functions
(`ዕድሜ > 18 ከሆነ፦ ጻፍ("ትልቅ")`) through a tangle of `prev_tokens()`
backtracking, and inline `ግን`/`አለበለዚያ` branches can be mixed into an otherwise
indented `if`. v1-ts supports block form only.

**Resolution**: block form only (§5.2). Two shapes for one construct violates
principle 4, and the inline path was the least reliable code in v1-py.

### C07 — `አዲስ` / `NewExpression` was invented · major

`አዲስ` ("new") is in v1-py's keyword table but no parser rule or interpreter
path ever references it; objects are constructed by calling the class name
(`አበበ = ተማሪ("…")`). v1-ts built a whole `NewExpression` node and
`parseNewExpression` for a syntax the language never had.

**Resolution**: construction is a call on the class value (§7.6). `አዲስ` is
reserved, with no syntax (§3.2).

### C09 — `&` as `እና`, and no `|` · minor

Both v1s lex `&` to `KEYWORD:AND`. Neither has `|` for `ወይም`, and bare `!`
means `ተቃርኖ` in both but was left out of the 2.0 draft. The defect is the
**asymmetry**, not the shorthand.

**Resolution**: all three kept and made symmetric — `&` for `እና`, `|` for
`ወይም`, `!` for `ተቃርኖ`, with `&&` and `||` accepted as well since Ahadu has no
bitwise operators for them to collide with (§3.2, §3.5). An alias costs one
lexer branch and saves a learner who already types `!`.

### C10 — `እና` and `ወይም` have equal precedence · major

v1-py passes both in one tuple to `binary_operation`, so they share a
precedence level and bind left to right: `ሀ ወይም ለ እና ሐ` evaluates as
`(ሀ ወይም ለ) እና ሐ`. v1-ts gives `ወይም` 1/2 and `እና` 3/4 — the conventional
nesting.

**Resolution**: `እና` binds tighter (§6.1), matching v1-ts and every mainstream
language.

### C11 — `እስከሆነ` without `ድረስ`: three behaviors · major

v1-py's `alpha_token` looks ahead for `·ድረስ`; if absent it **still** returns
`KEYWORD:WHILE`, so a bare `እስከሆነ` silently acts as a loop head. v1-ts demotes
it to an `IDENTIFIER`, which makes `እስከሆነ = 5` a legal assignment. Its own
lexer spec (FR-016) is ambiguous about which is intended.

**Resolution**: `እስከሆነ` is reserved. Alone, it is error `AH1004`
(`"ድረስ" ይጠበቃል`) — neither a silent loop nor a variable name (§3.8).

### C12 — Assignment parsed as an expression · major

Both v1s route assignment through expression parsing (v1-py's `experssion()`
checks for `IDENT =` and backtracks if absent). Consequences: `ሀ = ለ = 1`
parses, and `ሀ = 1 ከሆነ፦` parses as a condition whose value is an assignment.

**Resolution**: assignment is a statement (§7.1). Legal targets are an
identifier, `obj.attr`, or `የobj attr`.

### C41 — Mixed leading whitespace counted differently · minor

v1-py emits a `TAB` token the instant it sees `\t` and accumulates spaces in
groups of 4 separately, so `"  \t"` (two spaces, a tab) yields one TAB and then
an indentation error for the orphaned 2 spaces. v1-ts normalizes the whole run
(2 + 4 = 6), emits one INDENT, and reports 2 leftover — same verdict, different
reported column.

**Resolution**: normalize the whole run, then divide by 4 (§3.7). The reported
column is the first leftover column.

### C42 — EOF column for empty input · minor

v1-ts puts EOF at column 0 for empty input and column 1 otherwise; v1-py always
column ≥ 1. Column 0 does not exist in a 1-based scheme.

**Resolution**: EOF for empty or BOM-only input is line 1, column 1 (§3.8).

---

## B. Specified but never implemented

### C08 — Type annotations · major

v1-py's `resources/grammer.txt` opens with
`expression ::= KEYWORD:INT IDENTIFIER EQUAL arith_expr` — typed declarations
were part of the design — and `ቁጥር እውነታ ፊደል ጽሁፍ ስብስብ አዲስ` are all in the
keyword table. The v1-py parser never reads any of them, so `ቁጥር ቆጣሪ = 0`
fails to parse. v1-ts implemented `TypedDeclaration` but, having no evaluator,
never gave it meaning.

**Resolution**: optional, runtime-checked annotations (§7.2), honoring the
documented intent — except `ፊደል`, which is reserved rather than revived. A
string of length 1 **is** the character (§4.3): neither v1 ever had a distinct
character value, and an annotation naming a type that `አይነት` can never report
would be a concept with nothing behind it.

### C13 — `አዋህድ` and `ሰርዝ` crash the interpreter · critical

Both are in `BUILT_IN_FUNCS`, both lex and parse, and `visit_BuiltInFuncNode`
dispatches via `getattr(self, f'built_in_{name}', self.unknown_func)`. Only
`built_in_PRINT` exists. `unknown_func` is declared with four parameters but
called with five, so calling `አዋህድ(…)` raises a Python `TypeError` — an
uncaught crash, not an Ahadu error.

**Resolution**: a defined set of six built-ins, all implemented, as ordinary
global bindings rather than keywords (§8).

### C14 — Block comments · minor

`COMMENT_BLOCK = r'["{3}]'` sits in v1-py's constants, unreferenced. (The regex
is also wrong — a character class, not a triple quote.)

**Resolution**: not in 2.0, documented as absent (§2.3).

### C18 — Inheritance crashes · critical

`ClassDefNode` carries a `parent`, and `class_definition()` parses
`ክላስ ተማሪ(ወላጅ)፦`. But `visit_ClassDefNode` guards with
`context.object_table.get(node.parent)` and `Context` has no `object_table`
attribute, so declaring any subclass raises `AttributeError`. Had it gotten
past that, `Class.__init__` does `self.parent.class_context` where `parent` is
still a lexer `Token`.

**Resolution**: inheritance works, with the parent resolved in the declaring
scope and a real error (`AH3011`) when it is unknown (§7.6).

### C34 — Dead and mislabelled constants · minor

In `resources/constants.py`: `ELIF = 'ደግሞ'` is never used (`ግን` is the actual
else-if lead-in); `ELIF_START_T = 'ELSE_START'` names the wrong thing;
`BOOL_T` is defined twice; `EQ_T = 'EQUVALENT'` and `NEQ_T = 'NEQUAL'` are
misspelled; the keyword map itself is named `KEYWORS`; `NO_OF_ARGS_PASSED = ''`
is an error message that is the empty string; `INDEX_OUT_OF_BOUNDS` is the only
message left in English.

**Resolution**: one error catalogue with stable codes and Amharic text
(§9.2).

---

## C. Defects in v1-py

### C19 — Falsy symbol lookup · critical

```python
def get(self, identifier):
    value = self.symbols.get(identifier, None)
    if not value and self.parent:
        return self.parent.get(identifier)
    return value
```

`not value` is true for `Number(0)`, an empty string, and an empty array, so a
variable holding any of them is treated as absent: lookup escapes to the parent
scope or, in `visit_VarAccessNode`, reports `ያልታወቀ ተለዋጭ`. The counter idiom
that opens three of the four shipped examples — `ቆጣሪ = 0` — is broken on the
next line that reads `ቆጣሪ`.

**Resolution**: lookup is by presence (§5.3).

### C20 — Division dispatches to a method that does not exist · critical

`interpreter.py` calls `left.divid(right)`. `type.py` defines `divide`.
`DefaultType` has no `divid` either, so every `/` raises `AttributeError`.
Division is entirely non-functional in v1-py.

**Resolution**: fixed by construction; `/` is specified in §6.2 and covered by
conformance cases.

### C21 — Bare `ተመላሽ` crashes · major

The parser builds `ReturnNode(None)` for a bare `ተመላሽ`, then
`visit_ReturnNode` calls `self.visit(node.expr, context)` with `None`, landing
in `no_visit`, which does `raise Exception`.

**Resolution**: bare `ተመላሽ` returns `ምንም` (§4.6, §7.5).

### C22 — Comment at end of file loops forever · critical

```python
def comment_line(self):
    while self.curr_char != '\n' and self.curr_char != '\r' and (
            self.curr_char != '\r\n'):
        self.next_char()
```

At end of input `curr_char` is `None`, which satisfies all three inequalities,
so a file whose last line is a comment with no trailing newline hangs the
lexer. (The `'\r\n'` comparison is also dead code — `curr_char` is always a
single character.) v1-ts's `skipComment` checks `isAtEnd()` and is correct.

**Resolution**: all scanning loops terminate on end of input (§3.9).

### C17 — Early `ተመላሽ` is silently discarded · critical

`visit_FunctionDefNode` decides once, syntactically, whether a function returns:

```python
should_rtn = isinstance(node.body.expr_list[-1], ReturnNode)
```

Only a `ተመላሽ` as the **last** statement of the body counts. `Function.run`
then throws the body's value away unless `should_return`. So this returns
`ምንም`:

```ahadu
ተግባር ትልቁ(ሀ፣ ለ)፦
    ሀ > ለ ከሆነ፦
        ተመላሽ ሀ
    ተመላሽ ለ
```

and worse, a `ተመላሽ` inside a loop does not exit the loop — `visit_WhileNode`
keeps iterating.

**Resolution**: `ተመላሽ` returns immediately from anywhere in the function
(§7.5). Implementations should use a return signal (an exception or a
completion value), not a syntactic guess.

### C23 — `የ` is torn off every identifier · critical

```python
if self.curr_char == 'የ':
    self.next_char()
    return Token(OF_T, start_line, start_col)
```

This fires before the word is scanned, so **any** word starting with `የ`
becomes `OF` plus the remainder. `የኔ` is `OF` + `ኔ`; `የመጀመሪያ = 1` is `OF`,
`መጀመሪያ`, `=`, `1` and fails to parse. `የ-` is one of the most common prefixes
in Amharic, so a large class of natural variable names is unusable.

**Resolution**: the lexer keeps the word whole and flags `hasOfPrefix`; the
parser treats it as a possessive only when an identifier immediately follows
(§3.3).

### C15 — `ስብስብ + ስብስብ` appends instead of concatenating · major

```python
def add(self, x):
    new_array = copy.deepcopy(self)
    new_array.value.append(x)
    return new_array, None
```

`[1፣ 2] + [3፣ 4]` yields `[1, 2, [3, 4]]`. `Array` also has no `eq`, `neq`,
`lt`, or `multiply`, so comparing two lists raises `AH3002`-equivalent errors,
and `#TODO: at equals and not equals` is still in the file.

**Resolution**: `+` concatenates into a new list; `አዋህድ` appends one element to
the list in place; `==` compares element-wise (§4.5, §6.2, §6.3, §8).

### C16 — Open-ended slice drops the last element · major

```python
if not end: end = Number(len(self.value) - 1)
...
return Array(self.value[start.value: end.value])
```

The default end is `n-1` and the slice is exclusive, so `x[:]` and `x[2:]` lose
the final element. The `if not start` / `if not end` guards are falsy checks as
well, so an explicit `x[0:…]` takes the default path — harmlessly for the start,
but it is the same class of bug as C19.

**Resolution**: the default end is `n` (§6.5).

### C27 — Negative index bounds check is inconsistent · major

```python
if abs(x.value) >= len(self.value):
    return INDEX_OUT_OF_BOUNDS
return self.value[x.value]
```

The docstring promises `index = len - x` for negatives, but the code relies on
Python's own negative indexing while bounds-checking the absolute value. For
`n = 5`, `x[-5]` is rejected even though it is the first element, while `x[-1]`
works. A TypeScript port has no negative indexing to lean on, so the behavior
must be stated outright.

**Resolution**: effective index is `i < 0 ? n + i : i`, checked against
`0 … n-1` (§6.5).

### C26 — `String.eq` returns a `ጽሁፍ` holding a number · major

```python
return String(int(self.value == x.value)), None
```

Comparing two strings yields `String(1)` or `String(0)`, not a Boolean or even
a Number. `visit_IfNode`'s `cond.value != 0` happens to work on it, but
`"ሀ" == "ሀ"` is then a `ጽሁፍ` that can be concatenated with another string.
`String.multiply`'s error also reports the operation as `መቀነስ` (subtraction).

**Resolution**: every comparison yields `እውነታ` (§6.2).

### C35 — Attributes cannot be created, only overwritten · major

`visit_VarAssignNode` resolves an attribute target by **reading** it first
(`self.visit(identifier, obj_context)`), so assigning to an attribute that was
not declared in the class body fails with `ያልታወቀ ተለዋጭ` rather than a message
about attributes. Combined with C19, an attribute declared as `= 0` or `= ""` —
as three of the four in the `ተማሪ` example are — is unreadable and therefore
unwritable.

**Resolution**: attributes are declared in the class body with defaults;
assigning an undeclared one is `AH3012` with a message that says so (§7.6).

### C31 — `ጻፍ` takes exactly one argument · minor

`built_in_PRINT` returns an error for two or more arguments, and the message is
`NO_OF_ARGS_PASSED`, which is `''`. Printing a label next to a value requires
string concatenation and therefore manual conversion of every number.

**Resolution**: `ጻፍ` is variadic and space-separates (§8).

### C33 — Unreachable error branches · minor

Several guards compare a `Token` object to a token-type **string**:

```python
if self.curr_token.type != THEN_T and (self.curr_token == NEWLINE_T):
```

The right half is always false, so the whole guard is dead and the
`Expected ':-'` error can never fire. `parse()` also `print()`s the current
token and the AST to stdout on an incomplete-expression error — debug output
left in the shipped error path.

**Resolution**: covered by the error catalogue and by conformance tests that
assert each diagnostic actually fires (§9.2).

### C40 — Unterminated string reports the wrong line · minor

`check_string` raises `IllegalCharacterError(self.line - 1, curr_col, …)` —
deliberately backing up a line because the newline has already been consumed —
but the column it passes is a running count of string characters, not a source
column. For a string opened mid-line the caret lands in the wrong place.

**Resolution**: the error spans the opening delimiter to the last character
scanned, on the line where the string opened (§3.6).

---

## D. Behavior that was never pinned down

### C24 — Truthiness · critical

v1-py has no Boolean type. `visit_IfNode` tests `cond.value != 0`, so any
number is a condition, `"ሀ"` in a condition compares a string to `0` (true,
always), and `እውነታ` is a type keyword naming a type that does not exist.

**Resolution**: `እውነታ` is a real type with two values, and conditions MUST be
`እውነታ` (§4.4). Error `AH3005` otherwise.

### C25 — `እውነት` / `ሃሰት` are not keywords in v1-py · critical

`TRUE_T` and `FALSE_T` are defined in constants but **absent** from the
`KEYWORS` map, so `እውነት` lexes as an identifier and evaluates to
`ያልታወቀ ተለዋጭ`. There is no way to write a Boolean literal. v1-ts added all 14
spellings to its keyword table — the right call.

**Resolution**: literals, with every spelling variant (§3.2).

### C43 — No no-value · major

v1-py's `visit_VarAssignNode` reports `"Var can't be equal to NoneType"` — in
English — when the right-hand side evaluates to Python `None`, which is what a
call to a function without a terminal `ተመላሽ` produces. So `ሀ = ሰላም_በል("x")` is
an error whose message leaks the host language.

**Resolution**: `ምንም` is a first-class value (§4.6).

### C30 — Integral floats print with a decimal point · minor

Division always produces a Python float, so `4 / 2` prints `2.0` and
`ጻፍ(6 / 3)` shows `2.0`. For an audience learning what division is, that is
noise.

**Resolution**: integral numbers print without a decimal point (§4.2).

### C37 — Number literal edge cases · minor

`num_token` accepts one `.` anywhere in the run, so `5.` is `float('5.')` =
`5.0` and `1.2.3` becomes `1.2` then `.` then `3` — the latter a parse error
only by accident. `parseFloat('5.')` in JavaScript gives the same answer by a
different route, which is the kind of coincidence a spec should not rely on.

**Resolution**: a `.` requires digits on both sides (§3.4).

### C38 — No overflow or domain guards · minor

`^` uses Python's `**`, so `(-8) ^ 0.5` returns a complex number and
`10 ^ 400` returns a float `inf`; both then flow into arithmetic as if ordinary.

**Resolution**: errors `AH3004` and `AH3006` (§6.2). `NaN` and `±Infinity` are
unreachable (§4.2).

### C39 — Chained comparison silently computes `(a<b)<c` · minor

`comparison_expression` loops over comparison operators, so `ሀ < ለ < ሐ`
evaluates left to right and compares a Boolean-ish `0`/`1` against `ሐ` — a
plausible beginner mistake that produces a plausible-looking answer.

**Resolution**: comparison is non-associative; `AH2008` (§6.1).

### C32 — Value vs reference semantics · major

v1-py deep-copies in several unrelated places — the callee before a call
(`copy.deepcopy(left)`), the return value when `should_return`, the class
context on construction, the array in `Array.add` — and nowhere else. Whether
two names can refer to one list or one object was never decided.

**Resolution**: stated outright instead of emerging from where a `deepcopy`
happened to land. Strings are immutable (§4.3). Lists and objects are mutable
references, so sharing is observable and `ለ = ሀ` gives one list two names
(§4.5, §4.7); `ቅጂ` is the explicit opt-out. Nothing is copied implicitly —
not arguments, not return values, not an object's class context.

### C36 — Identifier character range, and Ge'ez numerals · minor

`ALPHANUMERAL = r'[a-zA-Zሀ-ፚ0-9_]+'` covers the Ethiopic syllable block only.
Ethiopic Supplement, Extended, and Extended-A are excluded, so those code
points are illegal characters anywhere in a program. Ethiopic digits and
numerals (U+1369–U+137C) are excluded too, meaning `፳፩` could be neither a
name nor a number — Amharic's own numerals were not writable in an Amharic
language.

**Resolution**: the supplement and extended blocks join the identifier ranges
(§3.1); the numerals become number literals (§3.4.1), so they are digits
rather than word characters. Three limits come from the numeral system itself
and are stated rather than worked around: it has no zero, no fractional form,
and output is always ASCII.

### C29 — `።` is an illegal character · minor

The Ethiopic full stop — the ordinary end-of-sentence mark in Amharic — is not
in either lexer's dispatch table, so writing it after a statement is error
`AH1001`. It survives in the examples only inside string literals.

**Resolution**: `።` is an optional statement terminator (§3.5, §5.1).

---

## E. Capabilities that were missing

### C28 — No way to get a length · major

Neither `ርዝመት` nor any equivalent exists, so a loop over a list can only be
written against a hardcoded bound. Both shipped list examples do exactly that:
`ቆጣሪ < 5 እስከሆነ ድረስ` over a five-element array. The language could not express
"for each item in this list".

**Resolution**: `ርዝመት` (§8), plus `ቅጂ`, `አይነት`, and `አንብብ` for the same
reason — the smallest set that makes beginner exercises writable. `ቅጂ` is the
one that comes with mutability: once `ለ = ሀ` shares a list, there has to be a
way to say "give me my own".

### C45 — v1-ts has no evaluator · critical

v1-ts ships a lexer and a parser with extensive tests and no execution stage,
so none of its syntax decisions were ever validated by running a program. That
is the mechanism behind C01: an inverted `if` is invisible until something
tries to execute the original examples.

**Resolution**: conformance cases in 2.0 are **programs with expected output**,
not token or AST snapshots, so a syntax decision cannot pass review without
running (§TOOLING).

---

## Carried forward from v1-ts

These v1-ts behaviors have no v1-py counterpart and are adopted as-is:

- BOM at file start skipped, no column consumed.
- U+200B / U+200C / U+200D / U+00AD skipped everywhere, including inside
  identifiers, with no column consumed.
- Malformed UTF-8 decoded to U+FFFD rather than aborting.
- Lexer and parser never throw; both return `(result, errors)` with errors
  sorted by position.
- Inclusive `startCol` / `endCol` spans on every token and AST node, with
  multi-word `እስከሆነ ድረስ` spanning the separating space.
- Parser error recovery with panic-mode resynchronization.
- `%` for modulo (absent from v1-py entirely).
- `&` for `እና` and bare `!` for `ተቃርኖ`, now joined by `|` for `ወይም` (C09).
- Whole-word keyword matching, so `ከሆነነገር` is one identifier.

## Deliberately not carried forward

| Dropped | Why |
| --- | --- |
| `አዲስ` / `NewExpression` | C07 — syntax the language never had |
| inline `if` / `while` / function bodies | C06 — second shape, worst code path |
| optional `፦` | C05 — the block marker is the teaching aid |
| assignment as an expression | C12 — enables `ሀ = 1 ከሆነ፦` |
| implicit truthiness | C24 — the top source of confusing beginner bugs |
| `ደግሞ` as else-if | C34 — dead constant; `ግን` is the real one |
