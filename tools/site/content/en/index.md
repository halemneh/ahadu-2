---
id: home
title: Ahadu
summary: A programming language written in Amharic
order: 0
---

Ahadu is a programming language written in Amharic words. Its keywords, its
variable names and its error messages are all in Ge'ez script.

```ahadu
ጻፍ("ሰላም ዓለም!")
```

You can change the code above and press **Run**. Every piece of code on this
site runs in the real interpreter.

<div class="hero-actions">
  <a class="button" href="/en/learn/01-hello/">Start learning</a>
  <a class="button button-quiet" href="/playground/">Open the playground</a>
</div>

## Why Ahadu?

Learning to program is hard on its own. Learning in a language you do not
speak is learning two things at once. Ahadu removes the second one.

<ul class="cards">
  <li>
    <h3>In your language</h3>
    <p>Keywords, built-in functions and error messages, all in Amharic.</p>
  </li>
  <li>
    <h3>Nothing to install</h3>
    <p>Edit the code inside any lesson and run it straight away.</p>
  </li>
  <li>
    <h3>Errors that explain themselves</h3>
    <p>Every error carries a code, a line and a column.</p>
  </li>
</ul>

## What does it look like?

The condition comes first and the keyword follows — the way Amharic says it.

```ahadu
ዕድሜ = 20

ዕድሜ > 18 ከሆነ፦
    ጻፍ("ትልቅ ሰው")
አለበለዚያ፦
    ጻፍ("ልጅ")
```

```ውጤት
ትልቅ ሰው
```

`ዕድሜ > 18 ከሆነ፦` reads as "age is greater than 18, if so:". The test is
stated, then what to do about it — which is the order the sentence takes in
Amharic, and the opposite of the order English-based languages use.

Functions are written the same way.

```ahadu
ተግባር ሰላምታ(ስም)፦
    ተመላሽ "ሰላም " + ስም + "!"

ጻፍ(ሰላምታ("ዓለም"))
```

```ውጤት
ሰላም ዓለም!
```
