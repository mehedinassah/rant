# Topic 4 — Time & Space Complexity (Big-O)

> 🏢 **Why it matters:** Almost **every** BD trainee paper has 3–6 pure Big-O questions ("what's the complexity of this loop?"). This is the easiest topic to master for guaranteed marks. WellDev, Selise, Enosis all include loop-analysis questions.

## The core idea

**Big-O** describes how runtime/space grows as input size **n** grows — the **worst-case upper bound**, ignoring constants and lower-order terms. `3n² + 5n + 2` → **O(n²)**.

**Notations:** **O** = upper bound (worst), **Ω** = lower bound (best), **Θ** = tight bound (both).

## Growth-rate ranking (memorize the order)

```
O(1) < O(log n) < O(√n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
 fast ────────────────────────────────────────────────────────────► slow
constant  log    sqrt  linear  linearithmic  quadratic  cubic  expo  factorial
```

| Complexity | Name | Example |
|-----------|------|---------|
| O(1) | Constant | array index, hash lookup (avg) |
| O(log n) | Logarithmic | binary search, balanced BST op |
| O(n) | Linear | single loop over n |
| O(n log n) | Linearithmic | merge/quick/heap sort |
| O(n²) | Quadratic | nested loop, bubble sort |
| O(2ⁿ) | Exponential | naive Fibonacci, subsets |
| O(n!) | Factorial | permutations, brute-force TSP |

## How to read loops (the whole skill)

```java
for (i=0; i<n; i++) { ... }                 // O(n)   — one loop

for (i=0; i<n; i++)
   for (j=0; j<n; j++) { ... }              // O(n²)  — nested, both n

for (i=0; i<n; i++)
   for (j=0; j<m; j++) { ... }              // O(n*m)

for (i=1; i<n; i=i*2) { ... }               // O(log n) — i doubles each time

for (i=0; i<n; i++)
   for (j=i; j<n; j++) { ... }              // O(n²)  — n+(n-1)+...+1 = n(n+1)/2

i=n; while(i>1){ i=i/2; }                    // O(log n) — halving
```

**Rules:**
- **Multiply** for nested loops, **add** for sequential loops.
- A loop that **multiplies/divides** the counter (`i*=2`, `i/=2`) → **O(log n)**.
- Drop constants and non-dominant terms: `O(2n)`→`O(n)`, `O(n²+n)`→`O(n²)`.
- Two separate loops = `O(n)+O(n)=O(n)`, not O(n²).

## Amortized vs worst-case

**Amortized** = average cost per operation over a sequence. E.g., dynamic array (`ArrayList`) `add()` is **amortized O(1)** even though an occasional resize is O(n).

## Space complexity

Counts **extra** memory used (not the input). Recursion of depth d = **O(d)** stack space. Merge sort = O(n) space; in-place algorithms = O(1).

## Common mistakes & tricks

- ❌ "Two sequential loops = O(n²)" → **O(n)** (add, don't multiply).
- ❌ "`i *= 2` loop is O(n)" → **O(log n)**.
- ❌ Confusing worst vs average (hash: avg O(1), worst O(n)).
- ❌ Keeping constants: O(5n) is just **O(n)**.
- 🧠 **Halving/doubling → log. Nested independent loops → multiply.**
- 🧠 `for(i..n) for(j=i..n)` = **triangular = O(n²)** (½n² but drop the ½).

## 📄 Cheat sheet
```
Order: 1 < log n < √n < n < n log n < n² < n³ < 2ⁿ < n!
Single loop O(n) | Nested O(n²) | i*=2 or i/=2 → O(log n)
Nested loops → MULTIPLY | Sequential loops → ADD
Drop constants + lower terms: 3n²+5n → O(n²)
Binary search O(log n) | Merge/Quick/Heap O(n log n) | Bubble O(n²)
Recursion space = O(depth) | Dynamic array add = amortized O(1)
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. Big-O of a single loop `for(i=0;i<n;i++)`: a) O(1) b) O(n) c) O(n²) d) O(log n)
2. Big-O of two nested loops each running n times: a) O(n) b) O(n log n) c) O(n²) d) O(2n)
3. `for(i=1;i<n;i*=2)` runs: a) O(n) b) O(log n) c) O(n²) d) O(1)
4. Fastest growth (slowest algorithm) among these: a) O(n) b) O(n²) c) O(2ⁿ) d) O(log n)
5. O(2n + 3) simplifies to: a) O(2n) b) O(n) c) O(3) d) O(2)
6. Array index access complexity: a) O(1) b) O(n) c) O(log n) d) O(n²)
7. Binary search complexity: a) O(n) b) O(log n) c) O(1) d) O(n²)
8. Which is the tight bound notation? a) O b) Ω c) Θ d) λ
9. Bubble sort worst case: a) O(n) b) O(n log n) c) O(n²) d) O(1)
10. O(n² + n) simplifies to: a) O(n) b) O(n²) c) O(n³) d) O(2n²)
11. Which is fastest? a) O(n) b) O(1) c) O(log n) d) O(n²)
12. Two separate (sequential) loops over n: a) O(n²) b) O(n) c) O(log n) d) O(1)
13. Recursion depth d uses space: a) O(1) b) O(d) c) O(2^d) d) O(log d)
14. Merge sort time: a) O(n) b) O(n log n) c) O(n²) d) O(2ⁿ)
15. Hash table average lookup: a) O(1) b) O(n) c) O(log n) d) O(n²)

**Intermediate (16–25)**
16. `for(i=0;i<n;i++) for(j=i;j<n;j++)` is: a) O(n) b) O(n log n) c) O(n²) d) O(log n)
17. `while(n>1) n=n/2;` complexity: a) O(n) b) O(log n) c) O(1) d) O(n²)
18. Amortized complexity of ArrayList.add(): a) O(n) b) O(1) c) O(log n) d) O(n²)
19. O(n) + O(n²) + O(log n) overall: a) O(n) b) O(log n) c) O(n²) d) O(n³)
20. `for(i=0;i<n;i++) for(j=0;j<m;j++)`: a) O(n) b) O(n+m) c) O(n*m) d) O(n²)
21. Two nested loops but inner runs constant 100 times: a) O(n) b) O(100n)=O(n) c) O(n²) d) both a and b
22. Best case of insertion sort: a) O(1) b) O(n) c) O(n log n) d) O(n²)
23. Ω notation represents: a) worst case b) best/lower bound c) average d) tight bound
24. `for(i=1;i<=n;i++) for(j=1;j<=n;j+=i)` — dominant behavior is closest to: a) O(n) b) O(n log n) c) O(n²) d) O(log n)
25. Space complexity of an in-place sort: a) O(1) b) O(n) c) O(log n) d) O(n²)

**Difficult (26–30)**
26. T(n) = T(n/2) + O(1) solves to: a) O(1) b) O(log n) c) O(n) d) O(n log n)
27. T(n) = 2T(n/2) + O(n) solves to: a) O(n) b) O(n log n) c) O(n²) d) O(log n)
28. Nested loop where inner halves each time: `for(i=0;i<n;i++) for(j=n;j>1;j/=2)`: a) O(n) b) O(n log n) c) O(n²) d) O(log n)
29. Generating all subsets of n elements: a) O(n) b) O(n²) c) O(2ⁿ) d) O(n!)
30. Generating all permutations of n elements: a) O(2ⁿ) b) O(n!) c) O(n²) d) O(n log n)

### ✅ Answer Key — Topic 4
1-b · 2-c · 3-b · 4-c · 5-b · 6-a · 7-b · 8-c · 9-c · 10-b · 11-b · 12-b · 13-b · 14-b · 15-a · 16-c · 17-b · 18-b · 19-c · 20-c · 21-d · 22-b · 23-b · 24-b · 25-a · 26-b · 27-b · 28-b · 29-c · 30-b

**Key explanations:** **16** Triangular sum n(n+1)/2 → O(n²). **19** Keep the dominant term → O(n²). **24** Inner does n/i iterations; sum n/1+n/2+…+n/n = n·Hₙ ≈ O(n log n). **26** Halving with O(1) work → O(log n). **27** Master theorem → O(n log n). **28** Outer O(n) × inner O(log n) = O(n log n). **29** 2ⁿ subsets. **30** n! permutations.
