# Topic 16 — Final Rapid Revision

> **Read this section the night before and the morning of the exam.** It's every high-yield fact compressed. If you can rattle these off, you're ready.

---

## 🔑 The 100 must-know one-liners

**OOP (1–15)**
1. 4 pillars = A PIE (Abstraction, Polymorphism, Inheritance, Encapsulation).
2. Overloading = compile-time, different params. 3. Overriding = runtime, same signature.
4. Java: no multiple class inheritance (Diamond problem) → use interfaces.
5. Abstract class has constructor + state; interface doesn't.
6. Static methods are *hidden*, not overridden. 7. `final` method can't be overridden; `final` class can't be extended.
8. Encapsulation = data hiding (private + getters/setters). 9. Abstraction = detail hiding.
10. Composition = strong owns-a; Aggregation = weak has-a; Association = uses.
11. Access: private < default < protected < public. 12. Constructor: not static/final/inherited; can be overloaded.
13. Runtime polymorphism = dynamic dispatch. 14. Design goal: high cohesion, low coupling.
15. `super` = parent, `this` = current object.

**Data Structures (16–30)**
16. Array: O(1) access, O(n) insert/delete. 17. Linked list: O(n) access, O(1) insert@head.
18. Stack = LIFO (push/pop/peek O(1)). 19. Queue = FIFO (enqueue/dequeue O(1)).
20. Hash: O(1) avg, O(n) worst (collisions → chaining/open addressing).
21. BST balanced O(log n), skewed O(n). 22. Heap: root=min/max, insert O(log n).
23. Inorder BST = sorted. 24. BFS = queue, DFS = stack/recursion.
25. Preorder = Root-L-R; Postorder = L-R-Root; Inorder = L-Root-R.
26. Adjacency matrix O(V²); list O(V+E). 27. Priority queue = heap.
28. Binary search needs SORTED array. 29. Perfect binary tree height h → 2^(h+1)−1 nodes.
30. Balanced tree height = O(log n).

**Algorithms & Complexity (31–48)**
31. Order: 1 < log n < n < n log n < n² < 2ⁿ < n!.
32. Single loop O(n); nested O(n²); `i*=2` → O(log n).
33. Nested loops → multiply; sequential → add. 34. Drop constants: 3n²+5n → O(n²).
35. Merge sort: always O(n log n), O(n) space, stable.
36. Quicksort: avg O(n log n), worst O(n²), fastest in practice.
37. Heap sort: O(n log n), O(1) space. 38. Insertion sort best O(n) (nearly sorted).
39. Comparison sorts ≥ O(n log n); counting/radix O(n+k).
40. Stable sorts: Bubble, Insertion, Merge, Counting.
41. Linear search O(n); binary search O(log n).
42. Naive Fibonacci O(2ⁿ); with DP O(n). 43. Recursion needs a base case; space O(depth).
44. Greedy = one local choice; DP = store subproblems; Backtracking = try+undo.
45. BFS = shortest path (unweighted); Dijkstra = weighted non-negative; Bellman-Ford = negative edges.
46. Kruskal/Prim = MST. 47. T(n)=2T(n/2)+O(n) → O(n log n). 48. 0/1 Knapsack = DP.

**SQL & DBMS (49–65)**
49. Exec order: FROM→WHERE→GROUP BY→HAVING→SELECT→ORDER BY.
50. INNER = match both; LEFT = all left; CROSS = m×n. 51. WHERE filters rows; HAVING filters groups.
52. PK = unique + NOT NULL; UNIQUE allows one NULL. 53. FK → referential integrity.
54. COUNT(*) all rows; COUNT(col) skips NULLs. 55. NULL: use IS NULL (never = NULL); arithmetic with NULL = NULL.
56. DELETE (DML, WHERE, rollback) vs TRUNCATE (DDL, all, fast) vs DROP (table gone).
57. DDL: CREATE/ALTER/DROP/TRUNCATE; DML: SELECT/INSERT/UPDATE/DELETE.
58. UNION (distinct) vs UNION ALL (dupes). 59. 1NF atomic; 2NF no partial; 3NF no transitive; BCNF determinant=key.
60. ACID: Atomicity, Consistency, Isolation, Durability. 61. Index = faster reads, slower writes.
62. Clustered index = physical order, one per table. 63. SQL = ACID/vertical; NoSQL = BASE/horizontal.
64. Self join = table joined to itself (employee-manager). 65. Denormalization = redundancy for read speed.

**OS (66–78)**
66. Process = own memory; thread = shared memory. 67. Deadlock needs all 4 (mutual excl, hold&wait, no preempt, circular wait).
68. Round Robin = preemptive/fair; SJF = best avg wait. 69. Page fault = page not in RAM; thrashing = constant faults.
70. Paging → internal fragmentation; segmentation → external. 71. Mutex = 1 owned; semaphore = N counter.
72. Zombie = child dead unreaped; orphan = parent dead (init adopts). 73. Context switch = pure overhead.
74. Virtual memory = private space + swap. 75. Kernel = privileged; system call = user→kernel.
76. LRU = evict least recently used; Belady's anomaly = FIFO. 77. Banker's algorithm = deadlock avoidance.
78. RR with huge quantum → behaves like FCFS.

**Networks & REST & Git (79–92)**
79. OSI 7 layers: "All People Seem To Need Data Processing". 80. TCP = reliable/handshake; UDP = fast/best-effort.
81. Ports: 21 FTP, 22 SSH, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL.
82. DNS → IP (not the page), port 53. 83. HTTP stateless; HTTPS = HTTP + TLS.
84. 2xx ok, 3xx redirect, 4xx client, 5xx server. 85. 401 unauthenticated; 403 forbidden; 404 not found.
86. Switch = L2 (MAC); Router = L3 (IP). 87. NAT = private IPs share one public IP.
88. REST = stateless, resources, HTTP methods, JSON. 89. GET/PUT/DELETE idempotent; POST not.
90. Git: add→commit(local)→push; pull = fetch+merge. 91. Never rebase shared history; revert is safe undo.
92. Merge conflict: `<<<< mine ==== theirs >>>>`.

**Patterns, System Design, Code, Math (93–100)**
93. Singleton = one instance (private ctor + static getInstance). 94. Factory = create without exposing concrete class; Observer = one-to-many notify.
95. SOLID = Single-resp, Open/closed, Liskov, Interface-seg, Dependency-inversion.
96. Vertical scaling = bigger box; horizontal = more boxes. 97. CAP = pick 2 of 3.
98. Java `5/2 = 2`; `.equals()` for String content; `i++` returns old value.
99. JS: `==` coerces, `===` strict; `typeof null = "object"`. 100. nPr = order matters; nCr = order doesn't; +10% then −10% = −1%.

---

## 🎯 Exam-day strategy (the meta-skills that add 5–10 marks)

**1. Two-pass technique.** First pass: answer everything you're sure of (fast, bank the easy marks). Second pass: return to the hard ones with remaining time. Don't get stuck on Q7 while Q40 (which you know) waits.

**2. Elimination beats guessing.** On tough MCQs, cross out the two obviously-wrong options first. A 50/50 guess is far better than 25%. If there's **no negative marking, never leave a blank** — always guess after eliminating.

**3. Watch for negative marking.** If the exam penalizes wrong answers, only guess when you can eliminate at least one or two options. If unsure and can't eliminate, skip.

**4. Read the question fully — especially "NOT" and "EXCEPT".** Interviewers plant these to catch skimmers. "Which is NOT a pillar of OOP?" trips up people who read fast.

**5. Trust the first instinct** on factual recall; change an answer only if you have a concrete reason.

**6. Time budget.** ~1 minute per question. If a question takes >90 seconds, mark it, move on, come back.

**7. Output-prediction questions:** slow down and dry-run. `i++` vs `++i`, integer division, `==` vs `.equals()` — these are decided by careful reading, not speed.

**8. Manage the clock.** At the halfway time mark, you should be ~halfway through. If behind, speed up on the easy ones.

---

## ✅ Final 48-hour checklist

- [ ] Re-read all 16 cheat-sheet boxes (30 min).
- [ ] Redo both mock tests; target 80%+.
- [ ] Drill the ports, HTTP status codes, and sorting complexity table until automatic.
- [ ] Practice 5 output-prediction snippets out loud.
- [ ] Review the "frequently confused" tables (overloading/overriding, WHERE/HAVING, TCP/UDP, 401/403, merge/rebase).
- [ ] Sleep well the night before — a rested brain recalls faster than a crammed one.

---

## The three tables to memorize cold (if nothing else)

**Sorting:**
```
Merge  O(n log n) always, O(n) space, STABLE
Quick  O(n log n) avg / O(n²) worst, fastest in practice
Heap   O(n log n), O(1) space
Bubble/Selection/Insertion  O(n²) (insertion O(n) best)
```

**HTTP status:**
```
200 OK · 201 Created · 301/302 Redirect · 400 Bad Request
401 Unauthenticated · 403 Forbidden · 404 Not Found · 500 Server Error
4xx = client's fault · 5xx = server's fault
```

**DS operations:**
```
Array: access O(1), insert/delete O(n)
LinkedList: access O(n), insert@head O(1)
Hash: O(1) avg, O(n) worst
BST: O(log n) balanced, O(n) skewed
```

---

> **You've got everything you need.** This handbook covers the ~20% of concepts behind ~80% of the questions on the Aug 1 WellDev exam. Do the mocks, drill the cheat sheets, and walk in confident. **Good luck — go bank those marks! 🚀**
