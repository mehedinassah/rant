# Chapter 9 — 100 Interview Questions & Model Answers

> **How to use this:** Each answer is written to be spoken in about **one minute** — the length a real interviewer expects. **Read them out loud.** Cover the answer, say yours, then compare. Speaking is a different skill from knowing, and it's the one being tested. Questions are grouped by topic and roughly ordered by frequency.

---

## Operating Systems (Q1–20)

**Q1. What is an operating system?**
The layer between applications and hardware. It manages resources — CPU, memory, disk, devices — and shares them safely among many programs. It abstracts hardware so programs use simple interfaces instead of talking to devices directly, and it isolates programs so one crash doesn't take down the system.

**Q2. What's the difference between a process and a thread?**
A process is an independent program with its own private memory. A thread is a lighter unit of execution inside a process, and threads share the process's memory. That sharing makes threads fast to create and easy to communicate between, but it also means they can corrupt shared data, so you need synchronization like mutexes. Processes are isolated and safer but heavier.

**Q3. What is a context switch and why is it expensive?**
It's when the CPU swaps from one process or thread to another. The OS saves the current one's state — registers, program counter — and loads the next one's. It's expensive because it's pure overhead: no useful work happens during the switch, and the CPU cache is now full of the old process's data, so the new one runs slower until the cache warms up.

**Q4. Explain the states a process goes through.**
New when created, Ready when waiting for the CPU, Running when on the CPU. If it needs I/O it moves to Waiting and gives up the CPU. When the I/O finishes it goes back to Ready — not straight to Running, since the CPU may be busy. Finally it Terminates. The OS constantly shuffles processes between Ready and Running to keep the CPU busy.

**Q5. What is a deadlock?**
When two or more processes wait on each other in a cycle, each holding a resource the other needs, so none can proceed. It requires four conditions at once: mutual exclusion, hold-and-wait, no preemption, and circular wait. Break any one and deadlock can't happen.

**Q6. How do you prevent a deadlock?**
Break one of the four conditions. The most practical is breaking circular wait by imposing a global lock order — always acquire lock A before lock B — so a cycle can't form. You can also avoid hold-and-wait by grabbing all resources at once, or use timeouts to detect and recover.

**Q7. Difference between a mutex and a semaphore?**
A mutex is a lock allowing exactly one thread into a critical section, and only the thread that locked it can unlock it. A semaphore is a counter allowing up to N threads through, used both to limit access to a pool of resources and to signal between threads. A binary semaphore resembles a mutex but has no ownership.

**Q8. What's the difference between the stack and the heap?**
Both live in a process's memory. The stack holds local variables and function-call frames, managed automatically in last-in-first-out order — fast but small. The heap is for dynamically allocated memory requested at runtime — large and flexible but slower, lasting until freed or garbage collected. Deep recursion overflows the stack; forgetting to free heap memory causes a leak.

**Q9. What is virtual memory?**
An abstraction giving each process its own private address space that the OS maps to physical RAM. It provides isolation, lets the system use disk as overflow through swap so programs can exceed physical RAM, and simplifies programming since every process sees a clean space starting at zero.

**Q10. What is paging and what's a page fault?**
Paging splits memory into fixed-size pages in virtual memory and frames in physical memory, with a page table mapping between them. Fixed sizes remove external fragmentation. A page fault happens when a program accesses a page not currently in RAM — the OS pauses it, loads the page from disk, updates the table, and resumes. Constant faulting is thrashing, meaning you're out of RAM.

**Q11. What's a system call?**
The controlled way a user-space program requests a service from the kernel, like opening a file or a socket. The CPU switches from user mode to kernel mode, the kernel checks permissions and does the privileged work, then switches back and returns the result. It's the single doorway between unprivileged apps and the privileged kernel.

**Q12. Difference between kernel space and user space?**
Kernel space is privileged — code there can access hardware and any memory. User space is where normal apps run, sandboxed. When an app needs something privileged it asks the kernel through a system call. That boundary keeps a buggy app from crashing the whole system.

**Q13. What is a zombie process?**
A process that has finished but still has an entry in the process table because its parent hasn't collected its exit status with wait(). It uses no CPU or memory — just a table entry. A few are harmless, but if a parent never reaps them, zombies pile up and can exhaust the process table.

**Q14. What is an orphan process?**
A process whose parent terminated while it's still running. It gets adopted by init, PID 1, which becomes its new parent and reaps it when it finishes. So unlike zombies, orphans are cleaned up properly.

**Q15. Compare FCFS, SJF, and Round Robin scheduling.**
FCFS runs jobs in arrival order — simple, but a long job blocks everyone, the convoy effect. SJF runs the shortest job first, giving the best average wait, but long jobs can starve. Round Robin gives each process a fixed time slice and rotates — fair and responsive, ideal for interactive systems, at the cost of context-switch overhead.

**Q16. Which scheduler for an interactive system, and why?**
Round Robin. Each process gets a small fixed time slice, so no one hogs the CPU and everyone gets a quick response — exactly what interactive workloads need. The trade-off is the slice size: too big degrades to FCFS, too small wastes CPU on context switching.

**Q17. What's the difference between deadlock and starvation?**
Deadlock is when processes are stuck in a cycle forever, none able to proceed. Starvation is when a process keeps getting skipped — like a long job under SJF — but the system as a whole is still making progress. Deadlock is total; starvation is unfair scheduling.

**Q18. What is the kernel?**
The core of the OS — always running with full hardware access. It manages memory, schedules processes, handles system calls, and drives devices. Everything else runs with limited privilege and must go through the kernel for anything sensitive. Note: Linux is technically just the kernel; a distribution adds the surrounding tools.

**Q19. What is a race condition?**
When two threads access shared data at the same time and the result depends on timing, corrupting the data — like two threads both incrementing a balance and one update getting lost. You prevent it with synchronization, such as a mutex protecting the critical section.

**Q20. What's the difference between paging and segmentation?**
Paging divides memory into fixed-size blocks, which eliminates external fragmentation and is what modern systems use. Segmentation divides it into variable-size logical units — code, stack, heap. Paging is by convenience; segmentation is by meaning. Pure segmentation is rare today.

---

## Networking (Q21–47)

**Q21. Explain the OSI model.**
A 7-layer framework for how data moves across a network: Application, Presentation, Session, Transport, Network, Data Link, Physical — "All People Seem To Need Data Processing." Each layer has one job. In practice the ones that matter are Layer 7 HTTP, Layer 4 TCP/UDP, and Layer 3 IP.

**Q22. TCP vs UDP?**
Both are transport-layer protocols. TCP is connection-based, reliable, and ordered — it uses a handshake and acknowledgements to guarantee delivery, so it's used for web, email, and file transfer. UDP is connectionless and best-effort — no handshake or guarantees, but faster, so it's used for video calls, gaming, and DNS.

**Q23. When would you choose UDP over TCP?**
For real-time traffic like live video or gaming. A packet that arrives late is useless there — you'd rather drop it and stay real-time than stall waiting for a retransmission. TCP's reliability guarantees are the wrong trade-off; a small glitch beats a delay.

**Q24. Explain the TCP three-way handshake.**
It sets up a connection in three steps: the client sends SYN ("let's talk"), the server replies SYN-ACK ("okay, can you hear me?"), and the client sends ACK ("yes, go"). After that, data flows on the established connection. It ensures both sides are ready and synchronized before sending data.

**Q25. What is DNS and how does it work?**
DNS turns a domain name into an IP address. Your browser checks its cache, then the OS cache; if it's not there, it asks a recursive resolver, which walks the hierarchy — root server, then the TLD server like .com, then the domain's authoritative nameserver, which returns the IP. The resolver caches it for its TTL. Importantly, DNS returns an IP, not the web page.

**Q26. What's a port?**
A number identifying a specific service on a machine. The IP address gets you to the right computer; the port gets you to the right program on it — since one server runs many services on the same IP. For example, 80 is HTTP, 443 HTTPS, 22 SSH.

**Q27. Name some common ports.**
22 SSH, 25 SMTP, 53 DNS, 80 HTTP, 443 HTTPS, 3306 MySQL, 5432 PostgreSQL, 6379 Redis, 27017 MongoDB.

**Q28. How does HTTPS work?**
HTTPS is HTTP over TLS. On connecting there's a handshake: the server presents a certificate the browser verifies against a trusted Certificate Authority, proving identity. They use asymmetric encryption to agree on a shared session key, then switch to fast symmetric encryption for the actual data. So you get authentication, encryption, and integrity without the cost of asymmetric crypto for everything.

**Q29. Symmetric vs asymmetric encryption in HTTPS?**
Asymmetric uses a public/private key pair — secure but slow — and is used only during the handshake to safely exchange a shared key. Symmetric uses that single shared key — fast — and encrypts all the actual data. HTTPS combines them: asymmetric to agree the key once, symmetric for speed thereafter.

**Q30. What does it mean that HTTP is stateless?**
Every request is independent — the server doesn't inherently remember previous requests from the same client. That keeps servers simple and scalable, but it's why we need cookies, sessions, or tokens to maintain things like a logged-in state across requests.

**Q31. What is a cookie?**
A small piece of data the server tells the browser to store and send back on every request to that site. Since HTTP is stateless, cookies let the server recognize a returning user — classically holding a session ID after login. You flag them HttpOnly so JavaScript can't steal them, and Secure so they only travel over HTTPS.

**Q32. Difference between a cookie and a session?**
A cookie is client-side storage in the browser; a session is server-side storage. Usually they work together — the server keeps the user's real data in a session and sends a cookie with just the session ID. Sessions keep sensitive data on the server, which is more secure, but they use server memory.

**Q33. Session vs JWT?**
A session stores state on the server and gives the client an ID; a JWT is stateless — the token itself carries the user's identity, signed by the server so it can't be forged. JWTs suit distributed systems since any server can verify them without a shared store, but they're hard to revoke before expiry. Note a JWT is signed, not encrypted, so never put secrets in it.

**Q34. What makes an API RESTful?**
It's organized around resources addressed by URLs and uses standard HTTP methods for actions — GET to read, POST to create, PUT to update, DELETE to remove. It's stateless, so each request carries all needed context, and it typically exchanges JSON. The idea is predictability.

**Q35. Difference between PUT and POST?**
POST creates a new resource and isn't idempotent — sending it twice creates two resources, which is why double-clicking submit can double-charge you. PUT replaces a resource at a known URL and is idempotent — sending it twice leaves the same final state.

**Q36. What does idempotent mean?**
Repeating the request has no additional effect beyond the first. GET, PUT, and DELETE are idempotent; POST isn't. It matters for safe retries — if a network call times out, you can safely resend an idempotent request without risking a duplicate action.

**Q37. Difference between 401 and 403?**
401 Unauthorized means you're not authenticated — the server doesn't know who you are, so log in. 403 Forbidden means you are authenticated but don't have permission for this resource. In short: 401 is "who are you?", 403 is "I know you, and no."

**Q38. What does a 502 mean and how does it differ from 500 and 503?**
500 is a generic internal server error. 502 Bad Gateway means a proxy or load balancer got an invalid response from the upstream server behind it. 503 Service Unavailable means the server is overloaded or down. 504 is a gateway timeout — upstream didn't answer in time. In on-call, a wave of 502s or 504s usually means a backend is down or slow.

**Q39. What happens when you type google.com and press Enter?**
DNS resolves the name to an IP. The browser opens a TCP connection on port 443 via the three-way handshake. Because it's HTTPS, a TLS handshake follows — the server sends a certificate the browser verifies, and they agree a session key. The browser sends an HTTP GET; on the server side it may pass through a load balancer and reverse proxy to an app server and database, returning 200 OK with HTML. The browser parses it and fetches CSS, JS, and images to render the page.

**Q40. What is a load balancer?**
It sits in front of a group of servers and spreads requests across them using an algorithm like round robin or least connections. It gives scalability — add servers to handle load — and availability, since it health-checks backends and stops routing to failed ones. Layer 4 routes by IP/port; Layer 7 understands HTTP and can route by URL path.

**Q41. Forward proxy vs reverse proxy?**
It's about which side it protects. A forward proxy sits in front of clients — the destination server sees the proxy, not the real client; used for caching, filtering, or anonymity. A reverse proxy sits in front of servers — clients talk to it and it forwards to backends; used for load balancing, SSL termination, and hiding the backend. Nginx is the classic reverse proxy.

**Q42. What is NAT?**
Network Address Translation lets many devices share one public IP. Devices use private IPs internally; the router rewrites outgoing packets' source to its public IP and keeps a table to route replies back to the right device. It conserves the limited IPv4 space and is what lets a whole household browse through one public address.

**Q43. What does a firewall do?**
It filters network traffic against rules — typically by IP, port, and protocol — allowing or blocking connections. Best practice is default-deny: block everything, then open only the ports you need, like 443 and 22. In the cloud, security groups are essentially firewalls on your instances.

**Q44. What is SSH and how do you use it securely?**
SSH is an encrypted protocol for remote login and running commands, over port 22. Securely, you use key-based authentication rather than passwords: keep a private key locally, put the public key on the server, and authenticate cryptographically without sending a password. It's more secure and easy to automate.

**Q45. What is DHCP?**
It automatically assigns a device an IP address, plus subnet mask, gateway, and DNS, when it joins a network. The handshake is DORA: the device broadcasts Discover, the server sends an Offer, the device sends a Request, and the server sends an Ack with a lease. It saves configuring every device by hand.

**Q46. Difference between the OSI and TCP/IP models?**
OSI is the 7-layer teaching model; TCP/IP is the practical 4-layer model the internet runs on. They map onto each other — OSI's top three layers collapse into TCP/IP's Application layer, and its bottom two into the Link layer. TCP/IP is what's actually implemented.

**Q47. What layer does a router work at versus a switch?**
A router works at Layer 3, the Network layer — it routes between networks using IP addresses. A switch works at Layer 2, the Data Link layer — it forwards frames within a local network using MAC addresses. So switches connect devices on one network; routers connect different networks.

---

## Linux (Q48–67)

**Q48. How do you view the last 50 lines of a log and watch it update live?**
`tail -50 file` for the last 50 lines. To watch it in real time, `tail -f file` — the `-f` follows the file and prints new lines as they're written. That's my go-to when debugging a live service during a deploy.

**Q49. Difference between find and grep?**
`find` searches for files by attributes — name, type, size, modification time. `grep` searches for text inside files. So find answers "where is the file?" and grep answers "which lines contain this text?" You often combine them — find to locate files, grep to search within.

**Q50. The disk is full — how do you find what's using the space?**
Start with `df -h` to see which filesystem is full. Then drill in with `du -sh *`, moving into the largest directory to find the culprit — often runaway logs in /var/log. A handy one-liner is `du -h /path | sort -rh | head`. Then I clear or rotate the files and check why they grew — maybe rotation is broken.

**Q51. Difference between df and du?**
`df` shows free space per filesystem — the big picture of which disk is full. `du` shows usage of specific files and directories — the detail for hunting down the culprit. You use df to spot the problem and du to locate it.

**Q52. A process is stuck at 100% CPU — what do you do?**
I'd run `top` to confirm the process and get its PID. To stop it I'd start with `kill PID`, which sends SIGTERM and lets it shut down gracefully. If it ignores that, `kill -9 PID`, which is SIGKILL and can't be caught — but that's a last resort since it can't clean up. Then I'd check logs to find why it spun up.

**Q53. Difference between kill and kill -9?**
`kill` sends SIGTERM — a polite request to shut down gracefully, so the process can save state and close files. `kill -9` sends SIGKILL, which can't be caught or ignored and terminates immediately, but may leave corrupt files or leaked resources. Always try `kill` first; use `-9` only when it won't die.

**Q54. What does chmod 755 mean?**
Owner gets read-write-execute — that's 4+2+1 — and group and others get read-execute, 4+1. It's standard for scripts and directories: the owner can modify and run it, everyone else can read and run. 644 — read-write for owner, read-only otherwise — is typical for plain files.

**Q55. How do you make a script executable?**
`chmod +x script.sh` adds the execute permission. Then I can run it with `./script.sh`. Under the hood, execute is the "1" bit in the numeric permissions.

**Q56. How do you check if a service is running and restart it?**
`systemctl status service` shows if it's active, when it started, and recent logs. To restart after a config change, `systemctl restart service`, or `reload` to avoid downtime. `enable` makes it start on boot. If it won't start, I check `journalctl -u service -e` for the error.

**Q57. How do you see which ports are open on a server?**
`ss -tulnp` — or the older `netstat -tulnp` — lists listening ports and which process owns each. It's the first thing I check when a service won't accept connections, to confirm it's actually listening on the expected port.

**Q58. What are pipes and redirection?**
A pipe `|` sends one command's output into the next command's input, letting you chain small tools — like `ps aux | grep nginx`. Redirection sends output to files: `>` overwrites, `>>` appends, `2>` captures errors. Together they're the glue that makes small Unix tools powerful.

**Q59. How would you count how many times "error" appears in a log?**
`grep -c error app.log` counts matching lines directly. Or with a pipe, `grep error app.log | wc -l`. If I wanted case-insensitive, I'd add `-i` to catch Error and ERROR too.

**Q60. What's the difference between absolute and relative paths?**
An absolute path starts from root, like `/var/log/app.log`, and is the same regardless of where you are. A relative path is from your current directory, like `../logs/app.log`. Absolute is unambiguous; relative is shorter but depends on your location.

**Q61. What does the /var/log directory contain?**
System and application logs. It's the first place I look when troubleshooting — for example `/var/log/syslog` or `/var/log/nginx/error.log`. Config lives in `/etc`, logs in `/var/log`, and user files in `/home` — those three cover most of what you touch.

**Q62. How do you find files larger than 100 MB?**
`find / -size +100M` searches from root for files over 100 megabytes. It's useful when hunting down what's filling a disk. I'd usually scope it to a directory rather than all of `/` to keep it fast.

**Q63. What does the "everything is a file" philosophy mean?**
In Linux, most things — documents, directories, devices, even some kernel info under /proc — are represented as files. That uniformity means the same tools like cat, grep, and redirection work across all of them, which is a big part of why the command line is so composable.

**Q64. How do you search for text recursively in a directory?**
`grep -r "text" .` searches every file under the current directory. Adding `-n` shows line numbers and `-i` makes it case-insensitive, so `grep -rni "text" .` is a common form when I don't know which file contains something.

**Q65. What's the difference between a hard link and a soft link?**
A soft link, or symlink, is a pointer to another path — if the target is deleted, the link breaks. A hard link is another name for the same underlying file data, so it still works even if the original name is removed. Symlinks are more common day to day; you make one with `ln -s`.

**Q66. What is sudo?**
"Superuser do" — it runs a single command with root privileges. You use it for system-level actions like restarting services, installing software, or editing files in /etc. It's safer than logging in as root because it's per-command and logged.

**Q67. How do you view running processes?**
`ps aux` gives a detailed snapshot of all processes, and `ps aux | grep name` filters to one. For a live, updating view sorted by CPU, `top` or `htop`. I use ps for a quick check and top when watching resource usage in real time.

---

## Bash Scripting (Q68–77)

**Q68. What's the first line of a shell script for?**
The shebang, `#!/bin/bash`. It tells the OS which interpreter should run the script. Without it, the system doesn't know the file is a Bash script and how to execute it.

**Q69. How does a script access command-line arguments?**
Positional parameters: `$1` is the first, `$2` the second, and so on. `$0` is the script name, `$@` is all arguments, and `$#` is the count. I check `$#` at the top to validate the user passed what's required, printing usage and exiting if not.

**Q70. How do you check if a file exists in Bash?**
`if [ -f /path/file ]; then ... fi`. The `-f` test is true if it exists and is a regular file; `-d` checks a directory and `-e` checks either. I use this constantly in ops scripts before acting on a config or log.

**Q71. What's a common mistake with variable assignment in Bash?**
Putting spaces around the equals sign. It must be `name="value"` with no spaces — `name = "value"` makes Bash treat name as a command. Also, you assign without a dollar sign but read with one, like `$name`.

**Q72. How do you know if the last command succeeded?**
Check `$?` — it holds the exit code, where 0 means success and non-zero means failure. I can branch on it with an `if`, or chain: `cmd1 && cmd2` runs the second only if the first succeeds, `cmd1 || cmd2` only if it fails.

**Q73. What are the numeric comparison operators in Bash?**
`-eq` equal, `-ne` not equal, `-gt` greater than, `-lt` less than, `-ge` and `-le` for greater/less-or-equal. You use these for numbers inside test brackets — not the symbols like `>`, which mean redirection. Strings use `=` and `!=`.

**Q74. How would you loop over all files in a directory?**
`for file in *; do ... done`, or `for file in *.log` to match a pattern. Inside I reference `$file`. For reading a file line by line I'd use a while loop: `while read line; do ...; done < input.txt`.

**Q75. How do you schedule a script to run every night?**
A cron job. `crontab -e` and add `0 2 * * * /path/script.sh` to run at 2 AM daily. The five fields are minute, hour, day of month, month, day of week. I'd redirect output to a log to confirm it ran and debug failures.

**Q76. What does $(command) do?**
Command substitution — it runs the command and captures its output into a value. For example `today=$(date +%Y-%m-%d)` stores the date in a variable. It's how you use one command's result inside a script.

**Q77. How do you capture output and errors from a command?**
`>` redirects standard output to a file, `2>` redirects standard error, and `> out.log 2>&1` sends both to the same file. The `2>&1` means "send stream 2, stderr, to wherever stream 1 is going." Useful for logging a script's full output.

---

## Text Processing — grep/awk/sed/tr (Q78–85)

**Q78. Find all lines containing "error", case-insensitive, and count them.**
`grep -ic error file`. The `-i` makes it case-insensitive so it catches Error and ERROR, and `-c` counts matching lines instead of printing them. To see them with line numbers instead, `grep -in error file`.

**Q79. From a log, print only the IPs of requests that returned 500.**
`awk '$4 == 500 {print $1}' access.log`. awk splits each line into fields, so `$4` is the status and `$1` the IP. The condition filters to 500s and prints the IP. awk beats grep here because it understands columns, not just whole lines.

**Q80. How would you replace every occurrence of "foo" with "bar" in a file?**
`sed -i 's/foo/bar/g' file`. The `s` substitutes, `g` makes it replace every occurrence per line rather than just the first, and `-i` edits in place. I'd often use `-i.bak` to keep a backup, since regex mistakes on a live file are easy and hard to undo.

**Q81. Find the top 5 IPs making requests in a web log.**
`awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5`. awk pulls the IP, sort groups identical IPs together, `uniq -c` counts them — which is why sort comes first — then `sort -rn` orders by count descending and `head -5` takes the top five.

**Q82. What's the difference between grep and awk?**
grep finds and prints whole lines matching a pattern. awk understands structure — it splits lines into fields, so it can extract specific columns, filter by a field's value, and do arithmetic. Use grep to find lines, awk to work with columns.

**Q83. How do you convert text to uppercase or remove specific characters?**
`tr 'a-z' 'A-Z'` uppercases, piping the input in. `tr -d '0-9'` deletes digits. tr operates on individual characters, so it's right for case changes, deleting or squeezing characters, or swapping delimiters — not word or pattern matching.

**Q84. What does uniq -c do, and why sort first?**
`uniq -c` collapses repeated adjacent lines and prefixes each with its count. It only compares adjacent lines, so you must sort first to group identical lines together — otherwise duplicates scattered through the file won't be counted correctly. That's why the pattern is always `sort | uniq -c`.

**Q85. Extract the second column of a CSV file.**
`awk -F',' '{print $2}' data.csv`. The `-F','` sets the field separator to a comma so awk splits on commas, then `$2` is the second field. The same trick with `-F':'` works on colon-separated files like /etc/passwd.

---

## Git (Q86–95)

**Q86. Walk me through your normal Git workflow.**
I pull the latest first so I'm on current code. I edit, then `git status` and `git diff` to review. I stage with `git add`, commit with a clear message about why, and push. For features I work on a branch and open a pull request so it's reviewed before merging to main.

**Q87. Difference between git fetch and git pull?**
`fetch` downloads remote changes but leaves my working branch untouched, so I can review before integrating. `pull` is fetch plus merge — it downloads and immediately merges into my current branch. Pull is the quick everyday command; fetch is safer when I want to look first.

**Q88. Difference between merge and rebase?**
Both integrate one branch into another. Merge creates a merge commit and preserves the branching history — safe and non-destructive. Rebase replays my commits on top of the target for a clean linear history, but it rewrites history. I rebase my own local branch to tidy it, merge for shared branches, and never rebase already-pushed history.

**Q89. Why shouldn't you rebase a shared branch?**
Rebasing rewrites commit history, creating new commit IDs. If others have already pulled the old commits, their history no longer matches, which causes conflicts and confusion for the whole team. So rebase only your own local, un-pushed work.

**Q90. How do you resolve a merge conflict?**
A conflict happens when two branches edit the same lines. Git marks the sections with `<<<<<<<`, `=======`, `>>>>>>>` showing both versions. I open each conflicted file, decide the correct final code — mine, theirs, or a mix — remove the markers, then `git add` and `git commit`. `git status` lists which files still need resolving.

**Q91. Difference between git reset and git revert?**
Both undo, differently. `revert` creates a new commit that reverses an earlier one, keeping history intact — safe on shared branches. `reset` moves the branch pointer backward and effectively removes commits, rewriting history — risky if pushed. On shared branches I use revert; reset only for local, un-pushed commits.

**Q92. What does git stash do?**
It shelves your uncommitted changes and gives you a clean working directory, so you can switch branches or pull without committing half-done work. `git stash pop` brings the changes back. It's like sweeping your desk into a drawer to handle something urgent, then tipping it back out.

**Q93. What's the staging area?**
An intermediate area between your working directory and the repository. `git add` moves changes into staging, and `git commit` saves what's staged. It lets you choose exactly which changes go into each commit, rather than committing everything at once — so you can craft focused, logical commits.

**Q94. How do you create and switch to a new branch?**
`git checkout -b feature-name` creates and switches in one step, or `git switch -c feature-name` in newer Git. Branches let me work in isolation without touching main, then merge back when ready.

**Q95. What's the difference between git reset --soft and --hard?**
`--soft` moves the branch pointer back but keeps your changes staged, so you can re-commit them — good for redoing a commit message. `--hard` moves the pointer back and discards the working changes entirely, which is destructive and unrecoverable, so I use it carefully.

---

## Cloud Computing (Q96–100)

**Q96. What is cloud computing and why do companies use it?**
Renting computing resources — servers, storage, databases — over the internet instead of owning hardware. Companies use it because it turns big upfront costs into pay-as-you-go, and it's elastic: scale up when busy, down when quiet. It also offloads physical maintenance to the provider and enables fast global deployment.

**Q97. Explain IaaS, PaaS, and SaaS with examples.**
Layers of how much the provider manages. IaaS, like AWS EC2, gives raw virtual machines — you manage the OS and app, most control. PaaS, like Heroku, manages the OS, runtime, and scaling — you just deploy code. SaaS, like Gmail, runs everything — you just use it. The trade-off is control versus convenience.

**Q98. What's the difference between EC2 and S3?**
EC2 is compute — a virtual server you run your application on and control at the OS level. S3 is object storage — you put files like images, backups, or logs into buckets and retrieve them over HTTP. EC2 is a machine; S3 is a place to store files, not a disk for the OS.

**Q99. What is Docker and how is a container different from a VM?**
A container packages an app with all its dependencies so it runs identically everywhere, solving "works on my machine." Docker is the standard tool. Unlike a VM, which bundles a whole guest OS and is heavy — gigabytes, minutes to boot — a container shares the host kernel and bundles just the app, so it's megabytes and starts in seconds.

**Q100. What is Kubernetes and why use it?**
It's a container orchestrator — it manages containers at scale across a cluster. Docker runs individual containers, but with hundreds across many servers you need automation to deploy, scale, restart crashed ones, and route traffic. Kubernetes is self-healing, auto-scaling, load-balancing, and does zero-downtime rolling updates. Docker packs the box; Kubernetes runs the fleet.

---

> **You've now rehearsed the 100 questions that cover the vast majority of what you'll be asked.** Say the ones you fumbled out loud three more times. Then move to Chapter 10 — the mock interviews, where you'll practice stringing these together under pressure.
