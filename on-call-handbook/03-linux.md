# Chapter 3 — Linux

> **Why this chapter matters:** For On-Call, Support, and Cloud roles, Linux is where you *live*. Interviewers won't ask you to recite man pages — they'll say "a server's disk is full, what do you do?" or "how do you find which process is eating the CPU?" and watch how you think. This chapter teaches the commands that answer those questions, grouped by the job they do, so you remember them by *purpose*, not by rote.

> 🐧 **Golden rule for the interview:** You don't need to memorize every flag. You need to know *which tool* solves *which problem*, and roughly how to invoke it. "I'd use `du -sh *` to find what's eating the disk" beats reciting options you'll never use.

---

## 3.1 The mental model: everything is a file

Before the commands, one idea that makes Linux click and impresses interviewers:

> **In Linux, almost everything is a file** — documents, directories, devices (your disk is `/dev/sda`), even some system info (`/proc`). This uniformity is why the same tools (`cat`, `grep`, redirection) work on nearly everything.

And the filesystem is a single tree starting at **`/`** (root):

```
/                 the root of everything
├── home/         users' home directories (/home/alice)
├── etc/          configuration files (/etc/nginx/…)
├── var/          variable data — logs live in /var/log
├── usr/          installed programs
├── tmp/          temporary files
├── bin/, sbin/   essential commands
└── dev/, proc/   devices & kernel info (virtual)
```

> 🧠 **Memory trick:** Config in **`/etc`**, logs in **`/var/log`**, your stuff in **`/home`**. Those three cover 90% of what you touch on the job.

---

## 3.2 Navigation & basics ★★★☆☆

| Command | What it does | Example |
|---------|-------------|---------|
| `pwd` | **P**rint **w**orking **d**irectory (where am I?) | `pwd` → `/home/alice` |
| `ls` | List directory contents | `ls -la` (all + details) |
| `cd` | Change directory | `cd /var/log`, `cd ..` (up), `cd ~` (home) |

**`ls` flags worth knowing:** `-l` long/detailed, `-a` show hidden (dotfiles), `-h` human-readable sizes, `-t` sort by time. Combine them: `ls -lath` = detailed, all files, human sizes, newest first.

```bash
$ ls -la
drwxr-xr-x  2 alice staff  4096 Jul 27 10:00 .
-rw-r--r--  1 alice staff  1024 Jul 27 09:00 notes.txt
#   ↑ permissions      ↑ size  ↑ modified    ↑ name
```

> 💬 **Interviewers usually ask:** "How do you see hidden files?"
> ✅ **Answer:** "`ls -a` — hidden files in Linux start with a dot, like `.bashrc`, and `-a` reveals them."

> 🧠 **Memory trick:** `pwd` = "**P**osition, **W**here's my **D**irectory." `cd ..` goes **up**; `cd ~` goes **home**.

---

## 3.3 Creating & managing files ★★★☆☆

| Command | What it does | Example |
|---------|-------------|---------|
| `mkdir` | Make a directory | `mkdir logs`, `mkdir -p a/b/c` (nested) |
| `touch` | Create an empty file / update timestamp | `touch app.log` |
| `cp` | Copy | `cp file.txt backup.txt`, `cp -r dir/ dir2/` (recursive) |
| `mv` | Move **or rename** | `mv old.txt new.txt` (rename), `mv f.txt /tmp/` (move) |
| `rm` | Remove | `rm file.txt`, `rm -r dir/` (recursive) |

> ⚠️ **Common mistake / interview trap:** `mv` does **both** moving and renaming — there's no separate rename command. And `rm -rf /` is the infamous "delete everything" disaster. **`rm` has no recycle bin** — deleted is gone.

> 💬 **Interviewers usually ask:** "How do you rename a file in Linux?"
> ✅ **Answer:** "`mv oldname newname`. Linux uses `mv` for both moving and renaming — renaming is just moving to a new name in the same directory."

> 🧠 **Memory trick:** `-r` / `-R` = **recursive** = "and everything inside it." Needed for directories with `cp` and `rm`.

---

## 3.4 Viewing file contents ★★★★☆

**Support engineers read logs constantly. This group is high-yield.**

| Command | What it does | When to use |
|---------|-------------|-------------|
| `cat` | Dump whole file to screen | Small files |
| `less` | Scrollable pager (q to quit) | Large files — the safe default |
| `head` | First N lines (default 10) | `head -20 file` — top of a file |
| `tail` | Last N lines (default 10) | `tail -50 file` — recent log entries |
| `tail -f` | **Follow** — stream new lines live | Watching a log in real time |

**`tail -f` is the star of on-call work:**

```bash
tail -f /var/log/nginx/error.log     # watch errors as they happen
tail -100 /var/log/syslog            # last 100 lines
```

> 🏭 **In real production:** When you deploy a change and want to see if it breaks, you `tail -f` the log and watch. When an interviewer asks "how do you watch a log live?", the answer is `tail -f`. Knowing this one command signals real hands-on experience.

> 💬 **Interviewers usually ask:** "How do you view the last 50 lines of a log, and how do you watch it update live?"
> ✅ **Answer:** "`tail -50 file` for the last 50 lines. To watch it update in real time, `tail -f file` — the `-f` follows the file and prints new lines as they're written. That's my go-to when debugging a live service."

> 🧠 **Memory trick:** `head` = top, `tail` = bottom, **`tail -f` = follow the flow.** For big files, `less` is more (safer than `cat`).

---

## 3.5 Searching: find & grep ★★★★★

**These two are asked in nearly every Linux interview.**

### `find` — locate files by name, type, size, age
```bash
find /var/log -name "*.log"          # all .log files under /var/log
find . -type f -name "config*"       # files named config* here & below
find / -size +100M                   # files bigger than 100 MB (disk hunting!)
find . -mtime -1                     # modified in the last 1 day
find . -name "*.tmp" -delete         # find and delete .tmp files
```

### `grep` — search *inside* files for text
```bash
grep "error" app.log                 # lines containing "error"
grep -i "error" app.log              # case-insensitive
grep -r "TODO" .                     # recursive — search all files in tree
grep -n "error" app.log              # show line numbers
grep -v "debug" app.log              # invert — lines WITHOUT "debug"
grep -c "error" app.log              # count matching lines
```

> 🏭 **In real production:** The combo `grep -i error /var/log/app.log | tail -20` — "show me the last 20 error lines, case-insensitive" — is something you'll type a hundred times. (Chapter 5 goes deeper on grep.)

> 💬 **Interviewers usually ask:** "Difference between find and grep?"
> ✅ **Model answer:** "`find` searches for *files* by their attributes — name, type, size, modification time. `grep` searches for *text inside* files. So `find` answers 'where is the file?' and `grep` answers 'which files or lines contain this text?' You often combine them — `find` to locate files, then `grep` to search within them."

> 🧠 **Memory trick:** **find = find the file. grep = grab the text (inside).**

---

## 3.6 Permissions: chmod & chown ★★★★☆

**Definition.** Every file has an **owner**, a **group**, and permissions for three classes: owner (**u**ser), **g**roup, and **o**thers. Each class can have **r**ead, **w**rite, e**x**ecute.

**Reading `ls -l` output:**

```
-rwxr-xr--
│└┬┘└┬┘└┬┘
│ │  │  └── others:  r--  (read only)
│ │  └───── group:   r-x  (read + execute)
│ └──────── owner:   rwx  (read + write + execute)
└────────── type: - file, d directory, l link
```

**The numeric (octal) system — this is what interviewers test:**

| Number | Permission | Binary |
|--------|-----------|--------|
| 4 | read (r) | 100 |
| 2 | write (w) | 010 |
| 1 | execute (x) | 001 |

Add them up per class. So `chmod 755` = owner 7 (4+2+1 = rwx), group 5 (4+1 = r-x), others 5 (r-x). And `chmod 644` = owner rw-, group r--, others r-- (the typical file default).

```bash
chmod 755 script.sh        # rwxr-xr-x — runnable script
chmod 644 notes.txt        # rw-r--r-- — normal file
chmod +x script.sh         # add execute (symbolic form)
chown alice file.txt       # change owner to alice
chown alice:devs file.txt  # change owner and group
```

> 💬 **Interviewers usually ask:** "What does chmod 755 mean?" or "How do you make a script executable?"
> ✅ **Model answer:** "755 sets owner to read-write-execute — that's 4+2+1 — and group and others to read-execute, which is 4+1. It's the standard for scripts and directories: the owner can modify and run it, everyone else can run and read it. To make a script executable specifically, I'd use `chmod +x script.sh`. And 644 — read-write for owner, read-only for everyone — is the typical setting for a plain data file."

> 🧠 **Memory trick:** **4 = read, 2 = write, 1 = execute.** Full access = 7 (4+2+1). Read+execute = 5. **755 = "me full, everyone look-and-run."**

---

## 3.7 Processes: ps, top, kill ★★★★★

**Core on-call skill: find the misbehaving process and deal with it.**

### `ps` — snapshot of running processes
```bash
ps aux                     # ALL processes, detailed (the one to remember)
ps aux | grep nginx        # find a specific process
```
Columns: `USER PID %CPU %MEM ... COMMAND`. **PID** (process ID) is what you need to kill it.

### `top` (and `htop`) — live, updating process view
```bash
top                        # live dashboard, sorted by CPU. Press q to quit.
```
Shows CPU%, memory, load average, per-process usage — refreshing every few seconds. Your first stop when "the server is slow."

### `kill` — send a signal to a process
```bash
kill 1234                  # polite: SIGTERM — "please shut down cleanly"
kill -9 1234               # forceful: SIGKILL — "die now" (last resort)
killall nginx              # kill all processes named nginx
```

> ⚠️ **Common mistake / key interview point:** Reaching for `kill -9` first. **`kill` (SIGTERM) asks the process to shut down gracefully** — it can save state and clean up. **`kill -9` (SIGKILL) is un-ignorable and immediate** — it can leave corrupt files or orphaned resources. Always try `kill` first; use `-9` only when it won't die.

> 💬 **Interviewers usually ask:** "A process is stuck using 100% CPU — walk me through what you'd do."
> ✅ **Model answer:** "First I'd run `top` to confirm which process it is and grab its PID. I'd check whether it's genuinely stuck or just busy. To stop it, I'd start with `kill <PID>`, which sends SIGTERM and lets it shut down gracefully — flush data, close files. If it ignores that and stays stuck, then `kill -9 <PID>`, which is SIGKILL and can't be caught, but I use it as a last resort because it doesn't let the process clean up. Then I'd look at logs to find *why* it spun up in the first place."

> 🧠 **Memory trick:** **`kill` = ask nicely (SIGTERM 15). `kill -9` = force (SIGKILL). Ask before you force.**

---

## 3.8 Disk & memory: df, du, free ★★★★★

**"The disk is full" is one of the most common real on-call pages. Know these three.**

### `df` — **d**isk **f**ree: how full are the filesystems?
```bash
df -h              # -h = human-readable (GB/MB). Shows % used per mount.
```

### `du` — **d**isk **u**sage: what's taking up the space?
```bash
du -sh *                        # size of each item in current dir, summarized
du -sh /var/log/*               # what's big inside /var/log
du -h / | sort -rh | head -20   # top 20 biggest things (classic combo)
```

### `free` — memory usage
```bash
free -h            # RAM and swap, human-readable
```

> 🏭 **In real production:** "Disk full" alert → `df -h` to see *which* disk is full → `du -sh /var/*` (or wherever) to find the culprit, drilling down → usually it's runaway logs in `/var/log`. This exact drill is a top interview scenario.

> 💬 **Interviewers usually ask:** "The server's disk is full. How do you find what's using the space?"
> ✅ **Model answer:** "I'd start with `df -h` to see which filesystem is full and how full. Then I'd drill into that mount with `du -sh *`, moving into whichever directory is largest, to find the culprit — often it's runaway logs under `/var/log`. A handy one-liner is `du -h /path | sort -rh | head` to rank the biggest directories. Once I find it, I'd clear or rotate the offending files rather than blindly deleting, and I'd check *why* they grew — maybe log rotation is broken."

> ⚠️ **Common mistake:** Confusing `df` and `du`. **`df` = free space overview (the whole disk). `du` = usage of specific files/dirs (the detail).** You use `df` to spot the problem, `du` to hunt it down.

> 🧠 **Memory trick:** **d**isk **f**ree = **df** (big picture). **d**isk **u**sage = **du** (dig in). **free** = memory.

---

## 3.9 Services & logs: systemctl & journalctl ★★★★☆

Modern Linux manages services (background programs like web servers, databases) with **systemd**. Two commands run it.

### `systemctl` — control services
```bash
systemctl status nginx      # is it running? recent logs? (most-used)
systemctl start nginx       # start it
systemctl stop nginx        # stop it
systemctl restart nginx     # restart (after a config change)
systemctl enable nginx      # start automatically on boot
```

### `journalctl` — read systemd logs
```bash
journalctl -u nginx         # logs for the nginx service
journalctl -u nginx -f      # follow live (like tail -f)
journalctl -xe              # recent logs with errors (great for debugging)
journalctl --since "1 hour ago"
```

> 🏭 **In real production:** "The website is down." Step one: `systemctl status nginx` — is the service even running? If it crashed, `journalctl -u nginx -e` shows *why*. This two-command reflex is exactly what interviewers want to hear.

> 💬 **Interviewers usually ask:** "How do you check if a service is running, and how do you restart it?"
> ✅ **Model answer:** "`systemctl status <service>` tells me if it's active, when it last started, and shows recent log lines. To restart after a config change, `systemctl restart <service>`, or `reload` if I only changed config and don't want downtime. And `enable` makes it start on boot. If it won't start, I check the logs with `journalctl -u <service> -e` to see the error."

> 🧠 **Memory trick:** **systemctl = control the service. journalctl = read the service's diary (logs).** `status` first, always.

---

## 3.10 Other handy commands ★★★☆☆

| Command | What it does | Example |
|---------|-------------|---------|
| `history` | Show your recent commands | `history | grep ssh` |
| `man` | Manual for a command | `man grep` (q to quit) |
| `chmod`/`chown` | Permissions/ownership | (see §3.6) |
| `wc` | Word/line/char count | `wc -l file` (count lines) |
| `ln -s` | Symbolic link | `ln -s /path/target linkname` |
| `which` | Where is a command? | `which python` |
| `sudo` | Run as superuser (root) | `sudo systemctl restart nginx` |
| `chmod +x` | Make executable | (see §3.6) |

> 🧠 **Memory trick:** `sudo` = "**s**uper**u**ser **do**" = run this one command as root. Use it for anything system-level (services, installing software, editing `/etc`).

---

## 3.11 Piping & redirection — the Linux superpower ★★★★☆

**This ties every command together, and interviewers love it.** The Unix philosophy: small tools that each do one thing, combined with **pipes**.

**The pipe `|`** sends one command's output into the next command's input:

```bash
ps aux | grep nginx              # list processes, keep only nginx lines
cat access.log | grep 404 | wc -l   # count 404s in a log
du -sh * | sort -rh | head -5    # 5 biggest items here
```

**Redirection** sends output to (or input from) files:

```bash
echo "hello" > file.txt      # > overwrites file with output
echo "more" >> file.txt      # >> appends to file
command 2> errors.log        # 2> redirects error output (stderr)
command > out.log 2>&1       # send both output and errors to out.log
sort < unsorted.txt          # < feeds a file as input
```

> 🌍 **Analogy.** Pipes are a factory assembly line. Each machine (command) does one job and passes the product to the next. `ps aux | grep nginx | wc -l` = "list everything → keep nginx lines → count them" = "how many nginx processes are running?"

> 💬 **Interviewers usually ask:** "How would you count how many times 'error' appears in a log?"
> ✅ **Model answer:** "`grep -c error app.log` directly counts matching lines. If I wanted to build it up with a pipe, `cat app.log | grep error | wc -l` — read the file, filter to error lines, count them. Pipes let you chain small tools into exactly the query you need, which is the whole Unix philosophy."

> 🧠 **Memory trick:** **`|` passes data between commands; `>` writes to a file (overwrite), `>>` appends.** Pipe = assembly line.

---

## Chapter 3 — Key Takeaways

- **Everything is a file**, filesystem is one tree from `/`. Config in `/etc`, logs in `/var/log`, users in `/home`.
- **Viewing logs:** `tail -f` to watch live, `head`/`tail` for ends, `less` for big files. *(★★★★☆)*
- **Searching:** `find` = locate *files*, `grep` = find *text inside*. *(★★★★★)*
- **Permissions:** `4 read, 2 write, 1 execute`. `755` = owner full, others read+run; `644` = normal file. `chmod +x` to make runnable. *(★★★★☆)*
- **Processes:** `ps aux` (snapshot), `top` (live), `kill` (SIGTERM, polite) vs `kill -9` (SIGKILL, force). *(★★★★★)*
- **Disk/memory:** `df -h` (which disk is full) → `du -sh *` (what's using it) → `free -h` (memory). *(★★★★★)*
- **Services:** `systemctl status/start/stop/restart`, `journalctl -u <svc>` for logs. `status` first. *(★★★★☆)*
- **Pipes & redirection:** `|` chains commands, `>` overwrites, `>>` appends. The glue that makes Linux powerful.

> **Next:** Chapter 4 — Bash scripting. Now we combine these commands into scripts that automate the boring stuff.
