---
id: conditions
title: Making decisions
summary: ከሆነ, ግን, አለበለዚያ — and the word order that matters
order: 30
---

A program does not always run straight down. Sometimes you need to say "if
this is true, do that".

```ahadu
ዕድሜ = 20

ዕድሜ > 18 ከሆነ፦
    ጻፍ("ትልቅ ሰው")
```

```ውጤት
ትልቅ ሰው
```

## The condition comes first

This is the one thing about Ahadu most worth understanding. English-based
languages say `if age > 18` — keyword first, condition second. Amharic does
not say it that way. It says "ዕድሜው ከ18 በላይ **ከሆነ**" — the condition, then
the word that makes it a question.

Ahadu follows the Amharic:

```ahadu fragment
ዕድሜ > 18 ከሆነ፦
```

Read aloud, the code is the sentence. `፦` is the Ethiopic colon, and it means
"what follows belongs to this".

> This is also the single biggest fix in version 2. Version 1 parsed these
> clauses the other way round, so conditions ran inverted — and 7,600 passing
> tests never noticed, because none of them ran a whole program and looked at
> what it printed.

## Two ways

What if the condition is not true? `አለበለዚያ` — "otherwise".

```ahadu
ዕድሜ = 12

ዕድሜ > 18 ከሆነ፦
    ጻፍ("ትልቅ ሰው")
አለበለዚያ፦
    ጻፍ("ልጅ")
```

```ውጤት
ልጅ
```

## More than two

`ግን` adds another condition. Note the shape: `ግን` leads, then the condition,
then `ከሆነ`.

```ahadu
ነጥብ = 75

ነጥብ > 89 ከሆነ፦
    ጻፍ("ኤ")
ግን ነጥብ > 79 ከሆነ፦
    ጻፍ("ቢ")
ግን ነጥብ > 69 ከሆነ፦
    ጻፍ("ሲ")
አለበለዚያ፦
    ጻፍ("ወድቋል")
```

```ውጤት
ሲ
```

They are tested top to bottom. The first true one runs and the rest are never
looked at.

## Comparisons

| Operator | Meaning |
| --- | --- |
| `>` | greater than |
| `<` | less than |
| `>=` | greater than or equal |
| `<=` | less than or equal |
| `==` | equal |
| `!=` | not equal |

`=` and `==` are different. `=` stores a value; `==` compares two.

## Joining conditions

`እና` (and), `ወይም` (or) and `አይደለም` (not) combine conditions.

```ahadu
ዕድሜ = 25
ሥራ = እውነት

ዕድሜ > 18 እና ሥራ ከሆነ፦
    ጻፍ("ብድር ይፈቀዳል")
```

```ውጤት
ብድር ይፈቀዳል
```

## Indentation counts

The lines after `፦` must be indented. Everything indented belongs to the
condition.

```ahadu
አሃዝ = 4

አሃዝ % 2 == 0 ከሆነ፦
    ጻፍ("ጥንድ ነው")
    ጻፍ("ይህም የሁኔታው አካል ነው")

ጻፍ("ይህ ግን ሁልጊዜ ይጻፋል")
```

```ውጤት
ጥንድ ነው
ይህም የሁኔታው አካል ነው
ይህ ግን ሁልጊዜ ይጻፋል
```

## Exercise

Write a program that says whether a number is even or odd.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
አሃዝ = 7

አሃዝ % 2 == 0 ከሆነ፦
    ጻፍ(አሃዝ፣ "ጥንድ ነው")
አለበለዚያ፦
    ጻፍ(አሃዝ፣ "ጎዶሎ ነው")
```

```ውጤት
7 ጎዶሎ ነው
```

</details>
