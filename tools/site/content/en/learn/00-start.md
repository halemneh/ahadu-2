---
id: start
title: Before your first program
summary: What a program is, and how to use these lessons
order: 5
---

If you have never written a program before, start here. Nothing on this page
assumes that you have.

## A program is a list of instructions

A computer does not work out what you meant. It does what you tell it, in the
order you tell it, and nothing else.

That is the whole idea. A program is a list of instructions, written down, and
the computer works through them one at a time from the top.

Here is a program with two instructions:

```ahadu
ጻፍ("አንድ")
ጻፍ("ሁለት")
```

```ውጤት
አንድ
ሁለት
```

`ጻፍ` means "write". Each line writes one thing.

## The order is the program

Swap the two lines and you have a different program:

```ahadu
ጻፍ("ሁለት")
ጻፍ("አንድ")
```

```ውጤት
ሁለት
አንድ
```

Nothing clever happened: the computer did the first line, then the second.
Much of programming is deciding what should happen and in what order.

## Try it

Every piece of code in these lessons can be run and changed.

Press **▸ Run** on the program above. Then change one of the words inside the
quotation marks and run it again.

You cannot break anything. The program runs inside your own browser and is
sent nowhere, nothing is saved, and reloading the page brings the original
back.

## The computer is exact

Write something the language does not know and it will not guess:

```ahadu error=AH3001
ጻፍ(ሰላም)
```

Here `ሰላም` has no quotation marks around it, so Ahadu took it for the name of
something, went looking, and found nothing. It says so, and it says where.

An error is not a failure. It is the language telling you what it could not
do, which is far better than it carrying on and doing the wrong thing
quietly. You will see many of them, and the last lesson is about reading
them.

## Exercise

Write a program that writes three lines: your name, your city, and a colour
you like.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ጻፍ("አበበ")
ጻፍ("አዲስ አበባ")
ጻፍ("ሰማያዊ")
```

```ውጤት
አበበ
አዲስ አበባ
ሰማያዊ
```

</details>
