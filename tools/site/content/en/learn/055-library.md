---
id: library
title: Tools that come with the language
summary: The standard library, and the helpers for numbers and text
order: 55
---

Some jobs come up in every program. Ahadu brings them already written, under
names you can use straight away — no setting up, nothing to import.

## Working with collections

```ahadu
ዋጋዎች = [12፣ 7፣ 30፣ 5]

ጻፍ("ድምር፦"፣ ደምር(ዋጋዎች))
ጻፍ("ትልቁ፦"፣ ከፍተኛው(ዋጋዎች))
ጻፍ("ትንሹ፦"፣ ዝቅተኛው(ዋጋዎች))
ጻፍ("አማካይ፦"፣ ደምር(ዋጋዎች) / ርዝመት(ዋጋዎች))
```

```ውጤት
ድምር፦ 54
ትልቁ፦ 30
ትንሹ፦ 5
አማካይ፦ 13.5
```

Compare that to lesson five, where adding up a collection took a loop and a
counter. The loop is still there — it is just inside `ደምር` now.

`ፈልግ` says *where* something is, and `ቁጠር` says how many times it appears:

```ahadu
ፊደሎች = ["ሀ"፣ "ለ"፣ "ሐ"፣ "ለ"]

ጻፍ(ፈልግ(ፊደሎች፣ "ሐ"))
ጻፍ(ቁጠር(ፊደሎች፣ "ለ"))
ጻፍ(ፈልግ(ፊደሎች፣ "ዘ"))
```

```ውጤት
2
2
ምንም
```

`ፈልግ` answers `ምንም` when the thing is not there. It does not answer `-1`,
the way some languages do, because in Ahadu `-1` is a real position — the
last one — so using it to mean "missing" would quietly give you the wrong
element instead of telling you anything.

## Sorting changes the collection

```ahadu
ቁጥሮች = [3፣ 9፣ 1፣ 4]
ደርድር(ቁጥሮች)
ጻፍ(ቁጥሮች)

ገልብጥ(ቁጥሮች)
ጻፍ(ቁጥሮች)
```

```ውጤት
[1፣ 3፣ 4፣ 9]
[9፣ 4፣ 3፣ 1]
```

`ደርድር` and `ገልብጥ` are commands — like `ጨምር` and `ሰርዝ`, they change the
collection you give them and hand back `ምንም`. If you want to keep the
original, sort a copy:

```ahadu
ዋናው = [3፣ 9፣ 1]
ተደርድሯል = ቅጂ_አድርግ(ዋናው)
ደርድር(ተደርድሯል)

ጻፍ("ዋናው፦"፣ ዋናው)
ጻፍ("ቅጂው፦"፣ ተደርድሯል)
```

```ውጤት
ዋናው፦ [3፣ 9፣ 1]
ቅጂው፦ [1፣ 3፣ 9]
```

## Whole numbers

Division gives you a fraction, always:

```ahadu
ጻፍ(7 / 2)
```

```ውጤት
3.5
```

When you need a whole number, say which way to go:

```ahadu
ጻፍ(ወለል_ዋጋ(7 / 2))
ጻፍ(ጣሪያ_ዋጋ(7 / 2))
ጻፍ(ቅርብ_ሙሉ_ቁጥር(3.5)፣ ቅርብ_ሙሉ_ቁጥር(3.4))
ጻፍ(ፍጹም_ዋጋ(0 - 7))
```

```ውጤት
3
4
4 3
7
```

`ወለል_ዋጋ` rounds down, `ጣሪያ_ዋጋ` rounds up, `ቅርብ_ሙሉ_ቁጥር` goes to whichever is nearer,
and `ፍጹም_ዋጋ` gives a number's distance from zero — so it throws away the minus
sign.

## Splitting and joining text

`ከፋፍል` breaks a piece of text apart, and `ጽሁፍ_አድርግ` puts a collection back
together:

```ahadu
መስመር = "አበበ ከበደ አስቴር"
ስሞች = ከፋፍል(መስመር)

ጻፍ(ርዝመት(ስሞች))
ጻፍ(ስሞች[0])
ጻፍ(ጽሁፍ_አድርግ(ስሞች፣ "፣ "))
```

```ውጤት
3
አበበ
አበበ፣ ከበደ፣ አስቴር
```

With one argument `ከፋፍል` splits wherever there are spaces, which is what
reading words off a line wants. Give it a second argument to split somewhere
specific:

```ahadu
ጻፍ(ከፋፍል("ሀ,ለ,ሐ"፣ ","))
```

```ውጤት
["ሀ"፣ "ለ"፣ "ሐ"]
```

And `ከርክም` removes the spaces from the ends of a piece of text — useful for
whatever somebody typed:

```ahadu
ጻፍ("[" + ከርክም("   ሰላም   ") + "]")
```

```ውጤት
[ሰላም]
```

## A name for each value: መዝገብ

A collection finds things by position. Sometimes you want to find them by
name — an age for each person, a score for each team. That is a `መዝገብ`.

```ahadu
ዕድሜ = መዝገብ()

ዕድሜ.አስገባ("አበበ"፣ 22)
ዕድሜ.አስገባ("ከበደ"፣ 30)

ጻፍ(ዕድሜ.አግኝ("አበበ"))
ጻፍ(ዕድሜ.አለው("ዘለቀ"))
ጻፍ(ዕድሜ.ብዛት())
```

```ውጤት
22
ሃሰት
2
```

The dot is how you ask a thing to do something: `ዕድሜ.አግኝ("አበበ")` means "ዕድሜ,
get me አበበ". `አስገባ` stores a pair, `አግኝ` fetches one, `አለው` says whether a
name is in there, `አውጣ` takes a pair out, `ብዛት` counts them, and `ቁልፎቹ`
gives you all the names:

```ahadu
ነጥብ = መዝገብ()
ነጥብ.አስገባ("ቀይ"፣ 3)
ነጥብ.አስገባ("ሰማያዊ"፣ 5)

ነጥብ.ቁልፎቹ() ለእያንዳንዱ ቡድን፦
    ጻፍ(ቡድን፣ ነጥብ.አግኝ(ቡድን))
```

```ውጤት
ቀይ 3
ሰማያዊ 5
```

Storing the same name twice replaces the old value rather than adding a
second one:

```ahadu
ዕድሜ = መዝገብ()
ዕድሜ.አስገባ("አበበ"፣ 22)
ዕድሜ.አስገባ("አበበ"፣ 23)

ጻፍ(ዕድሜ.አግኝ("አበበ")፣ ዕድሜ.ብዛት())
```

```ውጤት
23 1
```

## These are written in Ahadu

Here is `ደምር`, exactly as the language defines it:

```ahadu
ተግባር ደምር(ዝርዝር)፦
    ድምሩ = 0
    ዝርዝር ለእያንዳንዱ ዕቃ፦
        ድምሩ = ድምሩ + ዕቃ
    ተመላሽ ድምሩ

ጻፍ(ደምር([1፣ 2፣ 3]))
```

```ውጤት
6
```

That is not a translation of it — it is the code. `ደምር`, `ቁጠር`, `ፈልግ`,
`ከፍተኛው`, `ዝቅተኛው`, `ደርድር`, `ገልብጥ` and `መዝገብ` are all written in Ahadu, in
loops and conditions you have already met. You can read every one of them,
and if you wanted, you could have written them yourself.

A few of the others — `ወለል_ዋጋ`, `ከፋፍል`, `ወደ_ቁጥር` — are part of the language
itself rather than written in it, because they need to do things Ahadu cannot
express.

## Exercise

Ask for a line of numbers separated by spaces, and print how many there are,
their total, and the largest.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
መስመር = አንብብ("ቁጥሮች፦ ")
ቁጥሮች = []

ከፋፍል(መስመር) ለእያንዳንዱ ክፍል፦
    ቁጥር_ነው(ክፍል) ከሆነ፦
        ጨምር(ቁጥሮች፣ ወደ_ቁጥር(ክፍል))

ርዝመት(ቁጥሮች) == 0 ከሆነ፦
    ጻፍ("ምንም ቁጥር አልተገኘም።")
አለበለዚያ፦
    ጻፍ("ብዛት፦"፣ ርዝመት(ቁጥሮች))
    ጻፍ("ድምር፦"፣ ደምር(ቁጥሮች))
    ጻፍ("ትልቁ፦"፣ ከፍተኛው(ቁጥሮች))
```

```ግቤት
12 7 30 5
```

```ውጤት
ቁጥሮች፦ ብዛት፦ 4
ድምር፦ 54
ትልቁ፦ 30
```

</details>
