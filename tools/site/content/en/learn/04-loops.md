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
