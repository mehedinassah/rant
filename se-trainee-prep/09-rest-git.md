# Topic 9 — REST APIs

> 🏢 **Why it matters:** WellDev, Selise, and web-focused teams test REST basics — HTTP methods, status codes, statelessness. Usually 2–4 MCQs. Easy marks if you know the verbs.

## REST essentials

**REST** = an architecture style for web APIs built around **resources** (URLs) manipulated with **HTTP methods**, exchanging usually **JSON**. Key trait: **stateless** — each request carries all needed info; the server stores no client session between requests.

## HTTP methods (know idempotency & safety)

| Method | Purpose | Idempotent? | Safe (read-only)? |
|--------|---------|-------------|-------------------|
| **GET** | read | ✅ | ✅ |
| **POST** | create | ❌ | ❌ |
| **PUT** | replace/update (full) | ✅ | ❌ |
| **PATCH** | partial update | ⚠️ not always | ❌ |
| **DELETE** | remove | ✅ | ❌ |

🧠 **Idempotent** = doing it multiple times = same result as once (GET, PUT, DELETE). **POST is NOT idempotent** (twice = two resources → double submit). This is the #1 REST trap.

## REST design rules

- Resource URLs use **nouns**, not verbs: `/users/42` ✅, not `/getUser?id=42` ❌.
- Use HTTP methods for actions, status codes for results.
- Stateless, cacheable, client-server separation, uniform interface.

```
GET    /users      → list       POST   /users     → create
GET    /users/42   → read one   PUT    /users/42  → replace
PATCH  /users/42   → partial    DELETE /users/42  → delete
```

**Status codes** (same as Networks §): 200 OK, 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Server Error.

## REST vs SOAP (occasionally asked)
REST = lightweight, JSON, over HTTP, flexible. SOAP = XML, strict contract (WSDL), heavier. REST dominates modern web APIs.

---

# Topic 10 — Git & Version Control

> 🏢 **Why it matters:** Practical dev knowledge. 2–4 MCQs on basic commands, merge vs rebase, and the staging area. Every company assumes Git literacy.

## The 3 areas + core commands

```
Working Dir --add--> Staging Area --commit--> Local Repo --push--> Remote
     <-------------------------------------------------pull-------------
```

| Command | Does |
|---------|------|
| `git clone` | copy a remote repo |
| `git status` | show changes |
| `git add` | stage changes |
| `git commit -m` | save staged changes locally |
| `git push` | upload to remote |
| `git pull` | fetch + merge from remote |
| `git fetch` | download only (no merge) |
| `git branch` / `git checkout -b` | list / create+switch branch |
| `git merge` | combine branches |
| `git stash` | shelve uncommitted changes |

## Key concepts

- **fetch vs pull:** fetch = download only; **pull = fetch + merge**.
- **merge vs rebase:** merge keeps history + a merge commit (branchy); **rebase** rewrites history to be linear. 🧠 **Never rebase shared/pushed history.**
- **reset vs revert:** `revert` = new commit that undoes (safe on shared); `reset` = move pointer back (rewrites history, local only). `reset --hard` discards changes.
- **Merge conflict:** two branches edit the same lines. Markers `<<<<<<< ======= >>>>>>>`; edit to correct version, `git add`, `git commit`.
- **HEAD** = pointer to current commit/branch.

## Common mistakes & tricks

- ❌ "pull = fetch only" → **fetch + merge**.
- ❌ "commit uploads to GitHub" → commit is **local**; `push` uploads.
- ❌ Rebasing a shared branch → breaks teammates.
- 🧠 **Order: add → commit → push. Pull before you start.**

## 📄 Combined cheat sheet (REST + Git)
```
REST: resources+HTTP methods, STATELESS, JSON
GET(read,idempotent) POST(create,NOT idempotent) PUT(replace,idempotent) DELETE(idempotent)
Idempotent = repeat = same result | URLs = nouns not verbs
GIT: add→commit(local)→push | pull=fetch+merge | fetch=download only
merge=history+mergecommit | rebase=linear(rewrites, never on shared)
revert=safe undo | reset=rewrite(local) | stash=shelve | HEAD=current commit
Conflict: <<<< mine ==== theirs >>>> → edit, add, commit
```

---

## MCQs — attempt, then check key

**Beginner (1–15)**
1. REST APIs are typically: a) stateful b) stateless c) offline d) binary-only
2. Which HTTP method reads data? a) POST b) GET c) DELETE d) PUT
3. Which method creates a resource? a) GET b) POST c) PATCH d) HEAD
4. Which is idempotent? a) POST b) GET c) neither d) only PATCH
5. REST usually exchanges data in: a) XML only b) JSON c) CSV d) binary
6. Which command stages changes? a) git commit b) git add c) git push d) git pull
7. `git pull` equals: a) fetch only b) fetch + merge c) push + merge d) clone
8. Which uploads commits to the remote? a) git add b) git commit c) git push d) git status
9. A good REST URL for a user is: a) /getUser?id=1 b) /users/1 c) /user/get/1 d) /fetchUser
10. 201 status code means: a) OK b) Created c) Not Found d) Server Error
11. Which shelves uncommitted changes? a) git stash b) git drop c) git hide d) git save
12. DELETE method is: a) not idempotent b) idempotent c) safe/read-only d) a Git command
13. Which downloads without merging? a) git pull b) git fetch c) git push d) git commit
14. HTTP methods represent: a) resources b) actions on resources c) status codes d) URLs
15. `git commit` saves changes: a) to the remote b) to local repo c) to staging only d) nowhere

**Intermediate (16–25)**
16. POST is not idempotent because sending it twice: a) errors b) creates two resources c) does nothing d) is cached
17. merge vs rebase: rebase produces: a) branchy history b) linear history c) no history d) a merge commit
18. Which should you NOT rebase? a) local branch b) shared/pushed history c) a new branch d) an old commit
19. Which safely undoes a commit on a shared branch? a) reset --hard b) revert c) rebase d) checkout
20. Merge conflict markers include: a) /* */ b) <<<<<<< ======= >>>>>>> c) ### d) -- ++
21. PUT vs POST: PUT is: a) create, not idempotent b) replace, idempotent c) read-only d) partial update
22. 401 vs 403 in a REST API: 401 means: a) forbidden b) unauthenticated c) not found d) created
23. Statelessness means the server: a) stores session per client b) keeps no client state between requests c) never responds d) caches everything
24. `git fetch` then `git merge` equals: a) git push b) git pull c) git clone d) git stash
25. Which is a Git working area? a) staging area b) heap c) stack d) kernel

**Difficult (26–30)**
26. A double-clicked "Submit" that charges twice is caused by which method's nature? a) GET b) POST (non-idempotent) c) PUT d) DELETE
27. `git reset --hard HEAD~1`: a) undoes commit, keeps changes b) undoes commit AND discards changes c) creates a commit d) pushes
28. PATCH differs from PUT by: a) being idempotent always b) doing a partial update c) reading data d) deleting
29. Which REST constraint enables caching and scalability? a) statefulness b) statelessness c) SOAP d) sessions
30. HEAD in Git refers to: a) the first commit b) the current commit/branch pointer c) the remote d) the staging area

### ✅ Answer Key — Topics 9 & 10
1-b · 2-b · 3-b · 4-b · 5-b · 6-b · 7-b · 8-c · 9-b · 10-b · 11-a · 12-b · 13-b · 14-b · 15-b · 16-b · 17-b · 18-b · 19-b · 20-b · 21-b · 22-b · 23-b · 24-b · 25-a · 26-b · 27-b · 28-b · 29-b · 30-b

**Key explanations:** **4/16** GET/PUT/DELETE idempotent; POST not (repeat = duplicate). **19** revert is safe on shared branches; reset rewrites history. **26** Non-idempotent POST → double submit double-charges. **27** `--hard` discards working changes (destructive). **29** Statelessness lets any server handle any request → scalable + cacheable.
