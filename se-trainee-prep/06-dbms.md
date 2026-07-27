# Topic 6 — Database Management Systems (DBMS)

> 🏢 **Why it matters:** DBMS theory pairs with SQL. Therap, Enosis, BJIT, DataSoft test **normalization, ACID, keys, and indexing**. These are conceptual — high-scoring if you memorize the definitions cleanly.

## Normalization (the #1 DBMS topic)

**Purpose:** organize tables to **reduce redundancy** and **avoid anomalies** (insert, update, delete anomalies).

| Form | Rule (plain English) |
|------|----------------------|
| **1NF** | Atomic values only — no repeating groups/arrays in a cell |
| **2NF** | 1NF + no **partial dependency** (non-key fully depends on the *whole* composite key) |
| **3NF** | 2NF + no **transitive dependency** (non-key depends on another non-key) |
| **BCNF** | Stronger 3NF — every determinant is a candidate key |

🧠 Memory line: **"1NF = atomic, 2NF = no partial, 3NF = no transitive, BCNF = every determinant is a key."**
🧠 The classic mnemonic: *"The key, the whole key, and nothing but the key, so help me Codd."* (2NF=whole key, 3NF=nothing but the key).

**Denormalization** = deliberately adding redundancy back for **read performance** (fewer joins). Trade-off vs data integrity.

## ACID properties (transaction guarantees)

```
A — Atomicity   → all-or-nothing (transaction fully completes or fully rolls back)
C — Consistency → DB moves from one valid state to another (constraints hold)
I — Isolation   → concurrent transactions don't interfere
D — Durability  → committed data survives crashes (persisted)
```
🧠 Bank transfer: debit + credit must **both** happen (Atomicity) or neither.

## Keys (recap + DBMS angle)

- **Super key** ⊇ **Candidate key** ⊇ **Primary key**. A candidate key is a *minimal* super key.
- **Primary key**: chosen candidate key; unique + NOT NULL.
- **Foreign key**: references a PK; enforces **referential integrity**.
- **Composite key**: 2+ columns together form the key.

## Indexing

An **index** speeds up **reads/searches** (like a book's index) but **slows down writes** (INSERT/UPDATE must update the index too) and uses extra space.

- **Clustered index**: determines the **physical order** of rows; **one per table** (usually the PK).
- **Non-clustered index**: separate structure pointing to rows; **many per table**.
- Typically implemented with **B-trees / B+ trees**.

🧠 **Index = faster reads, slower writes.** Great for columns in WHERE/JOIN/ORDER BY.

## Transactions & concurrency (know the terms)

- **Deadlock**: two transactions each wait for a lock the other holds. DB detects and aborts one.
- **Isolation levels** (low→high): Read Uncommitted → Read Committed → Repeatable Read → Serializable. Higher = safer but slower.
- Concurrency problems: **Dirty read** (reading uncommitted data), **Non-repeatable read**, **Phantom read**.

## SQL vs NoSQL (frequently asked)

| SQL (Relational) | NoSQL |
|------------------|-------|
| Tables, fixed schema | Flexible schema (document/key-value/graph/column) |
| ACID, strong consistency | Often BASE, eventual consistency |
| Vertical scaling | Horizontal scaling |
| MySQL, PostgreSQL, Oracle | MongoDB, Redis, Cassandra |
| Complex joins, structured data | Big data, rapid change, unstructured |

## DBMS vs File System (definition question)

DBMS advantages: reduced redundancy, data integrity/consistency, concurrent access control, security, backup/recovery, query language. A plain file system lacks these.

## Common mistakes & tricks

- ❌ "3NF removes partial dependency" → that's **2NF**; 3NF removes **transitive**.
- ❌ "You can have many clustered indexes" → **one** per table.
- ❌ "Indexes speed up everything" → they **slow writes**.
- ❌ "ACID's C = concurrency" → C = **Consistency**; **I** = Isolation is concurrency.
- 🧠 **2NF = whole key (partial), 3NF = nothing but the key (transitive).**

## 📄 Cheat sheet
```
Normalization: 1NF atomic | 2NF no partial dep | 3NF no transitive dep | BCNF determinant=key
ACID: Atomicity(all/nothing) Consistency(valid) Isolation(no interfere) Durability(persist)
Keys: super ⊇ candidate ⊇ primary; FK→PK (referential integrity)
Index: faster reads, slower writes; clustered=1/table(physical order), non-clustered=many
Isolation levels: ReadUncommitted<ReadCommitted<RepeatableRead<Serializable
SQL=schema+ACID+vertical | NoSQL=flexible+BASE+horizontal
Denormalization = add redundancy for read speed
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. Normalization primarily reduces: a) speed b) redundancy c) security d) indexes
2. 1NF requires values to be: a) unique b) atomic c) numeric d) indexed
3. ACID's "A" stands for: a) Availability b) Atomicity c) Access d) Aggregation
4. ACID's "D" stands for: a) Data b) Durability c) Distinct d) Delete
5. A primary key is: a) nullable b) unique + NOT NULL c) always foreign d) duplicated
6. An index mainly speeds up: a) inserts b) reads/searches c) deletes d) backups
7. How many clustered indexes per table? a) 0 b) 1 c) many d) unlimited
8. Foreign key enforces: a) atomicity b) referential integrity c) indexing d) normalization
9. Which stores data in flexible/document form? a) MySQL b) MongoDB c) Oracle d) PostgreSQL
10. Atomicity means a transaction is: a) fast b) all-or-nothing c) isolated d) durable
11. Which is a relational DBMS? a) Redis b) MongoDB c) PostgreSQL d) Cassandra
12. A composite key consists of: a) one column b) two or more columns c) a foreign key only d) an index
13. Denormalization improves: a) integrity b) read performance c) normalization d) security
14. Dirty read means reading: a) old data b) uncommitted data c) deleted data d) indexed data
15. Which removes transitive dependency? a) 1NF b) 2NF c) 3NF d) 0NF

**Intermediate (16–25)**
16. 2NF removes: a) transitive dependency b) partial dependency c) atomic values d) all keys
17. "The whole key" refers to which normal form? a) 1NF b) 2NF c) 3NF d) BCNF
18. Higher isolation level generally means: a) faster + less safe b) slower + safer c) no locks d) no effect
19. A super key is: a) always minimal b) any set of columns uniquely identifying a row c) always a single column d) a foreign key
20. Indexes on a write-heavy table: a) always help b) can hurt write performance c) reduce storage d) enforce keys
21. BCNF requires every determinant to be: a) a foreign key b) a candidate key c) nullable d) numeric
22. Which is NOT an ACID property? a) Atomicity b) Consistency c) Scalability d) Durability
23. NoSQL databases typically scale: a) vertically b) horizontally c) not at all d) only with SQL
24. A candidate key is: a) any super key b) a minimal super key c) always composite d) a foreign key
25. Which anomaly does normalization prevent? a) syntax error b) update/insert/delete anomalies c) deadlock d) index bloat

**Difficult (26–30)**
26. Repeatable Read prevents but Read Committed allows: a) dirty reads b) non-repeatable reads c) durability d) atomicity
27. B+ tree indexes are preferred because: a) O(n) search b) sorted + O(log n) range queries c) hash-based d) no disk use
28. In a table PK(A,B), if C depends only on A, that is a: a) transitive dependency b) partial dependency c) full dependency d) trivial dependency
29. Serializable isolation prevents: a) only dirty reads b) dirty + non-repeatable + phantom reads c) nothing d) durability
30. A clustered index defines the table's: a) logical schema b) physical row order c) foreign keys d) normalization

### ✅ Answer Key — Topic 6
1-b · 2-b · 3-b · 4-b · 5-b · 6-b · 7-b · 8-b · 9-b · 10-b · 11-c · 12-b · 13-b · 14-b · 15-c · 16-b · 17-b · 18-b · 19-b · 20-b · 21-b · 22-c · 23-b · 24-b · 25-b · 26-b · 27-b · 28-b · 29-b · 30-b

**Key explanations:** **15/16** 3NF = transitive, 2NF = partial. **17** "Whole key" = 2NF. **22** Scalability is not an ACID property. **28** C depends on part of the composite key (A) → partial dependency (2NF violation). **29** Serializable is the strictest — prevents all three read anomalies. **30** Clustered index = physical order of rows.
