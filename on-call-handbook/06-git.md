# Chapter 6 — Git

> **Why this chapter matters:** Git is a baseline expectation. Nobody's testing whether you can implement Git internals — they want to know you can work on a team without breaking the shared codebase. The high-yield questions are always the same handful: the everyday workflow, **merge vs rebase**, and **how you resolve a conflict**. Nail those three and Git is handled.

**First, the mental model — the four areas Git moves code between:**

```
  ┌─────────────┐  git add   ┌─────────────┐  git commit  ┌─────────────┐  git push  ┌─────────────┐
  │  WORKING    │ ─────────▶ │   STAGING   │ ───────────▶ │    LOCAL    │ ─────────▶ │   REMOTE    │
  │  DIRECTORY  │            │    AREA     │              │    REPO     │            │  (GitHub)   │
  │ (your edits)│ ◀───────── │  (index)    │              │ (.git hist) │ ◀───────── │             │
  └─────────────┘            └─────────────┘              └─────────────┘  git pull  └─────────────┘
```

> 🧠 **Memory trick:** **Edit → `add` (stage) → `commit` (save locally) → `push` (share).** The staging area in the middle is Git's signature idea: you choose *exactly* what goes into each commit.

---

## 6.1 The everyday commands ★★★★★

| Command | What it does |
|---------|-------------|
| `git clone <url>` | Copy a remote repo to your machine (once, at the start) |
| `git status` | What's changed / staged? (check this constantly) |
| `git add <file>` | Stage a file for the next commit (`git add .` = all) |
| `git commit -m "msg"` | Save staged changes to local history |
| `git push` | Upload local commits to the remote |
| `git pull` | Download + merge remote changes into your branch |
| `git fetch` | Download remote changes **but don't merge** yet |
| `git log --oneline` | View commit history compactly |
| `git diff` | See exact line changes not yet staged |

**A typical day:**
```bash
git pull                          # get latest before you start
# ... edit files ...
git status                        # what did I change?
git add .                         # stage everything
git commit -m "Fix login bug"     # save it locally
git push                          # share it
```

> 💬 **Interviewers usually ask:** "Walk me through your normal Git workflow."
> ✅ **Model answer:** "I pull the latest changes first so I'm working on current code. I make my edits, then `git status` to see what changed and `git diff` to review it. I stage with `git add`, commit with a clear message describing *why*, not just what, and push to the remote. If I'm working on a feature I do it on a branch and open a pull request so it's reviewed before merging into main."

> 🧠 **Memory trick:** **Pull first, push last.** Between them: status → add → commit.

---

## 6.2 fetch vs pull ★★★★☆

A classic "do you actually understand Git" question.

- **`git fetch`** downloads the latest commits from the remote **but does not change your working files.** It just updates your knowledge of what's on the remote. Safe — you can inspect before integrating.
- **`git pull`** = `git fetch` **+ `git merge`**. It downloads *and* immediately merges into your current branch.

> ✅ **Model answer:** "`fetch` downloads remote changes but leaves my working branch untouched — I can review what came in before integrating. `pull` is `fetch` plus `merge`: it downloads and immediately merges into my current branch. So `pull` is the quick everyday command, but `fetch` is safer when I want to look before I leap."

> 🧠 **Memory trick:** **fetch = look, pull = look + apply.** Pull is fetch that doesn't wait.

---

## 6.3 Branching ★★★★☆

**Branches** let you work on a feature in isolation without touching the main codebase, then merge it back when it's ready.

```bash
git branch                        # list branches (* = current)
git branch feature-login          # create a branch
git checkout feature-login        # switch to it
git checkout -b feature-login     # create AND switch (the common shortcut)
git switch feature-login          # modern equivalent of checkout
git merge feature-login           # merge that branch into your current one
git branch -d feature-login       # delete a merged branch
```

> 🌍 **Analogy.** A branch is a parallel draft of a document. You experiment freely on your copy; when it's good, you merge your changes back into the master copy. Everyone else's work on `main` is unaffected while you tinker.

> 🏭 **In real production:** Teams almost never commit directly to `main`. You branch (`feature/…` or `fix/…`), push the branch, open a **pull request**, get it reviewed, and merge. Mentioning this workflow signals you've worked on a team.

> 🧠 **Memory trick:** **`checkout -b` = create + jump.** Branch = safe sandbox off of `main`.

---

## 6.4 Merge vs Rebase ★★★★★

**The most-asked advanced Git question. Understand the difference in shape.**

Both integrate changes from one branch into another. The difference is *history*.

**Merge** — combines the two branches with a **merge commit**, preserving the exact history of both. Non-destructive but the history looks branchy.
```
main:    A───B───C───────M   ← M is a merge commit
                  \     /
feature:           D───E
```

**Rebase** — **replays** your branch's commits on top of the latest main, creating a **straight, linear history** as if you'd started from the newest code. Cleaner, but it *rewrites* commit history.
```
Before:  main: A─B─C     feature: (from B) D─E
After rebase:  A─B─C─D'─E'   ← D,E replayed on top of C, linear
```

**The comparison:**

| | **Merge** | **Rebase** |
|---|---|---|
| History | Preserved, shows branches + a merge commit | Rewritten, linear & clean |
| Safety | Safe — never changes existing commits | Rewrites history (new commit IDs) |
| Best for | Shared/public branches | Cleaning up *your own* local branch before merging |

> ⚠️ **THE golden rule (interviewers love this):** **Never rebase a branch that others are working on / that's already pushed and shared.** Rebasing rewrites commit history, so it breaks everyone else who has the old commits. Rebase only your own local, un-shared work.

> 💬 **Interviewers usually ask:** "Difference between merge and rebase, and when would you use each?"
> ✅ **Model answer:** "Both integrate one branch's changes into another. Merge creates a merge commit and preserves the full branching history — it's safe and non-destructive. Rebase replays your commits on top of the target branch, giving a clean, linear history, but it rewrites commit history in the process. I use rebase to tidy up my own local feature branch before merging, so the history reads cleanly. I use merge for integrating into shared branches. The rule I never break: don't rebase commits that have already been pushed and shared, because rewriting shared history breaks everyone else's copy."

> 🧠 **Memory trick:** **Merge = keep the story (branchy + merge commit). Rebase = rewrite the story (linear).** Rebase = "re-base" your commits onto a new base. Never rewrite shared history.

---

## 6.5 Merge conflicts ★★★★★

**Guaranteed question for any dev-adjacent role.**

**What it is.** A conflict happens when two branches change the **same lines** of the same file differently, so Git can't automatically decide which version wins. It stops and asks *you*.

**What it looks like in the file:**
```
<<<<<<< HEAD
color = "blue"          ← your version (current branch)
=======
color = "green"         ← their version (incoming branch)
>>>>>>> feature-branch
```

**How you resolve it (the steps to recite):**
```bash
# 1. Git tells you which files conflict:
git status
# 2. Open each file, find the <<<< ==== >>>> markers,
#    edit to the correct final version, and DELETE the markers.
# 3. Stage the resolved files:
git add conflicted_file.txt
# 4. Complete the merge:
git commit          # (or: git rebase --continue if mid-rebase)
```

> 💬 **Interviewers usually ask:** "How do you resolve a merge conflict?"
> ✅ **Model answer:** "A conflict happens when two branches edited the same lines and Git can't auto-merge. Git marks the conflicting sections in the file with `<<<<<<<`, `=======`, and `>>>>>>>` markers showing my version and the incoming version. I open each conflicted file, decide what the correct final code should be — sometimes mine, sometimes theirs, sometimes a combination — remove the markers, then `git add` the resolved files and `git commit` to finish the merge. `git status` lists exactly which files still need resolving. The key is that I read both sides and think, rather than blindly picking one."

> ⚠️ **Common mistake:** Leaving the `<<<<<<<` markers in the file (they'll break your code), or blindly choosing one side without understanding both changes.

> 🧠 **Memory trick:** Conflict markers = **`<<<< mine ==== theirs >>>>`**. Edit to the truth, delete the markers, `add`, `commit`.

---

## 6.6 Undoing things: reset, revert, stash ★★★★☆

Interviewers test whether you can fix mistakes safely.

### `git stash` — shelve changes temporarily
You're mid-edit and need to switch branches urgently. Stash saves your uncommitted work and gives you a clean slate.
```bash
git stash             # save & hide uncommitted changes
git stash pop         # bring them back
git stash list        # see stashed changes
```
> 🌍 Like sweeping your messy desk into a drawer to deal with something urgent, then tipping it back out later.

### `git reset` vs `git revert` — the key distinction
- **`git revert <commit>`** creates a **new commit that undoes** a previous one. History is preserved. **Safe for shared/public branches.**
- **`git reset`** moves the branch pointer **back**, effectively erasing commits from the branch. **Rewrites history — dangerous on shared branches.**

```bash
git revert abc123          # safe undo: adds a new "undo" commit
git reset --soft HEAD~1    # undo last commit, KEEP changes staged
git reset --hard HEAD~1    # undo last commit AND discard changes (destructive!)
```

> ⚠️ **Common mistake:** Using `git reset --hard` on shared history. **Rule of thumb: `revert` for anything already pushed/shared; `reset` only for local, un-pushed commits.** And `--hard` throws work away permanently — treat it with respect.

> 💬 **Interviewers usually ask:** "Difference between git reset and git revert?"
> ✅ **Model answer:** "Both undo changes, but differently. `revert` creates a *new* commit that reverses an earlier one, so the history stays intact — that makes it safe on shared branches everyone else has pulled. `reset` moves the branch pointer backward and effectively removes commits, which rewrites history and is risky if those commits were pushed. So on a shared branch I always use `revert`; `reset` I reserve for cleaning up my own local commits before I've pushed. And `reset --hard` also discards the working changes, so I'm careful with it."

> 🧠 **Memory trick:** **re`v`ert = safe, adds a `v`ersion (new commit). re`s`et = `s`crubs history (dangerous on shared).** `stash` = drawer.

---

## Chapter 6 — Key Takeaways

- **Flow:** edit → `add` (stage) → `commit` (local) → `push` (share). **Pull first, push last.** *(★★★★★)*
- **`fetch` = download only; `pull` = fetch + merge.** *(★★★★☆)*
- **Branches** isolate work; teams use feature branches + pull requests, not commits to `main`. `checkout -b` = create + switch.
- **Merge vs rebase:** merge keeps branchy history + a merge commit; rebase makes linear history but rewrites it. **Never rebase shared/pushed history.** *(★★★★★)*
- **Conflicts:** `<<<< mine ==== theirs >>>>` — edit to the correct version, delete markers, `add`, `commit`. *(★★★★★)*
- **Undo:** `stash` shelves work; `revert` safely undoes with a new commit (use on shared branches); `reset` rewrites history (local only); `reset --hard` is destructive. *(★★★★☆)*

> **Next:** Chapter 7 — Cloud Computing. The final knowledge chapter, and increasingly the one that lands the offer for cloud-support and DevOps roles.
