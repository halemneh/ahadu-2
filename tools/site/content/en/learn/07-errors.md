---
id: errors
title: Reading errors
summary: What the language tells you when something is wrong
order: 70
---

Making mistakes is part of learning. The good news is that Ahadu says clearly
what went wrong.

Every error carries three things: a **code**, a **message**, and a **place**.

```ahadu error=AH3001
ጻፍ(ያልተሰየመ)
```

`AH3001` is the code. The message states the problem. The line and column say
where to look.

## Three kinds of error

The number the code starts with tells you **when** the problem was found.

### AH1 — lexical

Found while splitting the text into words. A character that means nothing:

```ahadu error=AH1001
ሀ = 5 $ 3
```

Or indentation that does not line up:

```ahadu error=AH1002
ሀ = 1
  ለ = 2
```

### AH2 — syntax

The words are fine but their arrangement is not:

```ahadu error=AH2002
ጻፍ("ያልተዘጋ"
```

Both of these are found **before the program starts**, so you are told
without a single line having run.

### AH3 — runtime

Raised while the program runs. Everything before it really did happen.

```ahadu error=AH3003
ጻፍ("ከዚህ በፊት ይሄዳል")
ጻፍ(10 / 0)
```

Dividing by zero cannot be spotted while reading the program — whether the
divisor is zero is only known once it runs. That is exactly why it is an AH3.

> This grouping is a promise about *when* a problem can be detected, not a
> filing system. It is why `AH3003` could never be an `AH2`.

## Errors you will meet

| Code | Meaning |
| --- | --- |
| `AH3001` | a variable was used before it was given a value |
| `AH3002` | an operation the types do not allow — adding text to a number |
| `AH3003` | division by zero |
| `AH3008` | a position outside the collection was asked for |
| `AH3019` | `ወደ_ቁጥር` was given text that is not a number |
| `AH1002` | the indentation at the start of a line is wrong |
| `AH2002` | a bracket was never closed |

The full list is in the [reference](/en/reference/).

### Two worth recognising on sight

`AH3002` and `AH3019` are the two that come from reading input, and together
they account for most of a beginner's errors:

```ahadu error=AH3019
ጻፍ(ወደ_ቁጥር("ሰላም"))
```

`ወደ_ቁጥር` was handed something that does not spell a number. Guard with
`ቁጥር_ነው` before converting — the "Asking a question" lesson shows how.

### When a name used to be a function

This one reads oddly until you have seen it once:

```ahadu error=AH3013
ርዝመት = 5
ጻፍ(ርዝመት("ሰላም"))
```

`ርዝመት` is an ordinary name that the language happens to have filled in for
you, so you *may* assign to it — and then it is a number, and a number cannot
be called. Ahadu notices and says which function you replaced. The fix is
always to rename your own variable.

## How to fix one

1. **Read the code** — AH1 or AH3 tells you where to look
2. **Go to the line** — start where the error points
3. **Change one thing** — then run it again

Try fixing the examples above. For the first one, give `ያልተሰየመ` a value
before using it.

## Exercise

This program has three mistakes. Find them and fix them.

```ahadu error=AH1002
ድምር = 0
ቁ = 1

  ቁ <= 3 እስከሆነ ድረስ
    ድምር = ድምር + ቁ
```

<details class="answer">
<summary>Show the answer</summary>

The mistakes are: an indent that should not be there, a missing `፦`, and a
counter that never grows.

```ahadu
ድምር = 0
ቁ = 1

ቁ <= 3 እስከሆነ ድረስ፦
    ድምር = ድምር + ቁ
    ቁ = ቁ + 1

ጻፍ(ድምር)
```

```ውጤት
6
```

</details>
