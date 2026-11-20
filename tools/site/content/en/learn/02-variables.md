---
id: variables
title: Variables
summary: Storing values, numbers, text and types
order: 20
---

A **variable** is a name you give a value, so you can use it by name later.

```ahadu
ስም = "አበበ"
ዕድሜ = 25

ጻፍ(ስም፣ ዕድሜ)
```

```ውጤት
አበበ 25
```

Names are written in Amharic: `ስም` (name), `ዕድሜ` (age), `የተማሪ_ቁጥር`
(student number) all work.

## Changing a value

They are called variables because the value can change.

```ahadu
ቆጣሪ = 1
ጻፍ(ቆጣሪ)

ቆጣሪ = ቆጣሪ + 1
ጻፍ(ቆጣሪ)
```

```ውጤት
1
2
```

`ቆጣሪ = ቆጣሪ + 1` means "take what ቆጣሪ holds now, add one, and put the
result back into ቆጣሪ".

## Types of value

Ahadu has four basic types. The `አይነት` function — "type" — tells you which
one you have.

```ahadu
ጻፍ(አይነት(25))
ጻፍ(አይነት("አበበ"))
ጻፍ(አይነት(እውነት))
ጻፍ(አይነት([1፣ 2]))
```

```ውጤት
ቁጥር
ጽሁፍ
እውነታ
ስብስብ
```

Those are number, text, truth and collection.

Those four names — `ቁጥር`, `ጽሁፍ`, `እውነታ`, `ስብስብ` — belong to the language,
so they cannot be used as variable names:

```ahadu error=AH2001
ቁጥር = 4
```

Pick something else, like `አሃዝ` or `ተራ`.

## Arithmetic

Numbers take the usual operators.

```ahadu
ጻፍ(7 + 2)
ጻፍ(7 - 2)
ጻፍ(7 * 2)
ጻፍ(7 / 2)
ጻፍ(7 % 2)
```

```ውጤት
9
5
14
3.5
1
```

`%` gives the remainder — 7 divided by 2 leaves 1. It is how you test whether
a number is even.

## Joining text

On text, `+` joins.

```ahadu
የመጀመሪያ = "ተስፋ"
የአባት = "ማርያም"

ጻፍ(የመጀመሪያ + የአባት)
```

```ውጤት
ተስፋማርያም
```

A number and a piece of text cannot be added, though. This is an error:

```ahadu error=AH3002
ጻፍ("ዕድሜ፦ " + 25)
```

The message says what went wrong. If you want both on one line, pass them as
two values instead: `ጻፍ("ዕድሜ፦"፣ 25)`.

## Exercise

Work out the area and the perimeter of a rectangle 7 long and 4 wide.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ርዝመት = 7
ወርድ = 4

ጻፍ("ስፋት፦"፣ ርዝመት * ወርድ)
ጻፍ("ዙሪያ፦"፣ 2 * (ርዝመት + ወርድ))
```

```ውጤት
ስፋት፦ 28
ዙሪያ፦ 22
```

</details>
