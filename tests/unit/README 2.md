# `tests/unit`

Stage-level tests. These exist to **localize** a failure to the lexer, the
parser, or the evaluator — they do not define the language.

The language is defined by `tests/conformance`, which runs whole programs and
checks their output. v1-ts had 7,600 lines of unit tests that all agreed with
its code while the code parsed `ከሆነ` in the wrong word order, because nothing
ever executed a real program (CHANGES C01, C45). Add a conformance case first,
then add unit tests here to pin down where it broke.
