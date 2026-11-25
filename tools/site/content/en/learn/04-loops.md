---
id: loops
title: Repeating work
summary: Doing something over and over
order: 40
---

To print something ten times you do not write ten lines. You write a **loop**.

```ahadu
ቆጣሪ = 1

ቆጣሪ <= 5 እስከሆነ ድረስ፦
    ጻፍ(ቆጣሪ)
    ቆጣሪ = ቆጣሪ + 1
```

```ውጤት
1
2
3
4
5
```

As with conditions, the test comes first: "ቆጣሪ is less than or equal to 5,
**for as long as that holds**". `እስከሆነ ድረስ` wraps around the condition.

## How it works

A loop needs three things:

1. **A start** — `ቆጣሪ = 1`
2. **A condition** — `ቆጣሪ <= 5`; it repeats while this is true
3. **A change** — `ቆጣሪ = ቆጣሪ + 1`; without it the loop never ends

Forgetting the third is the classic mistake. If you do, the program will not
stop on its own — but Ahadu stops it after a great many steps and says so,
rather than hanging.

## Adding up

```ahadu
ቁ = 1
ድምር = 0

ቁ <= 10 እስከሆነ ድረስ፦
    ድምር = ድምር + ቁ
    ቁ = ቁ + 1

ጻፍ("ከ1 እስከ 10 ድምር፦"፣ ድምር)
```

```ውጤት
ከ1 እስከ 10 ድምር፦ 55
```

## A times table

```ahadu
ተራ = 1

ተራ <= 5 እስከሆነ ድረስ፦
    ጻፍ(7፣ "x"፣ ተራ፣ "="፣ 7 * ተራ)
    ተራ = ተራ + 1
```

```ውጤት
7 x 1 = 7
7 x 2 = 14
7 x 3 = 21
7 x 4 = 28
7 x 5 = 35
```

## A condition inside a loop

The two work together.

```ahadu
ቁ = 1

ቁ <= 10 እስከሆነ ድረስ፦
    ቁ % 2 == 0 ከሆነ፦
        ጻፍ(ቁ፣ "ጥንድ")
    ቁ = ቁ + 1
```

```ውጤት
2 ጥንድ
4 ጥንድ
6 ጥንድ
8 ጥንድ
10 ጥንድ
```

Notice that `ጻፍ` is indented twice — once for the loop, once for the
condition inside it.

## For each

Walking through a collection or a piece of text needs no counter. That is
what `ለእያንዳንዱ` is for.

```ahadu
"አሃዱ" ለእያንዳንዱ ፊደሉ፦
    ጻፍ(ፊደሉ)
```

```ውጤት
አ
ሃ
ዱ
```

As everywhere else, the thing being looped over comes first: "አሃዱ
**ለእያንዳንዱ** ፊደሉ" — for each letter of አሃዱ.

The three parts above — a start, a condition, a change — are not needed
here; Ahadu keeps track of them. So the mistake of forgetting the third one
cannot happen in this kind of loop at all.

A collection works the same way:

```ahadu
ዋጋዎች = [12፣ 7፣ 30]
ድምር = 0

ዋጋዎች ለእያንዳንዱ ዋጋ፦
    ድምር = ድምር + ዋጋ

ጻፍ("ድምር፦"፣ ድምር)
```

```ውጤት
ድምር፦ 49
```

Collections get a lesson of their own next.

### Which one should I use?

- **ለእያንዳንዱ** — when you are walking a collection or some text. This is
  most of the time.
- **እስከሆነ ድረስ** — when the condition is about something other than a
  collection, or when you need the position itself.

## Exercise

Print the squares of the numbers from 1 to 5.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ቁ = 1

ቁ <= 5 እስከሆነ ድረስ፦
    ጻፍ(ቁ፣ "ካሬ"፣ ቁ * ቁ)
    ቁ = ቁ + 1
```

```ውጤት
1 ካሬ 1
2 ካሬ 4
3 ካሬ 9
4 ካሬ 16
5 ካሬ 25
```

</details>
