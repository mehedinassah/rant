# Topic 3 — Algorithms

> 🏢 **Why it matters:** Sorting/searching complexities and "which algorithm" questions are guaranteed. BJIT, Enosis, TigerIT love **sorting comparisons**, **binary search**, and **recursion output**. You rarely code these in the MCQ — you must know their **time/space costs, stability, and when to use each.**

## Searching

**Linear search** — check each element. **O(n)**. Works on unsorted data.

**Binary search** — repeatedly halve a **sorted** array. **O(log n)**. Requires sorted input.
```
Find 7 in [1,3,5,7,9,11]:  mid=5<7 → right half → mid=9>7 → left → 7 ✓
Each step halves the search space → log₂n steps
```

## Sorting — the master table (MEMORIZE)

| Algorithm | Best | Average | Worst | Space | Stable? |
|-----------|------|---------|-------|-------|---------|
| Bubble | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| Selection | O(n²) | O(n²) | O(n²) | O(1) | ❌ |
| Insertion | O(n) | O(n²) | O(n²) | O(1) | ✅ |
| **Merge** | O(n log n) | O(n log n) | O(n log n) | **O(n)** | ✅ |
| **Quick** | O(n log n) | O(n log n) | **O(n²)** | O(log n) | ❌ |
| Heap | O(n log n) | O(n log n) | O(n log n) | O(1) | ❌ |
| Counting | O(n+k) | O(n+k) | O(n+k) | O(k) | ✅ |

**Key facts interviewers test:**
- **Quicksort worst case = O(n²)** (already-sorted array with bad pivot). Average O(n log n). Usually **fastest in practice**.
- **Merge sort is always O(n log n)** but needs **O(n) extra space**. **Stable.** Good for linked lists / external sorting.
- **Heap sort** = O(n log n), **in-place O(1) space**, but not stable.
- **Insertion sort is best for nearly-sorted / small data** — O(n) best case.
- **Stable sort** preserves relative order of equal elements. Bubble, Insertion, Merge, Counting = stable.
- **Comparison-based sorts can't beat O(n log n).** Counting/Radix/Bucket beat it by *not* comparing (O(n+k)) but need special conditions.

## Recursion

A function calling itself with a **base case** (stops recursion) + **recursive case**.
```
factorial(n): if n==0 return 1;  else return n * factorial(n-1)
factorial(3) = 3*factorial(2)=3*2*factorial(1)=3*2*1*factorial(0)=3*2*1*1=6
```
🧠 **No base case → infinite recursion → stack overflow.** Each call adds a stack frame → recursion uses **O(depth) space**.

**Fibonacci naive recursion = O(2ⁿ)** (exponential, recomputes). With **memoization/DP = O(n)**. Classic MCQ.

## Algorithmic paradigms (know the one-liners)

| Paradigm | Idea | Examples |
|----------|------|----------|
| **Divide & Conquer** | split → solve → combine | Merge sort, Quick sort, Binary search |
| **Greedy** | pick locally best choice | Dijkstra, Prim, Kruskal, Huffman, Activity selection |
| **Dynamic Programming** | overlapping subproblems + optimal substructure; store results | Fibonacci, Knapsack, LCS, edit distance |
| **Backtracking** | try, and undo if it fails | N-Queens, Sudoku, permutations |

🧠 **Greedy vs DP:** Greedy makes one irreversible choice at each step (fast, not always optimal). DP explores all subproblems and stores answers (optimal, more memory).

## Graph algorithms (high-yield names)

- **BFS** (queue) — shortest path in **unweighted** graph. O(V+E).
- **DFS** (stack/recursion) — cycle detection, topological sort, connectivity. O(V+E).
- **Dijkstra** — shortest path, **weighted, non-negative** edges. Greedy.
- **Bellman-Ford** — shortest path, handles **negative** edges. O(VE).
- **Kruskal / Prim** — Minimum Spanning Tree (MST). Greedy.

## Common mistakes & tricks

- ❌ "Quicksort is always O(n log n)" → **worst O(n²)**.
- ❌ "Merge sort is in-place" → needs **O(n)** extra space.
- ❌ "Binary search works on any array" → must be **sorted**.
- ❌ "Fibonacci recursion is O(n)" → naive is **O(2ⁿ)**; DP makes it O(n).
- 🧠 **Stable sorts: B-I-M-C** (Bubble, Insertion, Merge, Counting).
- 🧠 **Divide & Conquer trio: Merge, Quick, Binary search.**
- 🧠 **BFS = shortest path in unweighted; Dijkstra = weighted (non-negative).**

## 📄 Cheat sheet
```
Linear search O(n) unsorted | Binary search O(log n) SORTED
Merge: always O(n log n), O(n) space, STABLE
Quick: avg O(n log n), worst O(n²), in-place-ish, fastest in practice
Heap: O(n log n), O(1) space | Insertion: O(n) best (nearly sorted)
Comparison sorts ≥ O(n log n) | Counting/Radix O(n+k) non-comparison
Recursion needs base case; naive Fibonacci O(2ⁿ), DP O(n)
Greedy(1 choice) vs DP(all subproblems+store) vs Backtracking(try+undo)
BFS=queue/unweighted shortest | DFS=stack | Dijkstra=weighted non-neg
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. Binary search requires the array to be: a) unsorted b) sorted c) reversed d) circular
2. Time complexity of linear search: a) O(1) b) O(log n) c) O(n) d) O(n²)
3. Time complexity of binary search: a) O(1) b) O(log n) c) O(n) d) O(n²)
4. Merge sort worst case: a) O(n) b) O(n log n) c) O(n²) d) O(2ⁿ)
5. Quicksort worst case: a) O(n log n) b) O(n²) c) O(log n) d) O(n)
6. Which sort is stable? a) Selection b) Quick c) Merge d) Heap
7. Recursion must have a: a) loop b) base case c) global variable d) pointer
8. Merge sort extra space: a) O(1) b) O(log n) c) O(n) d) O(n²)
9. Which uses divide and conquer? a) Bubble sort b) Merge sort c) Linear search d) Counting sort
10. BFS uses a: a) stack b) queue c) heap d) tree
11. Naive recursive Fibonacci complexity: a) O(n) b) O(n²) c) O(2ⁿ) d) O(log n)
12. Best case of insertion sort (nearly sorted): a) O(1) b) O(n) c) O(n log n) d) O(n²)
13. Dijkstra's algorithm finds: a) MST b) shortest path (non-negative weights) c) cycles d) sorting
14. Which paradigm stores subproblem results? a) Greedy b) Dynamic Programming c) Backtracking d) Brute force
15. Heap sort space complexity: a) O(1) b) O(n) c) O(log n) d) O(n²)

**Intermediate (16–25)**
16. Comparison-based sorting lower bound: a) O(n) b) O(n log n) c) O(log n) d) O(n²)
17. Which sort is best for a linked list? a) Quick b) Merge c) Heap d) Selection
18. Counting sort time complexity: a) O(n log n) b) O(n+k) c) O(n²) d) O(log n)
19. DFS is typically implemented with: a) queue b) stack/recursion c) heap d) hash
20. Which finds shortest path with negative edges? a) Dijkstra b) Bellman-Ford c) BFS d) Prim
21. Greedy vs DP: greedy makes: a) all choices b) one irreversible local choice c) random choices d) no choices
22. Kruskal's algorithm builds: a) shortest path b) MST c) topological order d) hash table
23. Which is NOT divide and conquer? a) Merge sort b) Quick sort c) Binary search d) Bubble sort
24. Selection sort is stable? a) yes b) no c) sometimes d) only for integers
25. Which sort is generally fastest in practice for arrays? a) Bubble b) Quick c) Selection d) Insertion

**Difficult (26–30)**
26. Master theorem: T(n)=2T(n/2)+O(n) solves to: a) O(n) b) O(n log n) c) O(n²) d) O(log n)
27. Number of comparisons in binary search over n elements (worst): a) n b) ⌈log₂n⌉ c) n/2 d) n²
28. Topological sort applies to: a) any graph b) a DAG (directed acyclic graph) c) undirected graph d) weighted graph only
29. Space complexity of recursion of depth d: a) O(1) b) O(d) c) O(2^d) d) O(log d)
30. 0/1 Knapsack is solved optimally by: a) greedy b) dynamic programming c) binary search d) DFS only

### ✅ Answer Key — Topic 3
1-b · 2-c · 3-b · 4-b · 5-b · 6-c · 7-b · 8-c · 9-b · 10-b · 11-c · 12-b · 13-b · 14-b · 15-a · 16-b · 17-b · 18-b · 19-b · 20-b · 21-b · 22-b · 23-d · 24-b · 25-b · 26-b · 27-b · 28-b · 29-b · 30-b

**Key explanations:** **8** Merge sort needs O(n) auxiliary array. **11** Naive Fibonacci recomputes → O(2ⁿ). **17** Merge sort suits linked lists (no random access needed, stable). **26** Master theorem case → O(n log n). **28** Topological sort only exists for a DAG. **30** Fractional knapsack = greedy, but **0/1 knapsack = DP**.
