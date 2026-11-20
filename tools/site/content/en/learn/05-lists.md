---
id: lists
title: Collections
summary: Holding many values under one name
order: 50
---

So far one variable holds one value. But what if you want to keep the names
of everyone in a class? You use a **collection**.

```ahadu
ተማሪዎች = ["አበበ"፣ "ከበደ"፣ "አልማዝ"]

ጻፍ(ተማሪዎች)
ጻፍ("ብዛት፦"፣ ርዝመት(ተማሪዎች))
```

```ውጤት
["አበበ"፣ "ከበደ"፣ "አልማዝ"]
ብዛት፦ 3
```

`ርዝመት` means "length".

Notice that a piece of text printed on its own shows no quotation marks,
but inside a collection it does. That is deliberate: it is how you can tell
the number `3` from the text `"3"` when looking at a collection.

## Getting one item out

Each item has a **position**, and counting starts at **zero**.

```ahadu
ተማሪዎች = ["አበበ"፣ "ከበደ"፣ "አልማዝ"]

ጻፍ(ተማሪዎች[0])
ጻፍ(ተማሪዎች[2])
ጻፍ(ተማሪዎች[-1])
```

```ውጤት
አበበ
አልማዝ
አልማዝ
```

Starting at zero feels odd at first and stops feeling odd quickly. `-1`
counts back from the end.

Asking for a position that is not there is an error:

```ahadu error=AH3008
ተማሪዎች = ["አበበ"፣ "ከበደ"]
ጻፍ(ተማሪዎች[5])
```

## Taking a slice

```ahadu
ቁጥሮች = [10፣ 20፣ 30፣ 40፣ 50]

ጻፍ(ቁጥሮች[1:3])
ጻፍ(ቁጥሮች[:2])
ጻፍ(ቁጥሮች[3:])
```

```ውጤት
[20፣ 30]
[10፣ 20]
[40፣ 50]
```

`[1:3]` means "from position 1 up to but not including 3".

## Changing and growing

A collection **can be changed**.

```ahadu
ቁጥሮች = [1፣ 2፣ 3]

ቁጥሮች[0] = 99
ጻፍ(ቁጥሮች)

አዋህድ(ቁጥሮች፣ 4)
ጻፍ(ቁጥሮች)

ሰርዝ(ቁጥሮች፣ 0)
ጻፍ(ቁጥሮች)
```

```ውጤት
[99፣ 2፣ 3]
[99፣ 2፣ 3፣ 4]
[2፣ 3፣ 4]
```

`አዋህድ` appends and `ሰርዝ` removes by position.

Text, by contrast, cannot be changed in place. `ስም[0] = "ለ"` is an error;
you build a new piece of text instead.

## Walking through one

```ahadu
ዋጋዎች = [12፣ 7፣ 30፣ 5]
ቦታ = 0
ድምር = 0

ቦታ < ርዝመት(ዋጋዎች) እስከሆነ ድረስ፦
    ድምር = ድምር + ዋጋዎች[ቦታ]
    ቦታ = ቦታ + 1

ጻፍ("ድምር፦"፣ ድምር)
ጻፍ("አማካይ፦"፣ ድምር / ርዝመት(ዋጋዎች))
```

```ውጤት
ድምር፦ 54
አማካይ፦ 13.5
```

Counting a position from zero up to the length is a shape you will write
many times.

## Exercise

Find the largest number in a collection.

<details class="answer">
<summary>Show the answer</summary>

```ahadu
ቁጥሮች = [12፣ 45፣ 7፣ 30]
ትልቁ = ቁጥሮች[0]
ቦታ = 1

ቦታ < ርዝመት(ቁጥሮች) እስከሆነ ድረስ፦
    ቁጥሮች[ቦታ] > ትልቁ ከሆነ፦
        ትልቁ = ቁጥሮች[ቦታ]
    ቦታ = ቦታ + 1

ጻፍ("ትልቁ፦"፣ ትልቁ)
```

```ውጤት
ትልቁ፦ 45
```

</details>
