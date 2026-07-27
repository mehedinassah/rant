# Chapter 10 — 25 Mock Interview Scenarios

> **How to use this chapter:** These are *scenario* questions — the "here's a situation, what do you do?" style that dominates on-call and support interviews. For each one: **read the scenario, then genuinely pause and answer out loud for about 5 seconds of thinking before you speak** (the ⏱️ marks that pause). Only then read the ideal answer and the explanation of *why* it's strong. The goal is to practice the *thinking process* interviewers score, not just the fact.

> 🎯 **The universal troubleshooting framework** (use it whenever you're unsure): **Observe → Isolate → Fix → Verify → Prevent.** Say what you'd *check* before what you'd *do*. Interviewers care more about your method than the exact command.

---

### Scenario 1 — "The website is returning 502 errors. Walk me through what you'd do."

⏱️ *(pause, think, then answer)*

✅ **Ideal answer:** "A 502 Bad Gateway means the load balancer or reverse proxy got an invalid response from the backend — so the problem is likely the backend, not the proxy itself. First I'd confirm the scope: is it every request or intermittent? I'd check whether the backend app servers are actually running with `systemctl status`, and look at their logs with `journalctl` or `tail -f` for crashes or errors. I'd check resources — `top` for CPU, `free -h` for memory, `df -h` for disk, since a full disk or OOM can take a backend down. If a backend crashed, I'd restart it and watch the 502s clear, then investigate the root cause from the logs so it doesn't recur."

💡 **Why it's strong:** It correctly diagnoses that 502 points *downstream* to the backend, lays out an ordered checklist, and ends with root-cause and prevention — not just "restart it."

---

### Scenario 2 — "A server's disk is 100% full. What do you do?"

⏱️

✅ **Ideal answer:** "I'd start with `df -h` to confirm which filesystem is full. Then I'd drill in with `du -sh /*` and follow the biggest directory down — `du -sh /var/*` and so on — to find the culprit, which is very often runaway logs in /var/log. Before deleting anything I'd check what it is; if it's logs, I'd truncate or rotate them rather than delete files a running process still holds open — deleting an open file doesn't free the space until the process releases it. Then I'd fix the root cause: maybe log rotation is broken or a process is logging in a loop. I'd also set up an alert at, say, 80% so we catch it before 100% next time."

💡 **Why it's strong:** Uses the df→du drill, shows the subtle "deleting an open file doesn't free space" knowledge, and adds prevention (rotation + alert).

---

### Scenario 3 — "Users say the app is slow. How do you investigate?"

⏱️

✅ **Ideal answer:** "'Slow' is vague, so first I'd quantify it — which action, how slow, when it started, everyone or some users. Then I'd work up the stack. On the server, `top` for CPU and load average, `free -h` for memory and swap — swapping kills performance — and `df -h` for disk. I'd check the app logs for slow queries or errors. Networking-wise, is it slow to connect or slow to respond? I'd look at whether a database is the bottleneck, since slow queries are a common cause. The key is to measure and isolate one layer at a time rather than guess."

💡 **Why it's strong:** Refuses to guess, quantifies the vague word "slow," and shows a systematic layer-by-layer method.

---

### Scenario 4 — "You can't SSH into a server. How do you troubleshoot?"

⏱️

✅ **Ideal answer:** "I'd isolate where it breaks. First, is it network or the service? I'd `ping` the server — if that fails it's a network or the host is down. If ping works, I'd check the SSH port with something like `telnet host 22` or `nc -zv host 22` to see if port 22 is open — if it's refused, sshd may be down or a firewall is blocking it. I'd check whether it's just me by asking a colleague. If I have console access, I'd check `systemctl status sshd` and the firewall rules. Common causes are the SSH service being down, a firewall blocking port 22, or the server being fully out of resources so it can't accept connections."

💡 **Why it's strong:** Classic isolate-the-layer approach — network → port → service — and names concrete tools and common causes.

---

### Scenario 5 — "A process is using 100% CPU. How do you handle it?"

⏱️

✅ **Ideal answer:** "I'd run `top` to identify the process and note its PID. I'd decide whether it's legitimately busy or genuinely stuck — a batch job at 100% might be fine. If it needs stopping, I'd try `kill PID` first, which sends SIGTERM and lets it shut down gracefully. If it ignores that, `kill -9 PID` as a last resort, since SIGKILL can't be caught but also can't clean up. Crucially, I'd capture logs and details first so I can find *why* it spiked — killing it treats the symptom, not the cause."

💡 **Why it's strong:** Distinguishes busy vs stuck, uses SIGTERM before SIGKILL, and prioritizes root cause.

---

### Scenario 6 — "How would you find which files are eating disk space in /var?"

⏱️

✅ **Ideal answer:** "`du -sh /var/*` to see the size of each subdirectory, then I follow the biggest one down — `du -sh /var/log/*` and so on. A quick way to rank everything is `du -h /var | sort -rh | head -20`, which lists the twenty largest paths. That combination — du to measure, sort -rh to rank, head to trim — pinpoints the culprit fast, usually oversized logs."

💡 **Why it's strong:** Gives the exact drill-down commands plus the ranking one-liner, showing real hands-on familiarity.

---

### Scenario 7 — "Explain what happens when you type a URL and press Enter — as much detail as you can."

⏱️

✅ **Ideal answer:** "DNS resolves the domain to an IP — browser cache, OS cache, then a recursive resolver walking root, TLD, and authoritative servers. The browser opens a TCP connection on port 443 with the three-way handshake. Since it's HTTPS, a TLS handshake follows: the server sends a certificate the browser verifies against a CA, and they agree a symmetric session key. The browser sends an HTTP GET; server-side it may pass through a load balancer and reverse proxy to an app server and database, returning 200 OK with HTML. The browser parses the HTML and fetches CSS, JS, and images — each possibly repeating the process — then renders the page."

💡 **Why it's strong:** Hits every layer in order — DNS, TCP, TLS, HTTP, server, render — which is exactly what this flagship question tests.

---

### Scenario 8 — "A cron job was supposed to run last night but didn't. How do you debug it?"

⏱️

✅ **Ideal answer:** "First I'd verify the schedule with `crontab -l` — a wrong field is the most common cause. Then I'd check the cron logs, usually in /var/log/syslog or via `journalctl -u cron`, to see if it even attempted to run. Common gotchas: cron runs with a minimal environment, so a script relying on custom PATH or variables can fail — I'd use absolute paths. I'd also check the script has execute permission and that I redirected its output to a log so I can see errors. I'd test the script manually to confirm it works outside cron, which isolates whether it's the schedule or the script."

💡 **Why it's strong:** Knows the top real cron pitfalls — schedule syntax, minimal environment/PATH, permissions, output logging — which only comes from experience.

---

### Scenario 9 — "How do you check if a remote port is open?"

⏱️

✅ **Ideal answer:** "From another machine, `nc -zv host 443` or `telnet host 443` tests whether that port accepts a connection. On the server itself, `ss -tulnp` — or `netstat -tulnp` — shows what's listening and which process owns it. So I'd confirm from outside that the port is reachable, and from inside that the service is actually listening on it. If it's listening locally but not reachable remotely, that points to a firewall."

💡 **Why it's strong:** Tests from both sides and interprets the result (local-but-unreachable = firewall).

---

### Scenario 10 — "Difference between 401 and 403 — and give a real example of each."

⏱️

✅ **Ideal answer:** "401 Unauthorized means you're not authenticated — the server doesn't know who you are. Example: hitting an API without a login token; you need to log in. 403 Forbidden means you *are* authenticated but lack permission. Example: a logged-in regular user trying to open an admin-only page — the server knows who they are and is refusing. Short version: 401 is 'who are you?', 403 is 'I know you, and no.'"

💡 **Why it's strong:** Nails the distinction *and* gives a concrete example of each — examples are what make it land.

---

### Scenario 11 — "Your teammate force-pushed and now your local branch is broken. What happened and what do you do?"

⏱️

✅ **Ideal answer:** "They probably rebased or reset a shared branch and force-pushed, which rewrote history — so the commits I have no longer match the remote. That's exactly why you avoid rebasing shared branches. To recover, I'd first make sure my own unpushed work is safe, maybe with a branch or stash. Then I'd fetch the new remote state and reconcile — often `git reset --hard origin/branch` to match the remote if I have no local work to keep, or carefully rebase my local commits onto the new history if I do. The lesson I'd raise with the team is to not force-push shared branches."

💡 **Why it's strong:** Correctly diagnoses rewritten history, protects local work first, and turns it into a team-process lesson.

---

### Scenario 12 — "Design a simple script to alert when memory usage is too high."

⏱️

✅ **Ideal answer:** "I'd write a Bash script that reads memory usage, compares it to a threshold, and alerts if exceeded. Something like: capture used-percentage with `free` piped through `awk`, then `if [ $usage -gt 90 ]; then` send an alert — email, Slack webhook, or just log it. I'd schedule it with cron every few minutes. Key touches: use a configurable threshold variable, and make the alert actionable — include the hostname and the actual number. I'd also avoid alert spam by only alerting on state changes if this were production."

💡 **Why it's strong:** Sketches real Bash (free + awk + if + threshold + cron) and shows production polish — actionable alerts, anti-spam.

---

### Scenario 13 — "The database connection is failing from the app. Where do you start?"

⏱️

✅ **Ideal answer:** "I'd isolate the layer. Is the database process running? `systemctl status` on the DB host. Is it reachable on its port — 3306 for MySQL, 5432 for Postgres — via `nc -zv dbhost 5432`? If the port's closed, it's the DB service or a firewall. If it's open, I'd check credentials and connection limits — 'too many connections' is a classic. I'd read both the app logs and the database logs for the exact error. I'd also check whether the DB host is out of disk or memory, since that can refuse connections. The error message usually tells you which of these it is, so I'd start there."

💡 **Why it's strong:** Systematic — process, port, credentials, limits, resources — and anchors on reading the actual error.

---

### Scenario 14 — "How would you count the number of unique visitors in a web access log?"

⏱️

✅ **Ideal answer:** "Assuming the client IP is the first field, `awk '{print $1}' access.log | sort | uniq | wc -l`. awk extracts the IPs, sort groups them, `uniq` collapses duplicates to one per IP, and `wc -l` counts the unique lines. If I wanted to see the busiest ones instead, I'd swap in `uniq -c | sort -rn | head` to rank them by request count."

💡 **Why it's strong:** Builds the exact pipeline and shows the flexible variant, demonstrating command fluency.

---

### Scenario 15 — "A deployment went out and errors spiked. What's your immediate action?"

⏱️

✅ **Ideal answer:** "In on-call, the priority is stopping the bleeding, not diagnosing first. If errors spiked right after a deploy, the deploy is the prime suspect, so my immediate action is to **roll back** to the last known-good version to restore service. Once users are okay, *then* I investigate calmly — compare the logs and the diff between versions to find what broke. Recover first, root-cause second. I'd also communicate status to stakeholders throughout."

💡 **Why it's strong:** Shows the on-call instinct — mitigate/rollback first, diagnose after — plus communication. This mindset is exactly what these roles hire for.

---

### Scenario 16 — "Explain TCP vs UDP to a non-technical person."

⏱️

✅ **Ideal answer:** "TCP is like a phone call — you confirm the other person is there, and if they miss something you repeat it, so nothing is lost but it takes a bit more effort. UDP is like shouting across a noisy room — it's fast and you don't wait for confirmation, but if a word gets lost, you just keep going. So you use TCP when every piece must arrive, like a web page or a file, and UDP when speed matters more than perfection, like a live video call."

💡 **Why it's strong:** Uses a clean analogy and connects it to *when* you'd use each — the "explain simply" skill support roles prize.

---

### Scenario 17 — "You see thousands of requests from one IP hammering the server. What do you do?"

⏱️

✅ **Ideal answer:** "First confirm it with the logs: `awk '{print $1}' access.log | sort | uniq -c | sort -rn | head` to see the top IPs by request count. If one IP is clearly abusive — far above normal — it could be a bad actor, a misbehaving client, or a scraper. Short term, I'd rate-limit or block that IP at the firewall or load balancer to protect the service. Then I'd check whether it's malicious or just a buggy client, and consider a longer-term fix like rate limiting per IP. I'd be careful not to block a legitimate shared IP, like a corporate NAT, without checking."

💡 **Why it's strong:** Confirms with the golden pipeline, mitigates, then reasons about false positives (NAT) — nuance impresses.

---

### Scenario 18 — "What's the difference between a container and a VM, and when would you use each?"

⏱️

✅ **Ideal answer:** "A VM bundles a full guest OS, so it's heavy — gigabytes and minutes to boot — but strongly isolated. A container shares the host's kernel and bundles just the app and its dependencies, so it's megabytes and starts in seconds, letting you pack many more per machine. I'd use containers for deploying and scaling modern applications, especially microservices, because they're fast and portable. I'd use VMs when I need stronger isolation, a different OS kernel, or to run legacy software that expects a full machine."

💡 **Why it's strong:** Contrasts on the key axes and gives clear "when to use each," which is the real question.

---

### Scenario 19 — "How would you securely give a new engineer access to a server?"

⏱️

✅ **Ideal answer:** "I'd use SSH key-based access, not shared passwords. They generate a key pair, send me the public key, and I add it to their user's authorized_keys on the server — the private key never leaves their machine. I'd give them their own account, not a shared one, so actions are auditable, and grant only the permissions they need — least privilege — using sudo for specific commands rather than full root. When they leave, I just remove their key and account. Individual keys plus least privilege is the secure, auditable approach."

💡 **Why it's strong:** Hits SSH keys, individual accounts, least privilege, and offboarding — a complete security mindset.

---

### Scenario 20 — "Logs show 'out of memory' and a process was killed. What happened?"

⏱️

✅ **Ideal answer:** "That's the OOM killer. When the system runs out of memory and swap, the Linux kernel steps in and kills a process to free memory — usually the one using the most — and logs it as 'Out of memory: Killed process.' So a process being OOM-killed means the machine ran out of RAM. I'd check `free -h` and the memory trend, identify what consumed it — a leak, an under-provisioned box, or a spike in load — and fix accordingly: add memory, tune the app's limits, or fix the leak. It's the kernel protecting the system from total collapse."

💡 **Why it's strong:** Correctly names the OOM killer, explains *why* the kernel does it, and moves to root cause and fixes.

---

### Scenario 21 — "Walk me through resolving a Git merge conflict."

⏱️

✅ **Ideal answer:** "A conflict means two branches changed the same lines and Git can't decide automatically. `git status` shows the conflicted files. In each, Git inserts markers — `<<<<<<<` for my version, `=======`, then `>>>>>>>` for the incoming version. I read both sides, decide the correct final result — sometimes mine, sometimes theirs, often a combination — edit the file, and delete the markers. Then `git add` the resolved files and `git commit` to complete the merge. The important part is understanding both changes rather than blindly picking a side."

💡 **Why it's strong:** Clear step-by-step with the marker knowledge and the "understand both sides" judgment.

---

### Scenario 22 — "A service keeps crashing and restarting. How do you find out why?"

⏱️

✅ **Ideal answer:** "The crash-loop itself is a symptom, so I'd go to the logs for the cause: `journalctl -u service -e` for the most recent entries, or `systemctl status service` which shows the last error and exit code. I'd look for what happens right before each crash — a config error, a missing dependency, a port already in use, or running out of memory. If it's under systemd with auto-restart, that explains the looping. Once I see the actual error, I fix that — the restart is just systemd doing its job; my job is the underlying failure."

💡 **Why it's strong:** Goes straight to logs for root cause, lists realistic causes, and understands why it's *looping* (auto-restart).

---

### Scenario 23 — "How does HTTPS keep my data safe? Explain simply."

⏱️

✅ **Ideal answer:** "Three things. First, encryption — your data is scrambled so anyone intercepting it just sees gibberish, not your password. Second, identity — the website presents a certificate, like an ID card verified by a trusted authority, so you know you're really talking to your bank and not an impostor. Third, integrity — the data can't be secretly altered in transit. Technically, it uses a slow but secure method once to agree on a secret key, then fast encryption with that key for everything after — best of both worlds."

💡 **Why it's strong:** Covers all three guarantees plus the asymmetric-then-symmetric insight, explained accessibly.

---

### Scenario 24 — "You get paged at 3 AM that the site is down. Describe your first five minutes."

⏱️

✅ **Ideal answer:** "First, acknowledge the page so the team knows it's being handled. Then confirm the impact — is the whole site down or one feature, all users or some? I'd check the obvious health signals: is the service running, are the servers up, what do the dashboards and error rates show. I'd look at what changed recently — a deploy, a config change, a traffic spike — since that's the usual trigger. My priority is restoring service, so if a recent change caused it I'd roll back rather than debug live. And I'd communicate status early and often, even if it's just 'investigating.' Recover first, root-cause in the morning."

💡 **Why it's strong:** Demonstrates real on-call discipline — acknowledge, assess impact, check recent changes, mitigate over debug, communicate — which *is* the job.

---

### Scenario 25 — "How would you approach a problem you've never seen before?"

⏱️

✅ **Ideal answer:** "I'd stay systematic instead of panicking. Start by gathering information — read the actual error message carefully, check the logs, and reproduce it if I can. Then form a hypothesis and test it, changing one thing at a time so I know what fixed it. I'd use the resources available — documentation, runbooks, and asking a teammate rather than staying stuck too long, since knowing when to escalate is part of the job. And I'd take notes so we can document it afterward for next time. The method matters more than knowing every answer up front."

💡 **Why it's strong:** This is really a *behavioral* question testing temperament. The answer shows composure, method, appropriate escalation, and a learning mindset — exactly what interviewers hope to hear from a junior.

---

## How to practice these

1. **Cover the answer.** Read only the scenario.
2. **Speak for 60–90 seconds.** Record yourself if you can.
3. **Compare** against the ideal answer — not word-for-word, but did you hit the *method* and the *key facts*?
4. **Re-do the ones you fumbled** until the framework — Observe → Isolate → Fix → Verify → Prevent — comes automatically.

> **The meta-lesson across all 25:** interviewers aren't checking whether you memorized a command. They're checking whether you *think* like an engineer under pressure — measure before you act, mitigate before you debug, find the root cause, and communicate. Show that, and you'll pass.

> **Next:** Chapter 11 — the Final Exam. Time to test yourself for real.
