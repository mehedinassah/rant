# Chapter 8 — Final Revision & Cheat Sheets

> **How to use this chapter:** This is your **night-before and morning-of** reference. Don't read it like prose — scan it, quiz yourself, and drill the tables. If you can reproduce these cheat sheets from memory, you're ready. Everything here is distilled from Chapters 1–7.

---

## 8.1 The "confusion killers" — things candidates mix up ★★★★★

**Interviewers love these because getting them backwards instantly reveals shaky understanding. Master every row.**

| Pair | The difference in one line |
|------|----------------------------|
| **Process vs Thread** | Process = private memory; thread = shared memory (inside a process) |
| **Stack vs Heap** | Stack = auto, fast, small, LIFO (overflow); heap = manual/GC, large (leaks) |
| **Zombie vs Orphan** | Zombie = child dead, not reaped; orphan = parent dead, child adopted by PID 1 |
| **Deadlock vs Starvation** | Deadlock = everyone stuck in a cycle forever; starvation = one keeps getting skipped |
| **Mutex vs Semaphore** | Mutex = 1 at a time, owned; semaphore = up to N, not owned |
| **Paging vs Segmentation** | Paging = fixed-size blocks; segmentation = variable, by logical meaning |
| **TCP vs UDP** | TCP = reliable/ordered/slow; UDP = fast/best-effort/no guarantees |
| **401 vs 403** | 401 = not authenticated (who are you?); 403 = authenticated, not allowed |
| **4xx vs 5xx** | 4xx = client's fault; 5xx = server's fault |
| **Cookie vs Session** | Cookie = client-side; session = server-side (cookie carries the ID) |
| **Session vs JWT** | Session = server-stored state; JWT = stateless signed token |
| **GET vs POST** | GET = read, idempotent; POST = create, not idempotent |
| **PUT vs POST** | PUT = update/replace (idempotent); POST = create (not idempotent) |
| **Forward vs Reverse Proxy** | Forward = for clients; reverse = for servers (reveRse = seRveR) |
| **df vs du** | df = free space (whole disk); du = usage (specific files/dirs) |
| **kill vs kill -9** | kill = SIGTERM (graceful); kill -9 = SIGKILL (forced, last resort) |
| **find vs grep** | find = locate files; grep = find text inside files |
| **fetch vs pull** | fetch = download only; pull = fetch + merge |
| **merge vs rebase** | merge = keeps history + merge commit; rebase = linear, rewrites history |
| **reset vs revert** | reset = rewrites history (local); revert = new undo commit (safe/shared) |
| **VM vs Container** | VM = full OS, heavy, minutes; container = shares kernel, light, seconds |
| **IaaS vs PaaS vs SaaS** | Increasing provider management: you cook / you bake / you eat |
| **Docker vs Kubernetes** | Docker = build/run a container; K8s = orchestrate many containers |
| **Symmetric vs Asymmetric (TLS)** | Asymmetric = agree the key (once); symmetric = encrypt the data (fast) |

---

## 8.2 Ports cheat sheet ★★★★☆

| Port | Service | | Port | Service |
|------|---------|---|------|---------|
| **22** | SSH | | **443** | HTTPS |
| **25** | SMTP (email out) | | **3306** | MySQL |
| **53** | DNS | | **5432** | PostgreSQL |
| **80** | HTTP | | **6379** | Redis |
| **110/143** | POP3 / IMAP (email in) | | **27017** | MongoDB |

> **Drill:** 22 SSH · 53 DNS · 80 HTTP · 443 HTTPS · 3306 MySQL · 5432 Postgres. Say them until automatic.

---

## 8.3 HTTP status codes cheat sheet ★★★★★

```
1xx Informational   "hold on"
2xx Success         "here you go"     200 OK · 201 Created · 204 No Content
3xx Redirect        "look elsewhere"  301 Moved Perm · 302 Found · 304 Not Modified
4xx CLIENT error    "YOU messed up"   400 Bad Req · 401 Unauth · 403 Forbidden
                                      404 Not Found · 429 Too Many Requests
5xx SERVER error    "I messed up"     500 Internal · 502 Bad Gateway
                                      503 Unavailable · 504 Gateway Timeout
```

**The five you'll be asked to distinguish:** 200, 301 vs 302, 401 vs 403, 404, 500 vs 502 vs 503 vs 504.

---

## 8.4 Linux commands cheat sheet ★★★★★

```
NAVIGATION        pwd  ls -la  cd  cd ..  cd ~
FILES             mkdir  touch  cp -r  mv (move/rename)  rm -r
VIEW              cat  less  head -n  tail -n  tail -f (live!)
SEARCH            find /path -name "*.log"      grep -i "err" file
                  find . -size +100M            grep -rn "text" .
PERMISSIONS       chmod 755 file   chmod +x   chown user:group file
                  (4=read 2=write 1=execute; 755=rwxr-xr-x; 644=rw-r--r--)
PROCESSES         ps aux   ps aux | grep x   top   kill PID   kill -9 PID
DISK / MEM        df -h (which disk full)   du -sh *   free -h
SERVICES          systemctl status|start|stop|restart|enable  SERVICE
LOGS              journalctl -u SERVICE -f     tail -f /var/log/...
PIPES/REDIRECT    cmd1 | cmd2     > overwrite   >> append   2> errors
```

**The three on-call reflexes:**
```
"Disk full"      → df -h  →  du -sh /var/*  →  find & clear big files
"Service down"   → systemctl status X  →  journalctl -u X -e  →  restart
"Server slow"    → top  →  find the PID  →  investigate/kill  →  check logs
```

---

## 8.5 Text processing cheat sheet ★★★★★

```
grep   FIND lines       grep -i (ignore case)  -v (invert)  -r (recursive)
                        -n (line #)  -c (count)  -E "a|b" (regex)
awk    COLUMNS          awk '{print $1}'   $NF (last)   -F',' (delimiter)
                        awk '$4==500 {print $1}'   (filter by field)
sed    SUBSTITUTE       sed 's/old/new/g'   -i (in-place)   -i.bak (backup)
tr     CHARACTERS       tr 'a-z' 'A-Z'   -d (delete)   -s (squeeze)

THE GOLDEN PIPELINE (top-N / count-each):
    awk '{print $1}' log | sort | uniq -c | sort -rn | head
    → extract → sort → count → rank → top few
```

---

## 8.6 Bash syntax cheat sheet ★★★★☆

```
SHEBANG      #!/bin/bash
VARIABLES    name="x"   (no spaces!)   echo "$name"   x=$(command)
ARGUMENTS    $1 $2 (positional)  $# (count)  $@ (all)  $0 (script name)
CONDITIONS   if [ $n -gt 5 ]; then ... elif ... else ... fi
             numbers: -eq -ne -gt -lt -ge -le    strings: = != -z -n
             files:   -f (file) -d (dir) -e (exists) -r -w -x
LOOPS        for x in list; do ... done      while [ cond ]; do ... done
             arithmetic: $(( a + b ))         seq 1 10
FUNCTIONS    name() { echo "$1"; return 0; }
EXIT CODES   0 = success; check $?;  cmd1 && cmd2  (and);  cmd1 || cmd2 (or)
CRON         min hour day-of-month month day-of-week  command
             0 2 * * *  = 2 AM daily      */15 * * * *  = every 15 min
```

> ⚠️ **Bash top traps:** no spaces around `=`; spaces required inside `[ ]`; use `-gt` not `>` for numbers; quote your `"$variables"`.

---

## 8.7 Git cheat sheet ★★★★★

```
DAILY        git clone URL    git status    git add .    git commit -m "msg"
             git push    git pull    git log --oneline    git diff
BRANCHES     git checkout -b feature   git switch main   git merge feature
             git branch -d feature
FETCH/PULL   fetch = download only    pull = fetch + merge
UNDO         git stash / git stash pop        (shelve changes)
             git revert COMMIT   (safe: new undo commit — use on shared)
             git reset --soft HEAD~1  (undo commit, keep changes)
             git reset --hard HEAD~1  (undo + DISCARD — destructive!)
CONFLICTS    <<<<<<< mine  =======  theirs  >>>>>>>
             edit to correct → delete markers → git add → git commit

RULES:  Pull first, push last.   Never rebase shared/pushed history.
        Use revert (not reset) on shared branches.
```

---

## 8.8 Master diagrams (redraw these from memory)

**The OSI model (top → bottom):**
```
7 Application   ┐
6 Presentation  ├ "Application" in TCP/IP   ← HTTP, DNS, TLS
5 Session       ┘
4 Transport     ← TCP / UDP / ports
3 Network       ← IP / routers
2 Data Link     ┐ "Link" in TCP/IP        ← Ethernet, MAC, switches
1 Physical      ┘                          ← cables, Wi-Fi
Mnemonic: "All People Seem To Need Data Processing"
```

**TCP 3-way handshake:**
```
Client ── SYN ──▶ Server        "can we talk?"
Client ◀ SYN-ACK ─ Server       "yes, can you hear me?"
Client ── ACK ──▶ Server        "yes — go"
```

**"Type google.com and press Enter" — the whole journey:**
```
DNS resolve  →  TCP handshake (port 443)  →  TLS handshake (cert + key)
   →  HTTP GET  →  [load balancer → reverse proxy → app → DB]
   →  HTTP 200 + HTML  →  browser renders (fetches CSS/JS/images)
Chant: "Do The Task, Handle The Response, Render."
```

**Process state machine:**
```
NEW → READY ⇄ RUNNING → TERMINATED
        ↑        ↓
      WAITING ◀──┘  (I/O; returns to READY when done, not RUNNING)
```

**Git's four areas:**
```
Working Dir ──add──▶ Staging ──commit──▶ Local Repo ──push──▶ Remote
     ◀────────────────────────────────────────────pull────────┘
```

**Deadlock's 4 conditions (all required):**
```
Mutual exclusion + Hold-and-wait + No preemption + Circular wait
"Mine, held, no-take-backs, in a circle."  Break ONE to prevent it.
```

**Containers vs VMs:**
```
VM:        [App+OS][App+OS] / Hypervisor / Host OS / HW   (heavy, minutes)
Container: [App][App][App]  / Docker / Host OS(shared) / HW (light, seconds)
```

---

## 8.9 Interview one-liners (steal these exact phrasings) ★★★★★

Memorize these crisp sentences — they make you sound senior:

- **Process vs thread:** "A process has its own private memory; threads share memory within a process — fast, but race-prone."
- **Deadlock:** "Four conditions must all hold — mutual exclusion, hold-and-wait, no preemption, circular wait. Break one and you're safe; ordering locks breaks circular wait."
- **Context switch:** "Pure overhead — save one process's state, load another's; the cache goes cold, so too many switches waste CPU."
- **TCP vs UDP:** "TCP is a phone call — reliable and acknowledged. UDP is shouting across a room — fast, but no guarantees."
- **DNS:** "It turns a name into an IP through a caching hierarchy — and it returns an IP, not the page."
- **HTTPS:** "Asymmetric crypto to agree a key once, then fast symmetric crypto for the data; the certificate proves identity."
- **401 vs 403:** "401 is 'who are you?', 403 is 'I know you, and no.'"
- **Idempotent:** "Doing it again has no extra effect — which is why you can safely retry a PUT but not a POST."
- **Load balancer:** "Spreads traffic for scalability and removes dead servers via health checks for availability."
- **Reverse proxy:** "Sits in front of servers — clients see it, not the backend. reveRse = seRveR."
- **kill -9:** "Last resort — SIGKILL can't be caught, so the process can't clean up. I try SIGTERM first."
- **Disk full:** "`df -h` to find the full mount, `du -sh *` to drill into the culprit — usually runaway logs in /var/log."
- **Merge vs rebase:** "Merge preserves history with a merge commit; rebase makes it linear but rewrites history — never on shared branches."
- **Docker vs VM:** "Containers share the host kernel and bundle just the app — megabytes and seconds, versus a VM's whole OS."
- **IaaS/PaaS/SaaS:** "How much the provider manages — you cook, you bake, or you just eat."
- **Least privilege:** "Grant each user or service only the access it actually needs — nothing more."

---

## 8.10 The 60-second self-test (do this the morning of)

Can you answer each in one breath? If not, flip back to the chapter.

1. Process vs thread? 2. Four deadlock conditions? 3. TCP vs UDP + one use each? 4. What DNS returns? 5. How HTTPS agrees on a key? 6. 401 vs 403? 7. What happens when you type google.com? 8. Find the full disk (which commands)? 9. kill vs kill -9? 10. Stack vs heap? 11. merge vs rebase + the golden rule? 12. Resolve a merge conflict — steps? 13. Container vs VM? 14. IaaS/PaaS/SaaS with examples? 15. The golden log pipeline?

> If you can answer these 15 out loud, you are genuinely interview-ready. Everything else is bonus.

> **Next:** Chapter 9 — 100 interview questions with tight, 1-minute model answers. Read them out loud.
