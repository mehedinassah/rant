# Topic 2 — Data Structures

> 🏢 **Why it matters:** Data structures + complexity are the backbone of every trainee exam. Enosis, Therap, BJIT, TigerIT test array/linked-list/stack/queue/tree/hash properties and their operation costs constantly. Most questions are **"which operation is O(?)"** or **"which DS fits this use case."**

## Essential concepts

**Array** — contiguous memory, fixed size, **O(1) index access**, but insert/delete in middle is **O(n)** (shifting).

**Linked List** — nodes with pointers. Insert/delete at known position **O(1)**, but access/search **O(n)** (no indexing). Singly, Doubly, Circular.
```
Array:  [10][20][30][40]      index access = O(1)
LinkedList: 10→20→30→40→null  access = O(n), insert head = O(1)
```

**Stack** — **LIFO** (Last In First Out). Operations: `push`, `pop`, `peek` — all **O(1)**. Uses: function call stack, undo, expression evaluation, backtracking, DFS.

**Queue** — **FIFO** (First In First Out). `enqueue` (rear), `dequeue` (front) — **O(1)**. Uses: scheduling, BFS, buffers. Variants: Circular queue, Deque, Priority queue.
```
Stack (LIFO):  push→ [ 3 ]  ←pop from top
                     [ 2 ]
                     [ 1 ]
Queue (FIFO): enqueue→ [1][2][3] →dequeue (front=1)
```

**Hash Table / HashMap** — key→value via hash function. Average **O(1)** insert/search/delete; **worst O(n)** (collisions). Collisions handled by **chaining** (linked lists) or **open addressing** (probing).

**Tree** — hierarchical; each node has children. **Binary tree**: ≤2 children. **BST (Binary Search Tree)**: left < node < right → search/insert/delete **O(log n)** if balanced, **O(n)** if skewed.

**Balanced trees** (AVL, Red-Black) guarantee **O(log n)**. A **skewed BST degenerates to a linked list (O(n))** — common trap.

**Heap** — complete binary tree. **Min-heap**: parent ≤ children (root = min). **Max-heap**: parent ≥ children (root = max). Insert/delete **O(log n)**, get-min/max **O(1)**. Basis of **priority queue** and **heap sort**.

**Graph** — vertices + edges. Represented by **adjacency matrix** (O(V²) space, O(1) edge check) or **adjacency list** (O(V+E) space, better for sparse graphs).

**Tree traversals:**
```
        A
       / \
      B   C
     / \
    D   E
Inorder  (L,Root,R):  D B E A C
Preorder (Root,L,R):  A B D E C
Postorder(L,R,Root):  D E B C A
Level-order (BFS):    A B C D E
```
🧠 **Inorder of a BST = sorted order.** This is a favorite MCQ.

## Frequently confused concepts

| A | B | Difference |
|---|---|---|
| **Array** | **Linked list** | O(1) access/fixed size vs O(n) access/dynamic size |
| **Stack** | **Queue** | LIFO vs FIFO |
| **BST search** | **Balanced BST** | O(n) worst (skewed) vs guaranteed O(log n) |
| **Min-heap** | **BST** | only parent-child order (root=min) vs full left<node<right ordering |
| **Adjacency matrix** | **Adjacency list** | O(V²) dense vs O(V+E) sparse |
| **DFS** | **BFS** | stack/recursion, goes deep vs queue, goes level-by-level |

## Which DS to use? (common MCQ)

| Need | Use |
|------|-----|
| Fast index access | Array |
| Frequent insert/delete at ends | Linked list / Deque |
| LIFO / undo / DFS / call stack | Stack |
| FIFO / scheduling / BFS | Queue |
| Fast key lookup | Hash table |
| Sorted data + fast search | Balanced BST |
| Always get min/max quickly | Heap / Priority queue |
| Relationships/networks | Graph |

## Operation complexity table (MEMORIZE — this is exam gold)

| Structure | Access | Search | Insert | Delete |
|-----------|--------|--------|--------|--------|
| Array | O(1) | O(n) | O(n) | O(n) |
| Sorted array | O(1) | O(log n) | O(n) | O(n) |
| Linked list | O(n) | O(n) | O(1)* | O(1)* |
| Stack/Queue | O(n) | O(n) | O(1) | O(1) |
| Hash table | — | O(1) avg | O(1) avg | O(1) avg |
| BST (balanced) | O(log n) | O(log n) | O(log n) | O(log n) |
| BST (skewed) | O(n) | O(n) | O(n) | O(n) |
| Heap | — | O(n) | O(log n) | O(log n) |

*at a known position / at the head.

## Common mistakes & tricks

- ❌ "Array access is O(n)" → it's **O(1)** (direct index).
- ❌ "Linked list access is O(1)" → **O(n)** (must traverse).
- ❌ "Hash table is always O(1)" → **average** O(1), **worst** O(n).
- ❌ "BST is always O(log n)" → only if **balanced**; skewed = O(n).
- 🧠 **Stack = LIFO = plates; Queue = FIFO = line at a shop.**
- 🧠 **Inorder BST = sorted.** **BFS = queue, DFS = stack.**
- 🧠 A **complete binary tree** with n nodes has height **⌊log₂n⌋**.

## 📄 Cheat sheet
```
Array: O(1) access, O(n) insert/delete | LinkedList: O(n) access, O(1) insert@head
Stack LIFO (push/pop/peek O(1)) | Queue FIFO (enqueue/dequeue O(1))
Hash: O(1) avg / O(n) worst (collisions → chaining/open addressing)
BST balanced O(log n), skewed O(n) | Heap: root=min/max O(1), insert O(log n)
Traversals: In(LNR)=sorted for BST, Pre(NLR), Post(LRN), Level=BFS
BFS→queue, DFS→stack/recursion | Adjacency: matrix O(V²), list O(V+E)
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. Which gives O(1) access by index? a) Linked list b) Array c) Stack d) Queue
2. Stack follows: a) FIFO b) LIFO c) random d) priority
3. Queue follows: a) LIFO b) FIFO c) random d) sorted
4. Push and pop belong to: a) Queue b) Stack c) Tree d) Graph
5. Enqueue/dequeue belong to: a) Stack b) Queue c) Heap d) Array
6. Linked list access time is: a) O(1) b) O(log n) c) O(n) d) O(n²)
7. In a min-heap, the root is the: a) maximum b) minimum c) median d) last inserted
8. Inorder traversal of a BST gives: a) reverse order b) sorted order c) random d) level order
9. BFS uses which structure? a) Stack b) Queue c) Heap d) Array
10. DFS typically uses: a) Queue b) Stack/recursion c) Heap d) Hash
11. A binary tree node has at most: a) 1 child b) 2 children c) 3 children d) unlimited
12. Hash table average lookup is: a) O(n) b) O(log n) c) O(1) d) O(n²)
13. Which is LIFO? a) Queue b) Stack c) Linked list d) Array
14. A complete graph with n vertices, adjacency matrix space is: a) O(n) b) O(n log n) c) O(n²) d) O(1)
15. Which DS is best for "undo" functionality? a) Queue b) Stack c) Heap d) Graph

**Intermediate (16–25)**
16. Worst-case search in a hash table is: a) O(1) b) O(log n) c) O(n) d) O(n²)
17. A skewed BST search is: a) O(1) b) O(log n) c) O(n) d) O(n²)
18. Preorder of tree (root A, left B, right C; B has children D,E): a) DBEAC b) ABDEC c) DEBCA d) ABCDE
19. Which handles hash collisions? a) recursion b) chaining / open addressing c) balancing d) heapifying
20. Deleting from the middle of a singly linked list (node given, with head traversal) is: a) O(1) b) O(log n) c) O(n) d) O(n²)
21. A priority queue is typically implemented with a: a) stack b) heap c) hash d) array only
22. Which traversal is BFS? a) inorder b) preorder c) postorder d) level-order
23. Adjacency list space complexity: a) O(V) b) O(E) c) O(V+E) d) O(V²)
24. In a max-heap, which is guaranteed? a) root is smallest b) parent ≥ children c) it is sorted d) left < right
25. Binary search requires the array to be: a) unsorted b) sorted c) a linked list d) a heap

**Difficult (26–30)**
26. Height of a balanced binary tree with n nodes: a) O(n) b) O(log n) c) O(1) d) O(n log n)
27. A queue implemented with two stacks has amortized dequeue: a) O(n) b) O(1) c) O(log n) d) O(n²)
28. Which structure gives O(1) insert AND O(1) delete at both ends? a) stack b) singly linked list c) deque (doubly linked) d) array
29. Number of nodes in a perfect binary tree of height h: a) 2^h b) 2^(h+1) − 1 c) h² d) 2h
30. In-place heap sort time complexity: a) O(n) b) O(n log n) c) O(n²) d) O(log n)

### ✅ Answer Key — Topic 2
1-b · 2-b · 3-b · 4-b · 5-b · 6-c · 7-b · 8-b · 9-b · 10-b · 11-b · 12-c · 13-b · 14-c · 15-b · 16-c · 17-c · 18-b · 19-b · 20-c · 21-b · 22-d · 23-c · 24-b · 25-b · 26-b · 27-b · 28-c · 29-b · 30-b

**Key explanations:** **17** Skewed BST behaves like a linked list → O(n). **18** Preorder = Root, Left, Right = A B D E C. **27** Amortized O(1) — each element is moved between stacks at most twice. **29** Perfect binary tree of height h has 2^(h+1) − 1 nodes. **30** Heap sort is always O(n log n).
