---
id: chance
title: Chance
summary: ዘፈቀደ_ቁጥር, ዘር, and why this page can show you the answer
order: 65
---

`ዘፈቀደ_ቁጥር` picks a number between two you give it.

```ahadu
ጻፍ(ዘፈቀደ_ቁጥር(1፣ 6))
```

```ውጤት
4
```

Both ends are included, so `ዘፈቀደ_ቁጥር(1፣ 6)` really is a die — all six faces, not
five. Roll it a few times:

```ahadu
ዙር = 1
ዙር <= 5 እስከሆነ ድረስ፦
    ጻፍ(ዘፈቀደ_ቁጥር(1፣ 6))
    ዙር = ዙር + 1
```

```ውጤት
4
1
4
6
6
```

## Why the page knows what it rolled

That should bother you. If it is random, how can this page say the answer in
advance?

Because `ዘፈቀደ_ቁጥር` is not quite random. It follows a sequence worked out from a
starting number called a **seed**, and whoever runs your program chooses the
seed. The playground and `ahadu` at a terminal use the clock, so you get
different rolls every time. **This page uses a fixed seed** — which is exactly
why it can promise you a `4`.

That is not a trick for the lessons. Every Ahadu snippet on this site is
actually run when the site is built, and the page fails to build if the
output is not what it claims. A clock-based seed would have put a hole in that
check right where beginners most need it.

Press Run on the snippet above and you will get different numbers. The page
and the playground disagree on purpose.

## Choosing the seed yourself: ዘር

`ዘር` sets the seed from inside your program, which makes the sequence repeat:

```ahadu
ዘር(7)
ጻፍ(ዘፈቀደ_ቁጥር(1፣ 100)፣ ዘፈቀደ_ቁጥር(1፣ 100))

ዘር(7)
ጻፍ(ዘፈቀደ_ቁጥር(1፣ 100)፣ ዘፈቀደ_ቁጥር(1፣ 100))
```

```ውጤት
2 7
2 7
```

The same seed, the same numbers. This is more useful than it looks: a game
that misbehaves is much easier to fix when you can make it misbehave the same
way twice.

`ዘር` is a command, like `ጨምር` — it changes something and gives back `ምንም`.
So `ሀ = ዘር(7)` leaves `ሀ` holding `ምንም`, not a number.

## Counting what comes up

```ahadu
ጎኖች = [0፣ 0፣ 0፣ 0፣ 0፣ 0]
ዙር = 1

ዙር <= 60 እስከሆነ ድረስ፦
    ጎን = ዘፈቀደ_ቁጥር(1፣ 6)
    ጎኖች[ጎን - 1] = ጎኖች[ጎን - 1] + 1
    ዙር = ዙር + 1

ጻፍ(ጎኖች)
ጻፍ(ደምር(ጎኖች))
```

```ውጤት
[9፣ 13፣ 10፣ 8፣ 11፣ 9]
60
```

Sixty rolls over six faces averages ten each, and none of them is far off. The
`ጎን - 1` is because a die starts at 1 but a collection starts at position 0.

## Exercise

Write a guessing game: pick a number from 1 to 20, give the player five
tries, and tell them after each guess whether the number is higher or lower.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ሚስጥር = ዘፈቀደ_ቁጥር(1፣ 20)
ቀሪ = 5
አገኘ = ሃሰት

ጻፍ("ከ1 እስከ 20 መረጥኩ። አምስት ሙከራ አለህ።")

ቀሪ > 0 እና ተቃርኖ አገኘ እስከሆነ ድረስ፦
    መልስ = አንብብ("ግምትህ፦ ")
    ቀሪ = ቀሪ - 1

    ተቃርኖ ቁጥር_ነው(መልስ) ከሆነ፦
        ጻፍ("ቁጥር ጻፍ።")
    አለበለዚያ፦
        ግምት = ወደ_ቁጥር(መልስ)
        ግምት == ሚስጥር ከሆነ፦
            አገኘ = እውነት
        ግን ግምት < ሚስጥር ከሆነ፦
            ጻፍ("ከዚህ ይበልጣል። ቀሪ፦"፣ ቀሪ)
        አለበለዚያ፦
            ጻፍ("ከዚህ ያንሳል። ቀሪ፦"፣ ቀሪ)

አገኘ ከሆነ፦
    ጻፍ("አገኘኸው!")
አለበለዚያ፦
    ጻፍ("ቁጥሩ"፣ ሚስጥር፣ "ነበር።")
```

```ግቤት
10
15
13
```

```ውጤት
ከ1 እስከ 20 መረጥኩ። አምስት ሙከራ አለህ።
ግምትህ፦ ከዚህ ይበልጣል። ቀሪ፦ 4
ግምትህ፦ ከዚህ ያንሳል። ቀሪ፦ 3
ግምትህ፦ አገኘኸው!
```

</details>
