---
id: amharic-numbers-and-dates
title: Amharic numbers and dates
summary: ወደግዕዝ, ዛሬ, and the thirteen months
order: 67
---

Two things Ahadu can do that no other programming language can.

## Writing Ge'ez numerals

You have been able to *type* Amharic numerals since lesson two — `፳፩` is a
perfectly good `21`. `ወደግዕዝ` goes the other way:

```ahadu
ጻፍ(ወደግዕዝ(1)፣ ወደግዕዝ(7)፣ ወደግዕዝ(10)፣ ወደግዕዝ(100))
```

```ውጤት
፩ ፯ ፲ ፻
```

The system is additive rather than positional: `፫፻፳፩` is 3×100 + 20 + 1.

```ahadu
ጻፍ(ወደግዕዝ(2017))
ጻፍ(ወደቁጥር("፳፩") + 1)
```

```ውጤት
፳፻፲፯
22
```

`ወደቁጥር` and `ወደግዕዝ` are each other's opposite, so one undoes the other.

### There is no ፼ for zero

```ahadu error=AH3021
ጻፍ(ወደግዕዝ(0))
```

Ge'ez numerals are built from symbols that each carry a value, added
together. Nothing stands for *none*, so zero has no spelling — the numerals
begin at `፩`. That is a fact about the writing system, not a gap in Ahadu,
and the error says so rather than pretending otherwise. Negative numbers and
fractions have no spelling either.

## The Ethiopian calendar

The year has **thirteen** months: twelve of thirty days, then ጳጉሜ, which has
five — or six, every fourth year.

```ahadu
ወር = 1
ወር <= 13 እስከሆነ ድረስ፦
    ጻፍ(ወደግዕዝ(ወር)፣ ወርመጠሪያ(ወር))
    ወር = ወር + 1
```

```ውጤት
፩ መስከረም
፪ ጥቅምት
፫ ኅዳር
፬ ታኅሣሥ
፭ ጥር
፮ የካቲት
፯ መጋቢት
፰ ሚያዝያ
፱ ግንቦት
፲ ሰኔ
፲፩ ሐምሌ
፲፪ ነሐሴ
፲፫ ጳጉሜ
```

`ዛሬ` gives today's date as three numbers — year, month, day:

```ahadu
ቀኑ = ዛሬ()
ጻፍ(ወርመጠሪያ(ቀኑ[1]) + " " + ወደግዕዝ(ቀኑ[2]) + " ቀን " + ወደግዕዝ(ቀኑ[0]))
```

This page deliberately does not promise you an answer for that one. Press Run
— a page that claimed today's date would be wrong tomorrow. (For the same
reason as the seed in the last lesson, `ዛሬ` reads a fixed instant when the
site builds, and the real clock in the playground.)

A date is just a collection of three numbers, so everything you already know
works on it. `ቀኑ[1]` is the month because positions start at 0.

## Converting from the Gregorian calendar

`ከግሪጎሪ` takes a Gregorian year, month and day:

```ahadu
ጻፍ(ከግሪጎሪ(2024፣ 9፣ 11))
```

```ውጤት
[2017፣ 1፣ 1]
```

11 September 2024 was መስከረም 1, 2017 — Ethiopian New Year. The Ethiopian year
runs seven or eight behind the Gregorian one, depending on which side of
መስከረም 1 you are:

```ahadu
ጻፍ(ከግሪጎሪ(2026፣ 1፣ 1))
```

```ውጤት
[2018፣ 4፣ 23]
```

And New Year does not always fall on the same Gregorian day. It is 11
September, except when the February that follows has 29 days, and then it is
the 12th:

```ahadu
ጻፍ(ከግሪጎሪ(2023፣ 9፣ 12))
ጻፍ(ከግሪጎሪ(2024፣ 9፣ 11))
```

```ውጤት
[2016፣ 1፣ 1]
[2017፣ 1፣ 1]
```

A date that does not exist is an error rather than a guess:

```ahadu error=AH3022
ጻፍ(ከግሪጎሪ(2024፣ 2፣ 31))
```

## Exercise

Print today's date as a full sentence in Amharic, with the day and year in
Ge'ez numerals.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ቀኑ = ከግሪጎሪ(2024፣ 9፣ 11)

ጻፍ("ዛሬ " + ወርመጠሪያ(ቀኑ[1]) + " " + ወደግዕዝ(ቀኑ[2]) + " ቀን " + ወደግዕዝ(ቀኑ[0]) + " ዓ.ም. ነው።")
```

```ውጤት
ዛሬ መስከረም ፩ ቀን ፳፻፲፯ ዓ.ም. ነው።
```

The answer uses `ከግሪጎሪ` with a fixed date so the page can check it. Swap in
`ዛሬ()` and run it yourself.

</details>
