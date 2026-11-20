---
id: hello
title: Your first program
summary: ጻፍ, text, and comments
order: 10
---

The first program anyone writes in a new language shows something on the
screen. In Ahadu that is a function called `ጻፍ` — "write".

```ahadu
ጻፍ("ሰላም ዓለም!")
```

```ውጤት
ሰላም ዓለም!
```

Press **Run**. Then change the code and run it again.

## Text

Anything between quotation marks `"` is **text**. Text can hold any
characters at all.

```ahadu
ጻፍ("አዲስ አበባ")
ጻፍ("Addis Ababa")
ጻፍ("፩፪፫")
```

```ውጤት
አዲስ አበባ
Addis Ababa
፩፪፫
```

Each `ጻፍ` writes on a new line.

## Writing more than one thing

`ጻፍ` takes more than one value. They are separated by `፣`, the Ethiopic
comma.

```ahadu
ጻፍ("ስም፦"፣ "አበበ")
```

```ውጤት
ስም፦ አበበ
```

A space is put between them for you.

## Comments

A line starting with `#` is a **comment**. The computer skips it; it is there
for people.

```ahadu
# this line does not run
ጻፍ("ይህ ግን ይሄዳል")
```

```ውጤት
ይህ ግን ይሄዳል
```

Comments are for saying why the code is the way it is.

## Exercise

Write a program that prints your name and your city on two lines.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ጻፍ("ስም፦"፣ "ኃይለሚካኤል")
ጻፍ("ከተማ፦"፣ "አዲስ አበባ")
```

```ውጤት
ስም፦ ኃይለሚካኤል
ከተማ፦ አዲስ አበባ
```

</details>
