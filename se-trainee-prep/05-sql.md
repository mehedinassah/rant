# Topic 5 — SQL

> 🏢 **Why it matters:** SQL is the **#2 highest-yield topic** after OOP. **Every** target company tests it — Therap, Selise, WellDev, Brain Station 23, DataSoft especially. Expect 6–12 questions: joins, GROUP BY, aggregate functions, keys, and "what does this query output." Master joins and you bank easy marks.

## The clause execution order (critical)

You *write* SQL in one order but the DB *executes* it in another:
```
Written:  SELECT → FROM → WHERE → GROUP BY → HAVING → ORDER BY
Executed: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY
```
🧠 This is why you **can't use a column alias in WHERE** (SELECT runs after WHERE) but **can in ORDER BY**.

## JOINs — the most-tested SQL concept

```
Table A        Table B
  (INNER)  = rows matching in BOTH
  (LEFT)   = ALL of A + matching B (NULLs where no match)
  (RIGHT)  = ALL of B + matching A
  (FULL)   = all of both, NULLs where no match
  (CROSS)  = every combination (Cartesian product, A rows × B rows)
```

```sql
SELECT e.name, d.dept_name
FROM employees e
INNER JOIN departments d ON e.dept_id = d.id;
```

| Join | Returns |
|------|---------|
| **INNER** | only matching rows in both |
| **LEFT (OUTER)** | all left rows + matched right (NULL if none) |
| **RIGHT (OUTER)** | all right rows + matched left |
| **FULL (OUTER)** | all rows from both |
| **CROSS** | Cartesian product (m × n rows) |
| **SELF** | table joined to itself (e.g., employee → manager) |

🧠 **INNER = intersection. LEFT keeps the left. To find "A without match in B": `LEFT JOIN … WHERE b.id IS NULL`.**

## Aggregate functions + GROUP BY

`COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`. Used with **GROUP BY** to summarize per group.

```sql
SELECT dept_id, COUNT(*) AS cnt, AVG(salary) AS avg_sal
FROM employees
GROUP BY dept_id
HAVING COUNT(*) > 5;        -- HAVING filters GROUPS; WHERE filters ROWS
```

🧠 **WHERE filters rows *before* grouping; HAVING filters groups *after*.** You can't use aggregate functions in WHERE — use HAVING.

**`COUNT(*)` counts all rows; `COUNT(col)` ignores NULLs.** Common trap.

## Keys & constraints

| Key | Meaning |
|-----|---------|
| **Primary Key** | uniquely identifies a row; **unique + NOT NULL**; one per table |
| **Foreign Key** | references a PK in another table (enforces referential integrity) |
| **Unique** | no duplicates, but **allows one NULL** |
| **Candidate Key** | any column(s) that could be a PK |
| **Composite Key** | PK made of 2+ columns |
| **Super Key** | any set of columns that uniquely identifies a row |

🧠 **Primary key = unique + NOT NULL. Unique = unique + allows NULL.**

## Key SQL operators & clauses

- `DISTINCT` — remove duplicate rows.
- `IN (a,b,c)` / `BETWEEN x AND y` / `LIKE 'A%'` (% = any chars, _ = one char).
- `NULL` handling: use `IS NULL` / `IS NOT NULL` (never `= NULL`). **Any arithmetic/comparison with NULL → NULL.**
- `UNION` (removes duplicates) vs `UNION ALL` (keeps duplicates, faster).
- Subquery / nested query; correlated subquery (references outer query).
- `ORDER BY col ASC|DESC`, `LIMIT n` (MySQL) / `TOP n` (SQL Server) / `ROWNUM` (Oracle).

## DDL vs DML vs DCL vs TCL (asked directly)

| Category | Commands |
|----------|----------|
| **DDL** (Data Definition) | CREATE, ALTER, DROP, TRUNCATE |
| **DML** (Data Manipulation) | SELECT, INSERT, UPDATE, DELETE |
| **DCL** (Data Control) | GRANT, REVOKE |
| **TCL** (Transaction Control) | COMMIT, ROLLBACK, SAVEPOINT |

🧠 **DELETE vs TRUNCATE vs DROP:** DELETE = remove rows (DML, can WHERE, can rollback, keeps structure). TRUNCATE = remove **all** rows fast (DDL, no WHERE, resets, can't rollback in most DBs). DROP = delete the **whole table** (structure + data). **This is a top-5 SQL MCQ.**

## Common mistakes & tricks

- ❌ `WHERE salary = NULL` → always false; use `IS NULL`.
- ❌ Using aggregate in WHERE → use **HAVING**.
- ❌ Alias in WHERE → not allowed (SELECT runs after WHERE).
- ❌ "COUNT(col) counts NULLs" → it **skips** NULLs; `COUNT(*)` counts all.
- ❌ "TRUNCATE can use WHERE" → **No**, it removes everything.
- 🧠 **INNER=intersection, LEFT=all-left, HAVING=filter groups.**

## 📄 Cheat sheet
```
Exec order: FROM→WHERE→GROUP BY→HAVING→SELECT→ORDER BY
JOINs: INNER=match both | LEFT=all left | RIGHT=all right | FULL=all | CROSS=m×n
WHERE=filter rows (pre-group) | HAVING=filter groups (post-group, aggregates)
PK = unique + NOT NULL | UNIQUE = unique + allows NULL | FK → references PK
COUNT(*)=all rows | COUNT(col)=non-NULL | NULL: use IS NULL
DELETE(DML,WHERE,rollback) | TRUNCATE(DDL,all,fast) | DROP(table gone)
DDL:CREATE/ALTER/DROP/TRUNCATE | DML:SELECT/INSERT/UPDATE/DELETE
UNION(distinct) vs UNION ALL(dupes) | LIKE %=many _=one
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. Which returns only matching rows in both tables? a) LEFT JOIN b) INNER JOIN c) FULL JOIN d) CROSS JOIN
2. WHERE filters: a) groups b) rows c) columns d) tables
3. HAVING filters: a) rows before grouping b) groups after aggregation c) columns d) indexes
4. A primary key is: a) unique + nullable b) unique + NOT NULL c) allows duplicates d) always numeric
5. Which is an aggregate function? a) LIKE b) COUNT c) DISTINCT d) WHERE
6. UNION vs UNION ALL: UNION ALL: a) removes duplicates b) keeps duplicates c) sorts d) joins
7. Which command removes ALL rows but keeps the table, fast, no WHERE? a) DELETE b) DROP c) TRUNCATE d) REMOVE
8. Which is DDL? a) SELECT b) UPDATE c) CREATE d) INSERT
9. To test for NULL you use: a) = NULL b) IS NULL c) == NULL d) NULL() 
10. `LIKE 'A%'` matches strings that: a) contain A b) start with A c) end with A d) equal A
11. CROSS JOIN produces: a) matching rows b) Cartesian product c) left rows d) no rows
12. Which removes duplicate rows in a result? a) DISTINCT b) UNIQUE c) GROUP d) COUNT
13. Foreign key enforces: a) uniqueness b) referential integrity c) sorting d) indexing
14. `COUNT(*)` counts: a) non-null only b) all rows c) distinct only d) columns
15. Which is DML? a) DROP b) GRANT c) UPDATE d) COMMIT

**Intermediate (16–25)**
16. Which JOIN returns all left-table rows even without a match? a) INNER b) LEFT c) RIGHT d) CROSS
17. `COUNT(col)` where col has NULLs: a) counts NULLs too b) ignores NULLs c) errors d) counts columns
18. You cannot use a SELECT column alias in: a) ORDER BY b) WHERE c) both d) neither
19. To find employees with no department: a) INNER JOIN b) LEFT JOIN ... WHERE dept IS NULL c) CROSS JOIN d) RIGHT JOIN only
20. UNIQUE constraint allows: a) no NULLs b) one NULL (typically) c) duplicates d) only integers
21. Which filters aggregated results? a) WHERE b) HAVING c) GROUP BY d) ORDER BY
22. TRUNCATE is classified as: a) DML b) DDL c) DCL d) TCL
23. A correlated subquery: a) runs once b) references the outer query per row c) is faster always d) is illegal
24. `SELECT dept, COUNT(*) FROM emp GROUP BY dept HAVING COUNT(*)>3` returns depts with: a) ≤3 emps b) >3 emps c) all d) exactly 3
25. Result of `5 + NULL` in SQL: a) 5 b) NULL c) 0 d) error

**Difficult (26–30)**
26. Given emp(id,name,mgr_id), to list each employee with their manager's name you use: a) CROSS JOIN b) SELF JOIN c) UNION d) subquery only
27. Which correctly gets the 2nd highest salary? a) `MAX(salary)` b) `SELECT MAX(salary) FROM emp WHERE salary < (SELECT MAX(salary) FROM emp)` c) `LIMIT 2` d) `COUNT(salary)`
28. `WHERE dept='HR' GROUP BY dept` — WHERE executes: a) after GROUP BY b) before GROUP BY c) after SELECT d) never
29. INNER JOIN of A(3 rows) and B(4 rows) with no matches returns: a) 12 rows b) 7 rows c) 0 rows d) 3 rows
30. CROSS JOIN of A(3 rows) and B(4 rows) returns: a) 7 b) 12 c) 0 d) 4

### ✅ Answer Key — Topic 5
1-b · 2-b · 3-b · 4-b · 5-b · 6-b · 7-c · 8-c · 9-b · 10-b · 11-b · 12-a · 13-b · 14-b · 15-c · 16-b · 17-b · 18-b · 19-b · 20-b · 21-b · 22-b · 23-b · 24-b · 25-b · 26-b · 27-b · 28-b · 29-c · 30-b

**Key explanations:** **7** TRUNCATE = fast, all rows, DDL. **17** COUNT(col) ignores NULLs. **18** Alias unusable in WHERE (SELECT runs after WHERE), but fine in ORDER BY. **25** Any arithmetic with NULL → NULL. **26** Manager is in the same table → SELF JOIN. **27** Classic 2nd-highest-salary pattern. **29** No matches → INNER returns 0. **30** CROSS = 3×4 = 12.
