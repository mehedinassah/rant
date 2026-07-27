# Topic 13 — CSE Fundamentals & Code Output

> 🏢 **Why it matters:** BD trainee papers pack in a grab-bag of "core CS" and **output-prediction** questions (C/C++/Java/Python/JS). These decide borderline scores. This section is pure high-frequency facts + the classic tricky snippets.

## Number systems (guaranteed 2–4 questions)

```
Binary(2)  Decimal(10)  Hex(16)
Powers of 2: 1 2 4 8 16 32 64 128 256 512 1024
1010₂ = 8+0+2+0 = 10₁₀     |    255₁₀ = 11111111₂ = FF₁₆
1 byte = 8 bits → values 0..255 (2⁸) | 1 KB = 1024 bytes
```
**Convert 45 to binary:** 45 = 32+8+4+1 = 101101₂.
**Hex digit = 4 bits.** A=10, B=11, C=12, D=13, E=14, F=15.
🧠 **2¹⁰=1024, 2⁸=256, 2⁶=64.** Memorize powers of 2 up to 1024.

## Data & memory

- **Stack** = local variables, function calls, automatic, fast, LIFO (stack overflow). **Heap** = dynamic allocation (`new`/`malloc`), manual/GC, larger (memory leak).
- **Value type vs Reference type:** primitives (int, char) hold the value; objects/arrays hold a **reference** (pointer).
- **Pass by value** (copy) vs **pass by reference** (alias). Java is **always pass-by-value** — but for objects, the *reference* is passed by value (so you can mutate the object, not reassign it).
- **Static typing** (Java, C++ — types checked at compile time) vs **Dynamic typing** (Python, JS — at runtime).
- **Compiled** (C, C++ — to machine code) vs **Interpreted** (Python, JS) vs **Hybrid/bytecode** (Java → JVM, C# → CLR).

## Bitwise & operators

```
&  AND   |  OR   ^  XOR   ~ NOT   <<  left shift(×2)   >> right shift(÷2)
5 & 3 = 1   |   5 | 3 = 7   |   5 ^ 3 = 6   |   1<<3 = 8   |   x^x = 0
```
🧠 **Left shift by n = multiply by 2ⁿ. XOR of a number with itself = 0.** `n & (n-1)` clears the lowest set bit (used to check power of 2: `n & (n-1) == 0`).

## Classic OUTPUT-prediction traps (study every one)

**Integer division (C/C++/Java):**
```java
System.out.println(5/2);      // → 2   (integer division, not 2.5)
System.out.println(5.0/2);    // → 2.5 (one operand double)
System.out.println(5%2);      // → 1   (modulo)
System.out.println(7/2*2);    // → 6   (7/2=3, ×2=6, left-to-right)
```

**Post vs pre increment:**
```java
int i=5; System.out.println(i++);  // → 5 (use then increment), i is now 6
int j=5; System.out.println(++j);  // → 6 (increment then use)
int a=5; int b=a++ + ++a;          // b = 5 + 7 = 12, a=7
```

**Java String immutability / == vs equals:**
```java
String a="hi", b="hi"; a==b        // → true  (string pool, same reference)
String c=new String("hi"); a==c    // → false (different object)
a.equals(c)                        // → true  (value comparison)
```
🧠 **Use `.equals()` for String content; `==` compares references (objects).**

**Java array default values:** `int[] x = new int[3];` → `{0,0,0}`. Object arrays → `null`.

**Python quirks:**
```python
print(5//2)     # → 2  (floor division)   print(5/2) # → 2.5 (true division)
print(2**3)     # → 8  (power)            print("ab"*3) # → ababab
print(bool(0), bool(""), bool([]))        # → False False False (falsy)
a=[1,2,3]; b=a; b.append(4); print(a)     # → [1,2,3,4] (same reference!)
```

**JavaScript quirks (WellDev/Selise favorite):**
```js
0 == "0"        // → true  (loose equality, type coercion)
0 === "0"       // → false (strict, no coercion)
typeof null     // → "object"  (famous bug)
typeof NaN      // → "number"
[] + []         // → "" (empty string)   ;  1 + "2" // → "12"   ; "5" - 2 // → 3
```
🧠 **JS: `==` coerces types, `===` doesn't. Always prefer `===`.**

**C pointer/array basics:**
```c
int arr[]={10,20,30}; printf("%d", *(arr+1));  // → 20  (arr+1 = &arr[1])
char c='A'; printf("%d", c);                    // → 65 (ASCII)
```
🧠 **ASCII: 'A'=65, 'a'=97, '0'=48.** `'a' - 'A' = 32`.

## Common mistakes & tricks

- ❌ `5/2 == 2.5` in Java/C → it's **2** (integer division).
- ❌ Using `==` for Java String content → use **`.equals()`**.
- ❌ `i++` returns the incremented value → returns the **old** value.
- ❌ In JS, `==` and `===` are the same → `==` **coerces**.
- 🧠 **typeof null = "object", typeof NaN = "number".**

## 📄 Cheat sheet
```
Powers of 2: 256=2⁸, 1024=2¹⁰ | 1 byte=8 bits=0..255 | hex digit=4 bits
Integer div: 5/2=2 (Java/C), 5.0/2=2.5 | Python 5//2=2, 5/2=2.5
i++ returns old, ++i returns new | ASCII A=65 a=97 0=48
Java String: == is reference, .equals() is value | new String → different object
JS: == coerces, === strict | typeof null="object", typeof NaN="number"
Bitwise: <<n = ×2ⁿ | x^x=0 | n&(n-1)==0 → power of 2
Static typing(Java/C++) vs Dynamic(Python/JS) | Compiled(C) vs Interpreted vs Bytecode(Java)
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. In Java, `5/2` outputs: a) 2.5 b) 2 c) 3 d) error
2. Binary 1010 in decimal: a) 8 b) 10 c) 12 d) 20
3. 1 byte = how many bits? a) 4 b) 8 c) 16 d) 32
4. `i++` returns: a) incremented value b) original value c) 0 d) error
5. ASCII value of 'A': a) 60 b) 65 c) 97 d) 48
6. In Java, compare String content with: a) == b) .equals() c) = d) compareTo only
7. `2**3` in Python: a) 6 b) 8 c) 9 d) 5
8. `typeof null` in JS: a) "null" b) "object" c) "undefined" d) "number"
9. 2¹⁰ equals: a) 512 b) 1000 c) 1024 d) 2048
10. `5 % 2` equals: a) 2 b) 2.5 c) 1 d) 0
11. Left shift `1 << 3`: a) 3 b) 6 c) 8 d) 4
12. Python `5//2`: a) 2.5 b) 2 c) 3 d) 2.0
13. Which is dynamically typed? a) Java b) C++ c) Python d) C
14. `0 === "0"` in JS: a) true b) false c) error d) undefined
15. Hex FF in decimal: a) 15 b) 200 c) 255 d) 256

**Intermediate (16–25)**
16. `int a=5; int b=a++ + ++a;` → b, a: a) 12, 7 b) 11, 7 c) 12, 6 d) 10, 6
17. `String a="hi", b="hi"; a==b`: a) true b) false c) error d) null
18. `String c=new String("hi"); "hi"==c`: a) true b) false c) error d) depends
19. `0 == "0"` in JS: a) true b) false c) error d) NaN
20. `7/2*2` in Java: a) 7 b) 6 c) 7.0 d) 8
21. `typeof NaN` in JS: a) "NaN" b) "number" c) "undefined" d) "object"
22. In C, `*(arr+1)` for `arr={10,20,30}`: a) 10 b) 20 c) 30 d) address
23. `x ^ x` equals: a) x b) 0 c) 1 d) 2x
24. Java is: a) pass by reference b) pass by value (references passed by value) c) pass by name d) pass by pointer
25. `bool([])` in Python: a) True b) False c) error d) None

**Difficult (26–30)**
26. `n & (n-1) == 0` (n>0) checks if n is: a) even b) a power of 2 c) prime d) negative
27. `1 + "2"` in JS: a) 3 b) "12" c) "3" d) error
28. `"5" - 2` in JS: a) "52" b) 3 c) "3" d) NaN
29. In Python, `a=[1,2]; b=a; b.append(3); a` is: a) [1,2] b) [1,2,3] c) error d) [3]
30. `5.0/2` in Java: a) 2 b) 2.5 c) 2.0 d) error

### ✅ Answer Key — Topic 13
1-b · 2-b · 3-b · 4-b · 5-b · 6-b · 7-b · 8-b · 9-c · 10-c · 11-c · 12-b · 13-c · 14-b · 15-c · 16-a · 17-a · 18-b · 19-a · 20-b · 21-b · 22-b · 23-b · 24-b · 25-b · 26-b · 27-b · 28-b · 29-b · 30-b

**Key explanations:** **16** a++ uses 5 (a→6), ++a makes a=7 and uses 7 → 5+7=12, a=7. **17** String literals share the pool → same reference → true. **18** `new String` creates a distinct object → == false. **27** number + string → string concatenation "12". **28** `-` forces numeric coercion → 3. **29** b and a reference the same list → mutation shows in a. **26** clearing the lowest set bit gives 0 only for powers of 2.
