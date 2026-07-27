# Chapter 11 — Final Exam

> **How to use this:** Do the exam **closed-book** first — no peeking. Then check the answer keys at the end of each section. Score yourself. Anything you miss, flip back to the relevant chapter *the same day*. Aim for 80%+ before your interview.
>
> **Sections:** 100 Multiple-Choice · 50 Short Questions · 20 Practical Linux · 20 Networking Scenarios · Answer Keys.

---

# Part A — 100 Multiple-Choice Questions

*(Answer key at the end of Part A.)*

## Operating Systems (1–20)

**1.** Threads of the same process each have their own:
a) Heap  b) Global variables  c) Stack  d) Code segment

**2.** How many of the four Coffman conditions must hold for a deadlock?
a) All four  b) Any one  c) Exactly three  d) At least two

**3.** A process that has finished but whose exit status hasn't been read is a:
a) Zombie  b) Orphan  c) Daemon  d) Thread

**4.** Which scheduling algorithm is best for interactive systems?
a) FCFS  b) SJF  c) Priority (non-preemptive)  d) Round Robin

**5.** The stack is characterized by:
a) LIFO, automatic, fast  b) Manual allocation  c) Unlimited size  d) Garbage collection

**6.** A page fault occurs when:
a) The disk is full  b) A referenced page isn't in RAM  c) A page is corrupted  d) The CPU overheats

**7.** A mutex allows how many threads in a critical section at once?
a) Up to N  b) Zero  c) Exactly one  d) Unlimited

**8.** Which is TRUE of virtual memory?
a) It's the same as the CPU cache  b) It replaces RAM entirely  c) It gives each process a private address space  d) It only works with SSDs

**9.** An orphan process is adopted by:
a) init / PID 1  b) The kernel scheduler  c) The nearest parent  d) No one; it dies

**10.** A context switch is expensive mainly because:
a) It uses network bandwidth  b) It needs root privileges  c) It's pure overhead and cools the cache  d) It requires disk writes always

**11.** Which lives in kernel space?
a) Your web browser  b) A Python script  c) A text editor  d) The process scheduler

**12.** The transition from Running to Waiting typically happens because:
a) It needs I/O  b) The process finished  c) The CPU failed  d) It was created

**13.** SJF scheduling's main risk is:
a) Convoy effect  b) Deadlock  c) Starvation of long jobs  d) Too many context switches

**14.** Paging eliminates which kind of fragmentation?
a) Internal  b) External  c) Both  d) Neither

**15.** A system call causes:
a) A reboot  b) A switch from user mode to kernel mode  c) A network request  d) A page fault always

**16.** Two threads incrementing a shared counter without locks can cause a:
a) Deadlock  b) Page fault  c) Context switch  d) Race condition

**17.** Which is NOT one of the four deadlock conditions?
a) Mutual exclusion  b) Preemption allowed  c) Circular wait  d) Hold and wait

**18.** Heap memory in a garbage-collected language is freed:
a) When the function returns  b) By the GC when unreachable  c) Never  d) At compile time

**19.** "Linux" technically refers to the:
a) Whole operating system  b) Desktop environment  c) Kernel  d) Package manager

**20.** A binary semaphore has a count of:
a) 0  b) 2  c) 1  d) N

## Networking (21–50)

**21.** TCP provides all EXCEPT:
a) The lowest possible latency  b) Reliability  c) Ordering  d) Acknowledgements

**22.** DNS primarily returns:
a) The web page  b) A MAC address  c) An IP address  d) A port number

**23.** HTTPS default port is:
a) 443  b) 80  c) 22  d) 8080

**24.** The TCP handshake order is:
a) ACK, SYN, SYN-ACK  b) SYN, SYN-ACK, ACK  c) SYN, ACK, SYN  d) SYN-ACK, SYN, ACK

**25.** A 403 status code means:
a) Not authenticated  b) Server error  c) Authenticated but not allowed  d) Not found

**26.** A 401 status code means:
a) Not authenticated  b) Forbidden  c) Bad gateway  d) Too many requests

**27.** Which protocol is connectionless?
a) TCP  b) HTTP  c) UDP  d) FTP

**28.** SSH uses port:
a) 21  b) 22  c) 23  d) 25

**29.** In TLS, the shared session key is used for:
a) Verifying the certificate  b) DNS lookups  c) Fast symmetric encryption of data  d) Nothing

**30.** A reverse proxy sits in front of:
a) Clients  b) Servers  c) Routers  d) DNS

**31.** A 5xx status code indicates:
a) Client error  b) Redirect  c) Success  d) Server error

**32.** Which is idempotent?
a) POST  b) PUT  c) PATCH (always)  d) None

**33.** DHCP's four-step process is:
a) SYN-ACK-FIN-RST  b) Get-Post-Put-Delete  c) Discover-Offer-Request-Ack  d) Root-TLD-Auth-Cache

**34.** NAT primarily solves:
a) Slow DNS  b) IPv4 address shortage  c) Weak encryption  d) Deadlocks

**35.** A cookie is stored:
a) On the server  b) In the browser (client-side)  c) In DNS  d) On the router

**36.** A session's data is stored:
a) Client-side  b) In the URL  c) Server-side  d) In the cookie itself

**37.** Which OSI layer is TCP?
a) 3 Network  b) 7 Application  c) 2 Data Link  d) 4 Transport

**38.** IP addressing happens at OSI layer:
a) 2  b) 3  c) 4  d) 7

**39.** A JWT is:
a) Encrypted by default  b) Signed but not encrypted by default  c) Stored server-side  d) A type of cookie only

**40.** A load balancer improves:
a) Only security  b) DNS speed only  c) Scalability and availability  d) Encryption strength

**41.** UDP is preferred for:
a) File downloads  b) Live video calls  c) Banking transactions  d) Email

**42.** MySQL's default port is:
a) 5432  b) 6379  c) 3306  d) 27017

**43.** A 301 status code means:
a) Temporary redirect  b) Permanent redirect  c) Not modified  d) Created

**44.** The mnemonic "All People Seem To Need Data Processing" is for:
a) TCP handshake  b) HTTP methods  c) DHCP  d) OSI layers

**45.** A firewall's best-practice default policy is:
a) Allow all  b) Deny all, then allow specifics  c) Allow all internal  d) No policy

**46.** A 502 Bad Gateway usually means:
a) DNS failed  b) The client sent bad data  c) The upstream/backend gave an invalid response  d) Rate limited

**47.** POST is used to:
a) Read a resource  b) Create a resource  c) Delete a resource  d) Replace a resource

**48.** A forward proxy is used for:
a) Load balancing servers  b) SSL termination  c) Client caching/filtering/anonymity  d) Hiding backends

**49.** The recursive resolver in DNS asks servers in this order:
a) Authoritative, TLD, Root  b) Root, TLD, Authoritative  c) TLD, Root, Authoritative  d) Cache only

**50.** DNS most commonly runs over:
a) TCP only  b) UDP (port 53)  c) HTTP  d) ICMP

## Linux (51–75)

**51.** To watch a log file update live:
a) cat file  b) head file  c) tail -f file  d) less file

**52.** Which finds text *inside* files?
a) grep  b) find  c) ls  d) locate

**53.** `chmod 755` gives others:
a) rwx  b) rw-  c) r-x  d) ---

**54.** Which shows free disk space per filesystem?
a) du  b) ls  c) df  d) free

**55.** Which shows usage of specific directories?
a) df  b) top  c) du  d) ps

**56.** `kill -9` sends:
a) SIGTERM  b) SIGHUP  c) SIGKILL  d) SIGINT

**57.** The polite signal to stop a process is:
a) SIGKILL  b) SIGTERM  c) SIGSTOP  d) SIGSEGV

**58.** To see memory usage:
a) free -h  b) df -h  c) du -sh  d) ps aux

**59.** Which lists all processes in detail?
a) ps aux  b) ls -la  c) jobs  d) top -n1 only

**60.** The permission value for read is:
a) 1  b) 2  c) 4  d) 7

**61.** `mv old.txt new.txt` does what?
a) Renames/moves  b) Copies  c) Deletes  d) Links

**62.** To make a script executable:
a) chmod +r  b) chmod 000  c) chmod +x  d) chown

**63.** Which restarts a systemd service?
a) systemctl restart X  b) service restart  c) kill -HUP  d) reboot

**64.** To read a systemd service's logs:
a) tail -f service  b) dmesg only  c) journalctl -u X  d) cat /service

**65.** The pipe `|` does what?
a) Overwrites a file  b) Appends to a file  c) Sends one command's output to another  d) Runs in background

**66.** `>>` does what?
a) Overwrites  b) Reads input  c) Appends  d) Pipes

**67.** Logs typically live in:
a) /var/log  b) /etc  c) /home  d) /bin

**68.** Config files typically live in:
a) /var  b) /tmp  c) /etc  d) /dev

**69.** `find / -size +100M` finds:
a) Files modified in 100 min  b) 100 files  c) Files larger than 100 MB  d) Directories only

**70.** `grep -v error` shows:
a) Lines without "error"  b) Only error lines  c) Line count  d) Case-insensitive matches

**71.** `grep -i` means:
a) Invert  b) Recursive  c) Ignore case  d) Line numbers

**72.** `ps aux | grep nginx` does what?
a) Lists processes, filters to nginx  b) Kills nginx  c) Starts nginx  d) Restarts nginx

**73.** `cd ~` goes to:
a) Root  b) Parent dir  c) Home directory  d) Previous dir

**74.** Which command shows open listening ports?
a) ss -tulnp  b) ls -l  c) df -h  d) top

**75.** `sudo` means:
a) Shutdown  b) Superuser do  c) Sudo directory  d) System update

## Bash / Text / Git / Cloud (76–100)

**76.** The shebang line is:
a) # bash  b) #!/bin/bash  c) //bash  d) @bash

**77.** In Bash, `$1` is:
a) The script name  b) The exit code  c) The first argument  d) All arguments

**78.** `$#` gives:
a) The count of arguments  b) The script name  c) The last exit code  d) The PID

**79.** The exit code for success is:
a) 1  b) -1  c) 0  d) 200

**80.** Correct variable assignment:
a) `x=5`  b) `x = 5`  c) `$x=5`  d) `let x = 5`

**81.** To test if a file exists:
a) `[ -f file ]`  b) `[ -e = file ]`  c) `[ file ]`  d) `[ exists file ]`

**82.** Numeric "greater than" in Bash test is:
a) `>`  b) `gt`  c) `-gt`  d) `>>`

**83.** A cron field order is:
a) hour min day month weekday  b) sec min hour day month  c) min hour day-of-month month day-of-week  d) weekday month day hour min

**84.** `0 2 * * *` runs:
a) Every 2 hours  b) At 2 PM on the 2nd  c) Every 2 minutes  d) At 2 AM daily

**85.** Which tool is best for extracting a column?
a) grep  b) tr  c) awk  d) cat

**86.** `sed 's/a/b/g'` — the `g` means:
a) Global (all matches per line)  b) Greedy  c) Grep mode  d) Go

**87.** `tr 'a-z' 'A-Z'` does:
a) Deletes letters  b) Counts letters  c) Reverses  d) Uppercases

**88.** The "golden pipeline" for top-N counts is:
a) `grep | wc`  b) `cat | tail`  c) `awk | sed`  d) `... | sort | uniq -c | sort -rn | head`

**89.** `awk '{print $NF}'` prints:
a) The first field  b) The number of fields  c) The last field  d) The whole line

**90.** `git pull` equals:
a) fetch only  b) push + merge  c) fetch + merge  d) clone

**91.** Which safely undoes a commit on a shared branch?
a) git reset --hard  b) git rebase  c) git commit --amend  d) git revert

**92.** Merge conflict markers include:
a) `<<<<<<< ======= >>>>>>>`  b) `### ***`  c) `/* */`  d) `-- ++`

**93.** You should never rebase:
a) A local branch  b) Shared/pushed history  c) Your first commit  d) A feature branch ever

**94.** `git stash` does what?
a) Deletes changes  b) Pushes to remote  c) Temporarily shelves uncommitted changes  d) Creates a branch

**95.** In IaaS, you manage:
a) Nothing  b) The OS and app  c) Only hardware  d) Only the network cables

**96.** AWS S3 is:
a) A virtual server  b) A database engine  c) Object/file storage  d) A load balancer

**97.** AWS EC2 is:
a) A virtual server (compute)  b) Object storage  c) Identity management  d) A network

**98.** A container differs from a VM because it:
a) Includes a full guest OS  b) Is always slower  c) Can't be networked  d) Shares the host kernel, no full OS

**99.** Kubernetes primarily provides:
a) Container orchestration at scale  b) A programming language  c) A database  d) DNS resolution

**100.** CI/CD's "CI" means:
a) Continuous Isolation  b) Cloud Infrastructure  c) Continuous Integration (auto build+test)  d) Container Image

---

### Part A — Answer Key

```
1 c   2 a   3 a   4 d   5 a   6 b   7 c   8 c   9 a   10 c
11 d  12 a  13 c  14 b  15 b  16 d  17 b  18 b  19 c  20 c
21 a  22 c  23 a  24 b  25 c  26 a  27 c  28 b  29 c  30 b
31 d  32 b  33 c  34 b  35 b  36 c  37 d  38 b  39 b  40 c
41 b  42 c  43 b  44 d  45 b  46 c  47 b  48 c  49 b  50 b
51 c  52 a  53 c  54 c  55 c  56 c  57 b  58 a  59 a  60 c
61 a  62 c  63 a  64 c  65 c  66 c  67 a  68 c  69 c  70 a
71 c  72 a  73 c  74 a  75 b  76 b  77 c  78 a  79 c  80 a
81 a  82 c  83 c  84 d  85 c  86 a  87 d  88 d  89 c  90 c
91 d  92 a  93 b  94 c  95 b  96 c  97 a  98 d  99 a  100 c
```

**Scoring:** 90–100 excellent · 75–89 solid, review misses · 60–74 study weak chapters again · <60 re-read Chapters 1–7 before interviewing.

---

# Part B — 50 Short-Answer Questions

*Write a one- or two-sentence answer, then check against the key.*

1. Define a process vs a thread.
2. Name the four deadlock conditions.
3. What's the difference between a zombie and an orphan process?
4. What does a context switch do?
5. Compare mutex and semaphore.
6. What is virtual memory for?
7. Stack vs heap — one difference each.
8. What is a page fault?
9. What's the difference between SJF and Round Robin?
10. What is a system call?
11. TCP vs UDP — one-line difference.
12. What does DNS return?
13. What port is HTTPS? SSH? MySQL?
14. What are the three TCP handshake messages?
15. 401 vs 403?
16. What does a 502 indicate?
17. Symmetric vs asymmetric encryption in HTTPS?
18. Why does HTTP need cookies?
19. Cookie vs session?
20. Session vs JWT?
21. Is a JWT encrypted?
22. What makes a method idempotent? Give one that is and one that isn't.
23. What does a load balancer provide?
24. Forward vs reverse proxy?
25. What problem does NAT solve?
26. What's a firewall's default-deny policy?
27. What does DHCP do (and the acronym for its steps)?
28. What OSI layer is IP? TCP?
29. Command to watch a log live?
30. df vs du?
31. kill vs kill -9?
32. What does chmod 755 mean?
33. find vs grep?
34. How do you check a service's status and logs?
35. What does the pipe `|` do?
36. What's the shebang line?
37. How does a Bash script read its arguments?
38. How do you check the last command succeeded?
39. Cron field order?
40. Which tool extracts a column — grep, awk, or sed?
41. What does `sed 's/x/y/g'` do, and why the `g`?
42. What does `tr -d '0-9'` do?
43. The golden log pipeline for "top N"?
44. fetch vs pull?
45. merge vs rebase, and the golden rule?
46. Steps to resolve a merge conflict?
47. reset vs revert?
48. IaaS vs PaaS vs SaaS?
49. Container vs VM?
50. Docker vs Kubernetes?

### Part B — Answer Key (concise)

1. Process = own private memory; thread = shares the process's memory. 2. Mutual exclusion, hold-and-wait, no preemption, circular wait. 3. Zombie = child finished, not reaped; orphan = parent died, child adopted by PID 1. 4. Saves one process's CPU state and loads another's. 5. Mutex = 1 at a time, owned; semaphore = up to N, not owned. 6. Private address space per process + use disk as RAM overflow (swap). 7. Stack = auto/fast/small/LIFO; heap = manual-or-GC/large/flexible. 8. Accessing a page not currently in RAM; OS loads it from disk. 9. SJF = shortest first (best wait, starvation); RR = fixed time slices, fair/interactive. 10. Controlled request from user space to the kernel for a privileged service. 11. TCP = reliable/ordered; UDP = fast/best-effort. 12. An IP address. 13. 443, 22, 3306. 14. SYN, SYN-ACK, ACK. 15. 401 = not authenticated; 403 = authenticated but not allowed. 16. Backend/upstream returned an invalid response to the proxy/LB. 17. Asymmetric agrees the key once; symmetric encrypts the data fast. 18. HTTP is stateless, so cookies carry state (like a session ID) across requests. 19. Cookie = client-side; session = server-side (cookie holds the ID). 20. Session = server-stored; JWT = stateless signed token. 21. No — signed, not encrypted by default. 22. Repeating has no extra effect; PUT is idempotent, POST isn't. 23. Scalability + availability (spread load, health-check backends). 24. Forward = for clients; reverse = for servers. 25. IPv4 address shortage — many private IPs behind one public. 26. Block everything, then explicitly allow only needed ports. 27. Auto-assigns IPs; DORA = Discover, Offer, Request, Ack. 28. IP = Layer 3; TCP = Layer 4. 29. `tail -f file`. 30. df = free space per filesystem; du = usage of files/dirs. 31. kill = SIGTERM (graceful); kill -9 = SIGKILL (forced). 32. Owner rwx (7), group and others r-x (5). 33. find = locate files; grep = find text in files. 34. `systemctl status X` and `journalctl -u X`. 35. Sends one command's output as the next command's input. 36. `#!/bin/bash`. 37. Positional params: `$1 $2 …`, `$@` all, `$#` count. 38. Check `$?` (0 = success). 39. min, hour, day-of-month, month, day-of-week. 40. awk. 41. Substitutes x with y; `g` = all matches per line, not just the first. 42. Deletes all digit characters. 43. `... | sort | uniq -c | sort -rn | head`. 44. fetch = download only; pull = fetch + merge. 45. Merge keeps branchy history; rebase makes it linear but rewrites it — never rebase shared/pushed history. 46. Edit conflict markers to the correct version, delete markers, `git add`, `git commit`. 47. reset = rewrites history (local); revert = new undo commit (safe on shared). 48. Increasing provider management: EC2 / Heroku / Gmail. 49. Container shares host kernel, light, seconds; VM has full OS, heavy, minutes. 50. Docker builds/runs a container; Kubernetes orchestrates many.

---

# Part C — 20 Practical Linux Questions

*Write the command(s). Key follows.*

1. Show the last 100 lines of `/var/log/syslog`.
2. Watch `/var/log/nginx/error.log` update in real time.
3. Find all `.conf` files under `/etc`.
4. Count how many lines contain "error" (case-insensitive) in `app.log`.
5. Show disk usage of every filesystem in human-readable form.
6. Find the 10 largest directories under `/var`.
7. Show memory usage in human-readable form.
8. List all running processes and filter to `java`.
9. Gracefully stop process with PID 4321, then force it if needed.
10. Make `deploy.sh` executable.
11. Give a file permissions rwxr-xr-x using numbers.
12. Check whether the `nginx` service is running.
13. View the logs for the `nginx` service, following live.
14. Find files larger than 500 MB starting from `/`.
15. Print only the first column (IP) of `access.log`.
16. Replace all "http://" with "https://" in `urls.txt`, in place.
17. Show the top 5 IPs by request count in `access.log`.
18. Show which process is listening on port 8080.
19. Recursively search for "TODO" in the current directory with line numbers.
20. Delete all `.tmp` files under `/tmp` older than 3 days.

### Part C — Answer Key

1. `tail -100 /var/log/syslog`
2. `tail -f /var/log/nginx/error.log`
3. `find /etc -name "*.conf"`
4. `grep -ic error app.log`
5. `df -h`
6. `du -h /var | sort -rh | head -10` (or `du -sh /var/* | sort -rh | head`)
7. `free -h`
8. `ps aux | grep java`
9. `kill 4321` then, if needed, `kill -9 4321`
10. `chmod +x deploy.sh`
11. `chmod 755 file`
12. `systemctl status nginx`
13. `journalctl -u nginx -f`
14. `find / -size +500M`
15. `awk '{print $1}' access.log`
16. `sed -i 's|http://|https://|g' urls.txt` (using `|` as delimiter to avoid escaping slashes)
17. `awk '{print $1}' access.log | sort | uniq -c | sort -rn | head -5`
18. `ss -tulnp | grep 8080` (or `lsof -i :8080`)
19. `grep -rn "TODO" .`
20. `find /tmp -name "*.tmp" -mtime +3 -delete`

---

# Part D — 20 Networking Scenarios

*Give a short diagnosis/answer. Key follows.*

1. Users get "connection refused" on port 443. First two things to check?
2. A page loads but images don't. The image server returns 403. What does that mean?
3. `ping` to a server works, but the website times out. What layer is likely the problem?
4. You see many 504 errors. What's the likely cause?
5. DNS for your domain resolves to the wrong IP. What would you check?
6. Your app can't reach the database at 10.0.1.5:5432 but the DB is running. Likely cause?
7. A user reports the site is slow only on their office network. What might it be?
8. After enabling a firewall, SSH stopped working. Likely cause?
9. Two devices on the same subnet can't communicate, but each reaches the internet. What layer?
10. You want to test if port 22 is reachable on a remote host. Command?
11. A REST API returns 401 for all requests. What's missing?
12. A POST request accidentally sent twice created two orders. Why?
13. A video call is choppy; a file download is fine. Which protocol issue and why acceptable?
14. Your browser shows "certificate not trusted." What failed?
15. Requests to `/api` should go to one server pool and `/static` to another. What device/layer?
16. All users behind one office IP got blocked by your rate limiter. What went wrong?
17. A service works via IP but not via its domain name. What's broken?
18. You need many devices to share one public IP. What technology?
19. A 301 vs a 302 redirect — which should you use for a permanent move?
20. Traffic to your site should be encrypted end to end. What must the server present, and on what port?

### Part D — Answer Key

1. Is the service actually listening on 443 (`ss -tulnp`), and is a firewall/security group blocking the port. "Refused" usually means nothing is listening or it's blocked.
2. 403 Forbidden = authenticated (or reachable) but not permitted — likely a permissions/hotlink-protection issue on the image server, not a missing file.
3. Layer 4/7 — ping (ICMP, layer 3) works, so the network path is fine; the issue is the service/application not responding (service down, port blocked, or app hung).
4. 504 Gateway Timeout = the upstream/backend didn't respond in time — a slow or overloaded backend or database.
5. DNS records (the A record) at the authoritative nameserver, plus caching/TTL — the old IP may be cached; check `dig` and propagation.
6. A firewall/security group blocking port 5432, or the DB only listening on localhost — check the port reachability with `nc -zv 10.0.1.5 5432` and the DB's bind address.
7. Their network — a proxy, firewall, DNS, or bandwidth issue on that office network, since it's location-specific.
8. The firewall's default-deny blocked port 22; you need to explicitly allow SSH (22).
9. Layer 2 (Data Link) — same subnet means no routing needed; likely a switch, VLAN, or ARP issue.
10. `nc -zv host 22` (or `telnet host 22`).
11. Authentication — a valid token, session, or credentials; the server doesn't know who you are.
12. POST isn't idempotent — sending it twice creates two resources. Use idempotency keys or PUT semantics to prevent duplicates.
13. UDP for the video call — a late packet is useless in real time, so dropping it is acceptable; the file download (TCP) needs every byte.
14. Certificate validation — expired, self-signed, wrong domain, or an untrusted CA; the TLS identity check failed.
15. A Layer 7 (application) load balancer or reverse proxy — it can route by URL path.
16. That office is behind NAT sharing one public IP, so many users appear as one IP; rate-limiting by IP punished them all. Account for shared IPs.
17. DNS resolution — the name isn't resolving to the IP; check the DNS record and local resolver.
18. NAT (Network Address Translation).
19. 301 Moved Permanently for a permanent move; 302 is temporary.
20. A valid TLS certificate (verified by a trusted CA), served over HTTPS on port 443.

---

## Final words

If you've worked through this exam and can explain your wrong answers, you are genuinely prepared for a junior on-call, support, or cloud interview. Remember on the day:

- **Think out loud.** Interviewers score your reasoning, not just the answer.
- **Measure before you act; mitigate before you debug; find the root cause.**
- **When you don't know, say how you'd find out** — that's a senior habit and it beats bluffing.
- **Breathe.** You've done the work. Now go show them.

> **Good luck. You've got this.** 🚀
