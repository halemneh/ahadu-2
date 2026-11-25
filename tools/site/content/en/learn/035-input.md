---
id: input
title: Asking a question
summary: አንብብ, and turning text into numbers
order: 35
---

Every program so far has known its own numbers. `አንብብ` asks the person
running it.

```ahadu
ጻፍ("ስምህ ማን ነው?")
ስም = አንብብ("ስም፦ ")
ጻፍ("እንደምን አለህ " + ስም + "!")
```

```ግቤት
አበበ
```

```ውጤት
ስምህ ማን ነው?
ስም፦ እንደምን አለህ አበበ!
```

`አንብብ` reads one line. The text you give it is printed first, as a prompt —
that is why `ስም፦` and the answer end up on the same line.

## Everything typed is text

Here is the thing that catches everyone. Try adding 1 to a number someone
typed:

```ahadu error=AH3002
ዕድሜ = አንብብ("ዕድሜ፦ ")
ጻፍ(ዕድሜ + 1)
```

```ግቤት
22
```

`አንብብ` always gives back **`ጽሁፍ`**, even when the person typed digits. And
`ጽሁፍ` and `ቁጥር` cannot be added — that was lesson two's rule, and it is
protecting you here. `"22" + 1` has no sensible answer: should it be `23`, or
`"221"`?

## ወደ_ቁጥር

So you say which one you meant.

```ahadu
ዕድሜ = ወደ_ቁጥር(አንብብ("ዕድሜ፦ "))
ጻፍ("በሚቀጥለው ዓመት"፣ ዕድሜ + 1)
```

```ግቤት
22
```

```ውጤት
ዕድሜ፦ በሚቀጥለው ዓመት 23
```

`ወደ_ቁጥር` takes text and gives you the number it spells. It accepts spaces
around it, so `" 22 "` is fine — someone typing at a prompt should not have
to be careful. It also reads Amharic's own numerals, so `፳፪` works too.

And `ወደ_ጽሁፍ` goes the other way, for when you want a number inside a longer
piece of text:

```ahadu
ነጥብ = 17
ጻፍ("ነጥብህ " + ወደ_ጽሁፍ(ነጥብ) + " ነው።")
```

```ውጤት
ነጥብህ 17 ነው።
```

> You do not always need it. `ጻፍ("ነጥብህ"፣ ነጥብ፣ "ነው።")` prints the same thing,
> because `ጻፍ` takes many values and puts a space between them. `ወደ_ጽሁፍ` is
> for when you are *building* one piece of text.

## When they do not type a number

`ወደ_ቁጥር("ሰላም")` is an error, and that is on purpose — a calculator that
quietly carried on with nothing would print an answer and you would believe
it. But an error stops the program, which is not what you want either.

Ask first. `ቁጥር_ነው` tells you whether `ወደ_ቁጥር` would work:

```ahadu
መልስ = አንብብ("ቁጥር ጻፍ፦ ")

ቁጥር_ነው(መልስ) ከሆነ፦
    ጻፍ("እጥፉ"፣ ወደ_ቁጥር(መልስ) * 2)
አለበለዚያ፦
    ጻፍ("ያ ቁጥር አይደለም።")
```

```ግቤት
ሰላም
```

```ውጤት
ቁጥር ጻፍ፦ ያ ቁጥር አይደለም።
```

`ቁጥር_ነው` never fails, whatever you hand it. That is its whole job: a guard
that could itself stop the program would be no guard at all.

## Exercise

Ask for two numbers and print their sum. If either one is not a number, say
so instead.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
አንደኛው = አንብብ("አንደኛው፦ ")
ሁለተኛው = አንብብ("ሁለተኛው፦ ")

ቁጥር_ነው(አንደኛው) እና ቁጥር_ነው(ሁለተኛው) ከሆነ፦
    ድምሩ = ወደ_ቁጥር(አንደኛው) + ወደ_ቁጥር(ሁለተኛው)
    ጻፍ("ድምር፦"፣ ድምሩ)
አለበለዚያ፦
    ጻፍ("ሁለቱም ቁጥር መሆን አለባቸው።")
```

```ግቤት
12
30
```

```ውጤት
አንደኛው፦ ሁለተኛው፦ ድምር፦ 42
```

</details>
