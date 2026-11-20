---
id: functions
title: Functions
summary: Giving code a name and using it again
order: 60
---

When you find yourself writing the same code twice, give it a name and write
it once. That is a **function** — `ተግባር`.

```ahadu
ተግባር ሰላምታ(ስም)፦
    ጻፍ("ሰላም"፣ ስም)

ሰላምታ("አበበ")
ሰላምታ("አልማዝ")
```

```ውጤት
ሰላም አበበ
ሰላም አልማዝ
```

`ተግባር` comes first, then the name, then the **inputs** it accepts in
parentheses.

## Returning a value

A function can hand a value back with `ተመላሽ`.

```ahadu
ተግባር ድምር(ሀ፣ ለ)፦
    ተመላሽ ሀ + ለ

ውጤት = ድምር(3፣ 4)
ጻፍ(ውጤት)
ጻፍ(ድምር(10፣ 20))
```

```ውጤት
7
30
```

`ተመላሽ` stops the function immediately.

```ahadu
ተግባር ትልቁ(ሀ፣ ለ)፦
    ሀ > ለ ከሆነ፦
        ተመላሽ ሀ
    ተመላሽ ለ

ጻፍ(ትልቁ(12፣ 7))
ጻፍ(ትልቁ(3፣ 9))
```

```ውጤት
12
9
```

## Why they are worth it

A function gives you three things:

1. **No repetition** — write it once, call it many times
2. **A name** — `ትልቁ(ሀ፣ ለ)` says more than three lines of comparison
3. **One place to fix** — a mistake is corrected in a single spot

## A function that calls itself

A function may call itself. This is called recursion.

```ahadu
ተግባር ፋክቶሪያል(ቁ)፦
    ቁ <= 1 ከሆነ፦
        ተመላሽ 1
    ተመላሽ ቁ * ፋክቶሪያል(ቁ - 1)

ጻፍ(ፋክቶሪያል(5))
```

```ውጤት
120
```

`ፋክቶሪያል(5)` becomes `5 * ፋክቶሪያል(4)`, then `5 * 4 * ፋክቶሪያል(3)`, down to
1. That **stopping condition** is what makes it finish; without one it never
would.

## Input from the person running it

`አንብብ` reads a line from whoever is running the program.

```ahadu
ስም = አንብብ("ስምህ ማን ነው? ")
ጻፍ("እንኳን ደህና መጣህ"፣ ስም)
```

```ግቤት
አበበ
```

```ውጤት
ስምህ ማን ነው? እንኳን ደህና መጣህ አበበ
```

Running this one asks you for the answer first.

## Exercise

Write a function that returns whether a number is even.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ተግባር ጥንድ_ነው(ቁ)፦
    ተመላሽ ቁ % 2 == 0

ጻፍ(ጥንድ_ነው(4))
ጻፍ(ጥንድ_ነው(7))
```

```ውጤት
እውነት
ሃሰት
```

</details>
